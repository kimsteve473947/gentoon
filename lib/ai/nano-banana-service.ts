import { GoogleGenAI } from '@google/genai';
import { generateOptimizedPrompt, getRecommendedDimensions, type AspectRatio } from './prompt-templates';
import { WebPOptimizer } from '@/lib/image/webp-optimizer';
import { createServiceClient } from '@/lib/supabase/service';
import { ProductionContextManager } from './production-ready-context-manager';

// Gemini 토큰 비용 정보 (token-manager.ts와 일치)
const GEMINI_COST = {
  TOKENS_PER_IMAGE: 1290,
  COST_PER_MILLION: 30,
  USD_TO_KRW: 1330,
  COST_PER_IMAGE_KRW: 52,
} as const;

/**
 * Nano Banana (Vertex AI) Service - 실제 이미지 생성
 * 
 * Vertex AI Gemini 2.5 Flash Image Preview 모델을 사용한 웹툰 이미지 생성
 * 캐릭터 레퍼런스 이미지 지원으로 일관성 있는 캐릭터 생성
 */
export class NanoBananaService {
  private webpOptimizer: WebPOptimizer;
  private genAI: GoogleGenAI;
  private model: string = 'gemini-2.5-flash-image-preview';
  
  constructor() {
    // Vertex AI 프로젝트 설정 (Vercel 환경변수 개행문자 제거)
    const projectId = (process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT)?.trim();
    const location = (process.env.GOOGLE_CLOUD_LOCATION || 'global')?.trim();

    if (!projectId) {
      throw new Error("GOOGLE_CLOUD_PROJECT_ID is required for Vertex AI");
    }

    // @google/genai는 Application Default Credentials (ADC)를 사용
    // 프로덕션에서는 환경변수를 통해 google-auth-library가 자동으로 credentials를 로드함

    // 1. Vercel/프로덕션: 환경변수로 credentials 설정
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      try {
        console.log('🔑 Vercel 환경: Service Account credentials 설정 시작');

        const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;
        console.log('🔍 GOOGLE_PRIVATE_KEY 길이:', rawPrivateKey.length);
        console.log('🔍 GOOGLE_PRIVATE_KEY 시작:', rawPrivateKey.substring(0, 50));

        // private_key 처리: \n 문자열을 실제 개행문자로 변환
        let processedPrivateKey = rawPrivateKey;
        if (rawPrivateKey.includes('\\n')) {
          processedPrivateKey = rawPrivateKey.replace(/\\n/g, '\n');
          console.log('✅ \\n을 실제 개행문자로 변환 완료');
        } else {
          console.log('ℹ️ 이미 실제 개행문자 포함됨 (변환 불필요)');
        }

        // GOOGLE_APPLICATION_CREDENTIALS_JSON 환경변수 동적 생성
        // google-auth-library가 이 값을 읽어서 자동으로 인증
        const credentials = {
          type: "service_account",
          project_id: projectId,
          private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
          private_key: processedPrivateKey,
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          client_id: process.env.GOOGLE_CLIENT_ID,
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
          client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL,
          universe_domain: "googleapis.com"
        };

        // google-auth-library가 사용할 수 있도록 환경변수에 설정
        process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = JSON.stringify(credentials);

        console.log('✅ Credentials JSON 환경변수 설정 완료');
        console.log('📧 Service Account:', credentials.client_email);
        console.log('🔑 Private Key 시작:', credentials.private_key.substring(0, 27)); // "-----BEGIN PRIVATE KEY-----"
      } catch (error) {
        console.error('❌ Credentials 설정 실패:', error);
        throw error;
      }
    }

    // 2. 로컬 환경: 파일 경로 사용
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('🔑 로컬 환경: credentials 파일 경로 사용');
      console.log('📁 파일 경로:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
    }

    // Vertex AI 초기화 (간소화된 방식)
    // @google/genai는 자동으로 GOOGLE_APPLICATION_CREDENTIALS_JSON을 읽음
    this.genAI = new GoogleGenAI({
      vertexai: true,  // ✅ Vertex AI 명시적 사용
      project: projectId,
      location: location
    });

    this.webpOptimizer = new WebPOptimizer();

    console.log('✅ Vertex AI 초기화 완료:', {
      project: projectId,
      location: location,
      vertexai: true
    });
  }

  /**
   * 429 에러에 대한 백오프 재시도 로직
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // 429 에러가 아니거나 마지막 시도면 즉시 에러 던지기
        if (!error.message?.includes('429') || attempt === maxRetries) {
          throw error;
        }

        // 백오프 지연
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.warn(`🔄 Vertex AI 429 에러 재시도 ${attempt + 1}/${maxRetries} (${Math.round(delay)}ms 대기)`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
  
  /**
   * 웹툰 패널 생성 (캐릭터 레퍼런스 지원) - 세션 격리 적용
   */
  async generateWebtoonPanel(
    prompt: string, 
    options?: {
      userId?: string;
      projectId?: string;
      panelId?: number; // 패널 번호 (컨텍스트 관리용)
      sessionId?: string; // 배치 생성용 세션 ID
      selectedCharacterIds?: string[];
      referenceImages?: string[];
      elementImageUrls?: string[];
      characterDescriptions?: Map<string, string>;
      style?: string;
      negativePrompt?: string;
      aspectRatio?: '4:5' | '1:1';
      width?: number;
      height?: number;
    }
  ): Promise<{
    imageUrl: string;
    thumbnailUrl: string;
    tokensUsed: number;
    generationTime: number;
    detectedCharacters?: string[];
    sessionId?: string;
  }> {
    const startTime = Date.now();
    
    // 🧠 프로덕션 컨텍스트 시스템 적용
    const userId = options?.userId || 'anonymous';
    const projectId = options?.projectId || 'default';
    
    console.log(`🎭 이미지 생성 시작: 프로젝트 ${projectId}, 유저 ${userId}`);
    
    try {
      // 캐릭터 정보 로깅
      if (options?.selectedCharacterIds?.length) {
        console.log(`🎭 선택된 캐릭터: ${options.selectedCharacterIds.length}개`);
      }
      if (options?.referenceImages?.length) {
        console.log(`📚 레퍼런스 이미지: ${options.referenceImages.length}개`);
      }

      // 🧠 프로젝트 컨텍스트 로드 및 컨텍스트 인식 프롬프트 생성
      let contextAwarePrompt = prompt;
      if (options?.projectId && options?.panelId && userId !== 'anonymous') {
        console.log(`🧠 프로젝트 컨텍스트 적용: ${options.projectId} - 패널 ${options.panelId}`);
        
        // 프로젝트 컨텍스트 기반 향상된 프롬프트 생성
        contextAwarePrompt = await ProductionContextManager.buildOptimizedPrompt(
          options.projectId,
          userId,
          prompt,
          options.panelId
        );
        
        console.log(`🧠 컨텍스트 인식 프롬프트 길이: ${contextAwarePrompt.length}자`);
      } else {
        console.log(`💭 프로젝트 컨텍스트 미적용 (projectId: ${options?.projectId}, panelId: ${options?.panelId}, userId: ${userId})`);
      }
      
      // 사용자 프롬프트 전처리 (텍스트 관련 키워드 필터링)
      const cleanedPrompt = this.preprocessUserPrompt(contextAwarePrompt);
      
      // 향상된 프롬프트 생성
      const enhancedPrompt = this.buildEnhancedPrompt(cleanedPrompt, options);
      
      // 🧠 컨텍스트 인식 프롬프트 완성
      const finalPrompt = contextAwarePrompt;
      console.log(`🎭 웹툰 컨텍스트 프롬프트 적용 완료`);
      console.log(`📝 최종 프롬프트 미리보기: ${finalPrompt.substring(0, 300)}...`);
      
      // 비율 설정
      const aspectRatio = options?.aspectRatio || '4:5';
      console.log(`🎨 이미지 생성 시작: ${aspectRatio} 비율`);
      
      // Gemini API를 위한 컨텐츠 구성
      const contents: any[] = [];
      
      let successfulElementImages = 0;
      let successfulReferenceImages = 0;
      
      // 1️⃣ 먼저 요소 이미지들을 추가 (배경, 사물, 자세 등)
      if (options?.elementImageUrls && options.elementImageUrls.length > 0) {
        console.log(`🎨 저장된 요소 이미지 ${options.elementImageUrls.length}개를 Gemini에 먼저 전달 시도`);
        
        for (const imageUrl of options.elementImageUrls) {
          try {
            let imageData: string;
            let mimeType: string = 'image/jpeg';
            
            // Data URL인지 HTTP URL인지 확인
            if (imageUrl.startsWith('data:image/')) {
              // Data URL인 경우 base64 데이터만 추출
              const [headerPart, base64Part] = imageUrl.split(',');
              imageData = base64Part;
              
              // MIME 타입 추출
              const mimeMatch = headerPart.match(/data:([^;]+)/);
              if (mimeMatch) {
                mimeType = mimeMatch[1];
              }
              
              console.log(`✅ 요소 이미지 Data URL 처리 성공: ${mimeType}, ${Math.round(base64Part.length/1024)}KB`);
            } else {
              // HTTP URL인 경우 다운로드
              imageData = await this.downloadAndConvertImage(imageUrl);
              console.log(`✅ 요소 이미지 HTTP URL 다운로드 성공: ${imageUrl}`);
            }
            
            contents.push({
              inlineData: {
                mimeType: mimeType,
                data: imageData
              }
            });
            successfulElementImages++;
          } catch (error) {
            console.warn(`⚠️  요소 이미지 로드 실패 (계속 진행): ${imageUrl}`, error);
          }
        }
        
        console.log(`🎨 요소 이미지 로드 결과: ${successfulElementImages}/${options.elementImageUrls.length}개 성공`);
      }
      
      // 2️⃣ 그 다음 캐릭터 레퍼런스 이미지들을 추가 (비율별 캐릭터 이미지)
      if (options?.referenceImages && options.referenceImages.length > 0) {
        console.log(`🖼️  캐릭터 레퍼런스 이미지 ${options.referenceImages.length}개를 Gemini에 전달 시도`);
        
        for (const imageUrl of options.referenceImages) {
          try {
            let imageData: string;
            let mimeType: string = 'image/jpeg';
            
            // Data URL인지 HTTP URL인지 확인
            if (imageUrl.startsWith('data:image/')) {
              // Data URL인 경우 base64 데이터만 추출
              const [headerPart, base64Part] = imageUrl.split(',');
              imageData = base64Part;
              
              // MIME 타입 추출
              const mimeMatch = headerPart.match(/data:([^;]+)/);
              if (mimeMatch) {
                mimeType = mimeMatch[1];
              }
              
              console.log(`✅ 캐릭터 레퍼런스 이미지 Data URL 처리 성공: ${mimeType}, ${Math.round(base64Part.length/1024)}KB`);
            } else {
              // HTTP URL인 경우 기존 로직 사용
              imageData = await this.downloadAndConvertImage(imageUrl);
              console.log(`✅ 캐릭터 레퍼런스 이미지 HTTP URL 다운로드 성공: ${imageUrl}`);
            }
            
            contents.push({
              inlineData: {
                mimeType: mimeType,
                data: imageData
              }
            });
            successfulReferenceImages++;
          } catch (error) {
            console.warn(`⚠️  캐릭터 레퍼런스 이미지 로드 실패 (계속 진행): ${imageUrl}`, error);
          }
        }
        
        console.log(`📊 캐릭터 레퍼런스 이미지 로드 결과: ${successfulReferenceImages}/${options.referenceImages.length}개 성공`);
      }
      
      // 텍스트 프롬프트 추가 (강화된 텍스트 차단 프롬프트)
      const safeguardedPrompt = this.addAntiTextSafeguards(finalPrompt);
      contents.push({ text: safeguardedPrompt });
      
      // 레퍼런스 이미지가 없으면 경고하지만 계속 진행
      if (successfulReferenceImages === 0 && options?.referenceImages && options.referenceImages.length > 0) {
        console.warn('⚠️  모든 레퍼런스 이미지 로드 실패 - 텍스트 프롬프트만으로 생성 진행');
      }
      
      console.log(`🚀 Vertex AI SDK 호출 시작 (컨텐츠 ${contents.length}개, 레퍼런스 이미지 ${successfulReferenceImages}개)`);
      console.log(`📋 최종 프롬프트 미리보기: ${finalPrompt.substring(0, 500)}...`);
      
      // Vertex AI SDK 호출
      console.log('🌟 Vertex AI SDK 요청 상세:', {
        model: 'gemini-2.5-flash-image-preview',
        contentCount: contents.length,
        hasReference: contents.some(c => c.inlineData),
        aspectRatio
      });
      
      // Vertex AI SDK 호출 (정식 API 방식)
      const result = await this.callGoogleAI(contents);
      console.log('📋 Raw Vertex AI Result:', {
        hasResponse: !!result.response,
        candidateCount: result.response?.candidates?.length || 0
      });
      
      const response = result.response;
      
      // 실제 토큰 사용량 추출 (Vertex AI SDK 응답에서)
      let actualTokensUsed = 0;
      if (response.usageMetadata) {
        actualTokensUsed = response.usageMetadata.totalTokenCount || 0;
        console.log('🔢 Vertex AI SDK 실제 토큰 사용량:', {
          promptTokens: response.usageMetadata.promptTokenCount,
          candidatesTokens: response.usageMetadata.candidatesTokenCount,
          totalTokens: response.usageMetadata.totalTokenCount,
          actualUsed: actualTokensUsed
        });
      } else {
        // 토큰 정보가 없는 경우 추정치 사용 (보수적으로 높게 설정)
        actualTokensUsed = GEMINI_COST.TOKENS_PER_IMAGE * 1.2; // 20% 여유분
        console.warn('⚠️ Vertex AI SDK에서 토큰 사용량을 가져올 수 없어 추정치 사용:', actualTokensUsed);
      }
      
      // 응답 구조 디버깅
      console.log('🔍 Vertex AI SDK 응답 구조:', JSON.stringify(response, null, 2));
      
      // 생성 성공/실패 명확히 로깅
      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        console.log('❌ Vertex AI SDK 이미지 생성 실패: 후보가 없습니다');
        throw new Error('이미지 생성 결과가 없습니다');
      }
      
      const candidate = candidates[0];
      console.log('📋 첫 번째 후보 구조:', JSON.stringify(candidate, null, 2));
      
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        console.log(`⚠️ Vertex AI SDK 생성 중단됨: ${candidate.finishReason}`);
        if (candidate.finishReason === 'PROHIBITED_CONTENT' || candidate.finishReason === 'SAFETY') {
          console.log('🚫 콘텐츠 정책 위반으로 이미지 생성이 거부되었습니다');
          throw new Error('CONTENT_POLICY_VIOLATION');
        }
        if (candidate.finishReason === 'RECITATION') {
          console.log('🚫 저작권 침해 우려로 이미지 생성이 거부되었습니다');
          throw new Error('COPYRIGHT_VIOLATION');
        }
        throw new Error(`이미지 생성이 중단됨: ${candidate.finishReason}`);
      }
      
      // 이미지 생성 성공
      console.log('✅ Vertex AI SDK 이미지 생성 성공!');
      
      if (!candidate.content || !candidate.content.parts) {
        throw new Error('이미지 데이터가 없습니다');
      }
      
      // 이미지 데이터 찾기
      let generatedImageData: string | null = null;
      for (const part of candidate.content.parts) {
        console.log('🧩 파트 구조:', JSON.stringify(part, null, 2));
        if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
          generatedImageData = part.inlineData.data;
          console.log('✅ 이미지 데이터 발견!');
          break;
        }
      }
      
      if (!generatedImageData) {
        throw new Error('생성된 이미지 데이터를 찾을 수 없습니다');
      }
      
      // 생성된 이미지 크기 확인 (모든 비율에서)
      console.log('🔍 Sharp 이미지 처리 시작...');
      
      const Sharp = (await import('sharp')).default;
      const originalImageBuffer = Buffer.from(generatedImageData, 'base64');
      
      console.log('🔍 Sharp 처리할 버퍼 정보:', {
        originalLength: originalImageBuffer.length,
        base64Length: generatedImageData.length,
        first10Bytes: Array.from(originalImageBuffer.slice(0, 10)),
        isPNG: originalImageBuffer.slice(0, 8).toString('hex') === '89504e470d0a1a0a',
        isJPEG: originalImageBuffer.slice(0, 2).toString('hex') === 'ffd8'
      });
      
      let originalMetadata;
      try {
        originalMetadata = await Sharp(originalImageBuffer).metadata();
        console.log('✅ Sharp 메타데이터 추출 성공:', originalMetadata);
      } catch (sharpError) {
        const errorMessage = sharpError instanceof Error ? sharpError.message : String(sharpError);
        console.error('❌ Sharp 오류 상세:', {
          error: errorMessage,
          bufferLength: originalImageBuffer.length,
          first20Bytes: Array.from(originalImageBuffer.slice(0, 20))
        });
        throw new Error(`이미지 형식 오류: ${errorMessage}`);
      }
      
      console.log('==================== 📏 VERTEX AI SDK 이미지 크기 확인 ====================');
      console.log(`🎯 요청한 비율: ${aspectRatio}`);
      console.log(`📐 Vertex AI SDK가 실제로 생성한 이미지 크기: ${originalMetadata.width} × ${originalMetadata.height} pixels`);
      console.log(`🔍 이미지 포맷: ${originalMetadata.format}`);
      console.log(`📊 예상 크기와 비교:`);
      if (aspectRatio === '1:1') {
        console.log(`   - 예상: 1024 × 1024 (정사각형)`);
        console.log(`   - 실제: ${originalMetadata.width} × ${originalMetadata.height}`);
        console.log(`   - 크기 일치: ${originalMetadata.width === 1024 && originalMetadata.height === 1024 ? '✅' : '❌'}`);
      } else if (aspectRatio === '4:5') {
        console.log(`   - 예상: 896 × 1152 (Vertex AI SDK 4:5 크기)`);
        console.log(`   - 실제: ${originalMetadata.width} × ${originalMetadata.height}`);
        console.log(`   - 크기 일치: ${originalMetadata.width === 896 && originalMetadata.height === 1152 ? '✅' : '❌'}`);
      }
      console.log('================================================================');
      
      // 비율별 이미지 후처리
      let processedImageData = generatedImageData;
      let imageBuffer = originalImageBuffer;
      
      // 1:1 비율 이미지 강제 리사이즈 (1024x1024)
      if (aspectRatio === '1:1') {
        const targetWidth = 1024;
        const targetHeight = 1024;
        
        if (originalMetadata.width !== targetWidth || originalMetadata.height !== targetHeight) {
          console.log(`🔧 1:1 비율 이미지 강제 리사이즈: ${originalMetadata.width}×${originalMetadata.height} → ${targetWidth}×${targetHeight}`);
          try {
            const resizedBuffer = await Sharp(originalImageBuffer)
              .resize(targetWidth, targetHeight, { 
                fit: 'fill',  // 비율 무시하고 정확한 크기로 맞춤
                kernel: Sharp.kernel.lanczos3 // 고품질 리사이즈
              })
              .png()
              .toBuffer();
            
            processedImageData = resizedBuffer.toString('base64');
            imageBuffer = Buffer.from(resizedBuffer);
            console.log('✅ 1:1 비율 이미지 리사이즈 완료');
          } catch (processingError) {
            console.error('⚠️ 1:1 비율 리사이즈 실패, 원본 사용:', processingError);
          }
        } else {
          console.log('✅ 1:1 비율 이미지 크기 정확함 - 후처리 불필요');
        }
      }
      
      // 4:5 비율 이미지 후처리 (제미나이 1152px → 캔버스 1115px)
      if (aspectRatio === '4:5') {
        try {
          console.log('🔧 4:5 비율 이미지 후처리 시작: 896×1152 → 896×1115');
          
          // Import the processor function
          const { processGemini4to5Image } = await import('@/lib/utils/gemini-image-processor');
          
          // Apply center crop processing
          
          // Apply post-processing
          const processedBuffer = await processGemini4to5Image(imageBuffer);
          
          // Convert back to base64
          processedImageData = processedBuffer.toString('base64');
          
          console.log('✅ 4:5 비율 이미지 후처리 완료');
        } catch (processingError) {
          console.error('⚠️ 4:5 비율 후처리 실패, 원본 사용:', processingError);
          // 후처리 실패 시 원본 데이터 사용
        }
      }
      
      // Base64 이미지를 업로드 가능한 URL로 변환 (Vercel Blob 등에 저장)
      const { imageUrl, thumbnailUrl } = await this.saveGeneratedImage(
        processedImageData, 
        options?.userId || 'anonymous',
        aspectRatio
      );
      
      const generationTime = Date.now() - startTime;
      
      // 📋 토큰 사용량 기록
      console.log(`📊 토큰 사용량: ${actualTokensUsed}, 프로젝트: ${projectId}`);
      
      // 🧠 프로젝트 컨텍스트 업데이트 (생성 완료 후)
      if (options?.projectId && options?.panelId && userId !== 'anonymous') {
        try {
          // 생성된 이미지에 대한 설명 생성 (간단한 요약)
          const panelDescription = this.generatePanelDescription(prompt, options);
          
          await ProductionContextManager.updateProjectContext(
            options.projectId,
            userId,
            options.panelId,
            prompt,
            panelDescription
          );
          
          console.log(`🧠 프로젝트 컨텍스트 업데이트 완료: ${options.projectId} - 패널 ${options.panelId}`);
        } catch (contextError) {
          console.warn(`⚠️ 프로젝트 컨텍스트 업데이트 실패:`, contextError);
          // 컨텍스트 업데이트 실패해도 이미지 생성 결과는 반환
        }
      }
      
      console.log(`✅ 이미지 생성 완료: ${imageUrl} (${generationTime}ms)`);
      console.log(`🔢 Vertex AI SDK 실제 토큰 사용량: ${actualTokensUsed}`);
      console.log(`🎭 웹툰 컨텍스트 시스템 적용 완료`);
      
      return {
        imageUrl,
        thumbnailUrl,
        tokensUsed: actualTokensUsed, // 실제 Google Gemini API 토큰 사용량 반환
        generationTime,
        detectedCharacters: options?.selectedCharacterIds,
        // sessionId 제거 - 더 이상 세션 기반 시스템 사용 안함
      };
      
    } catch (error) {
      console.error("🔥 Vertex AI SDK 이미지 생성 오류:", error);
      console.error("🔍 에러 상세:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID ? '***설정됨***' : '❌설정안됨❌',
        location: process.env.GOOGLE_CLOUD_LOCATION || 'global'
      });
      
      // 사용자 친화적 에러 메시지로 변환
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      
      if (errorMessage === 'CONTENT_POLICY_VIOLATION') {
        throw new Error('CONTENT_POLICY_VIOLATION');
      }
      
      if (errorMessage.includes('Vertex AI SDK 호출 실패')) {
        throw new Error('잠시 후 다시 시도해 주세요. AI 서비스에 일시적인 문제가 발생했습니다.');
      }
      
      throw new Error(`이미지 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.`);
    }
  }
  
  /**
   * 사용자 프롬프트 전처리 - 텍스트 생성을 유도하는 키워드 필터링
   */
  private preprocessUserPrompt(prompt: string): string {
    // 텍스트 생성을 유도할 수 있는 키워드들
    const textKeywords = [
      '말하고', '이야기하고', '대화하고', '설명하고', '외치고', '속삭이고', '소리치고',
      '말풍선', '대화창', '텍스트', '글자', '글씨', '문자', '단어', '문장',
      'says', 'talking', 'speaking', 'dialogue', 'conversation', 'text', 'words', 
      'speech bubble', 'caption', 'subtitle', 'writing', 'letter', 'message',
      'thinks', 'thought', '생각하고', '머릿속으로', '마음속으로'
    ];
    
    let cleanedPrompt = prompt;
    
    // 텍스트 관련 키워드를 시각적 표현으로 대체
    textKeywords.forEach(keyword => {
      const regex = new RegExp(keyword, 'gi');
      if (regex.test(cleanedPrompt)) {
        console.log(`🧹 텍스트 키워드 발견 및 필터링: "${keyword}"`);
        cleanedPrompt = cleanedPrompt.replace(regex, '표현하고');
      }
    });
    
    // 추가적인 시각적 강조 표현 추가
    if (cleanedPrompt !== prompt) {
      cleanedPrompt += ' (순수 비주얼 표현만, 텍스트나 글자 없이)';
      console.log(`📝 전처리된 프롬프트: ${cleanedPrompt}`);
    }
    
    return cleanedPrompt;
  }

  /**
   * 텍스트 생성 방지를 위한 추가 안전장치
   */
  private addAntiTextSafeguards(prompt: string): string {
    return `${prompt}

🚨 CRITICAL ANTI-TEXT ENFORCEMENT 🚨
ABSOLUTELY NO TEXT GENERATION OF ANY KIND:
- 텍스트 없음 (NO Korean text)
- No English text
- No symbols or signs
- No dialogue or speech
- No thought bubbles
- No captions
- No watermarks
- No typography
- Pure visual content only

If you detect ANY possibility of text appearing in the image, DO NOT GENERATE IT.
Instead, focus 100% on visual storytelling without any written elements.

THIS IS A MANDATORY REQUIREMENT - ANY TEXT WILL BE REJECTED.`;
  }

  /**
   * 캐릭터 정보를 포함한 향상된 프롬프트 생성
   */
  private buildEnhancedPrompt(prompt: string, options?: any): string {
    const aspectRatio: AspectRatio = options?.aspectRatio || '4:5';
    const dimensions = getRecommendedDimensions(aspectRatio);
    
    // 🚀 나노바나나 MCP: 강화된 캐릭터 일관성 지시사항
    let characterInstructions = '';
    if (options?.referenceImages?.length > 0) {
      characterInstructions = `
🎯 NANOBANA MCP 캐릭터 일관성 보장:

[CRITICAL CHARACTER CONSISTENCY - 절대 준수]
1. **정확한 외형 복제**: 제공된 레퍼런스 이미지의 캐릭터 외형을 pixel-perfect로 재현
2. **얼굴 특징**: 눈 모양, 코, 입, 얼굴 윤곽 등 모든 얼굴 특징 정확히 유지
3. **헤어스타일**: 머리카락 색상, 길이, 스타일, 질감 완벽히 일치
4. **의상 & 색상**: 옷의 스타일, 색상, 패턴, 액세서리 동일하게 유지
5. **체형 & 비율**: 캐릭터의 키, 체형, 신체 비율 레퍼런스와 동일

[웹툰 스타일 요구사항]
- 한국 웹툰의 일관된 아트 스타일 적용
- 선명한 선화와 생동감 있는 채색
- ${aspectRatio === '1:1' ? '정사각형 (1:1)' : '세로형 (4:5)'} 비율에 최적화된 구도

❌ 절대 금지: 캐릭터 외형 변경, 다른 스타일 적용, 레퍼런스와 다른 특징

✅ 결과: 레퍼런스 이미지와 100% 일치하는 캐릭터가 새로운 장면에서 자연스럽게 행동하는 모습
      `.trim();
    }
    
    // 강화된 프롬프트 템플릿 사용
    console.log('📋 최종 프롬프트 미리보기:', prompt);
    console.log('🎭 캐릭터 지시사항 포함 여부:', !!characterInstructions);
    
    return generateOptimizedPrompt({
      aspectRatio,
      userPrompt: prompt,
      characterInstructions,
      width: dimensions.width,
      height: dimensions.height
    });
  }
  
  /**
   * 이미지 다운로드 및 Base64 변환 (개선된 에러 핸들링 및 재시도 로직)
   */
  private async downloadAndConvertImage(imageUrl: string, retries: number = 3): Promise<string> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`🔄 이미지 다운로드 시도 ${attempt}/${retries}: ${imageUrl}`);
        
        // AbortController로 타임아웃 설정 (10초로 단축 - 성능 최적화)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(imageUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'InstatoonSaaS/1.0',
            'Accept': 'image/*',
          },
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        
        console.log(`✅ 이미지 다운로드 성공: ${Math.round(buffer.length / 1024)}KB`);
        return base64;
        
      } catch (error) {
        console.warn(`⚠️  이미지 다운로드 실패 (시도 ${attempt}/${retries}):`, error);
        
        // 마지막 시도가 아니면 잠시 대기 후 재시도
        if (attempt < retries) {
          const delay = attempt * 2000; // 2초, 4초, 6초...
          console.log(`⏱️  ${delay}ms 대기 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(`❌ 이미지 다운로드 최종 실패 (${imageUrl}):`, error);
          throw error;
        }
      }
    }
    
    throw new Error('이미지 다운로드 재시도 횟수 초과');
  }
  
  /**
   * 생성된 이미지를 저장소에 업로드
   */
  private async saveGeneratedImage(
    base64Data: string, 
    userId: string, 
    aspectRatio: string
  ): Promise<{ imageUrl: string; thumbnailUrl: string }> {
    try {
      console.log('💾 실제 Vertex AI SDK 생성 이미지 저장 시도 (WebP 최적화 포함)...');
      
      // 🚀 WebP 최적화 적용
      const originalBuffer = Buffer.from(base64Data, 'base64');
      console.log(`📊 원본 이미지 크기: ${Math.round(originalBuffer.length / 1024)}KB`);
      
      // WebP로 변환 (품질 85로 설정 - 고품질 유지)
      const webpResult = await this.webpOptimizer.convertToWebP(originalBuffer, 85);
      console.log(`🗜️ WebP 최적화 완료: ${Math.round(webpResult.originalSize / 1024)}KB → ${Math.round(webpResult.optimizedSize / 1024)}KB (${webpResult.compressionRatio.toFixed(1)}% 절약)`);
      
      // 썸네일 생성 (150x150 WebP)
      const responsiveSizes = await this.webpOptimizer.generateResponsiveSizes(originalBuffer, 85);
      console.log(`🖼️ 썸네일 생성 완료: ${Math.round(responsiveSizes.thumbnail.length / 1024)}KB`);
      
      // WebP 이미지를 Supabase Storage에 업로드
      const timestamp = Date.now();
      
      console.log('☁️ Supabase Storage에 WebP 이미지 업로드 중...');
      
      try {
        const supabase = createServiceClient();
        
        // 파일 이름 생성
        const mainImagePath = `generated/${userId}/${aspectRatio}-${timestamp}.webp`;
        const thumbnailPath = `generated/${userId}/${aspectRatio}-${timestamp}-thumb.webp`;
        
        // 🚀 Supabase Storage에 업로드
        console.log(`☁️ Supabase Storage에 WebP 이미지 업로드 중...`);
        console.log(`📊 업로드 정보:`, {
          mainImagePath,
          thumbnailPath,
          mainImageSize: Math.round(webpResult.optimizedSize / 1024) + 'KB',
          thumbnailSize: Math.round(responsiveSizes.thumbnailSize / 1024) + 'KB',
          userId: userId.substring(0, 8) + '...',
          timestamp: new Date().toISOString()
        });
        
        // Supabase Storage에 병렬 업로드
        const [mainImageResult, thumbnailResult] = await Promise.all([
          supabase.storage
            .from('webtoon-images')
            .upload(mainImagePath, webpResult.webpBuffer, {
              contentType: 'image/webp',
              cacheControl: '31536000', // 1년 캐시
              upsert: false
            }),
          supabase.storage
            .from('webtoon-images')
            .upload(thumbnailPath, responsiveSizes.thumbnail, {
              contentType: 'image/webp',
              cacheControl: '31536000', // 1년 캐시
              upsert: false
            })
        ]);
        
        if (mainImageResult.error || thumbnailResult.error) {
          console.error('🚨 Supabase Storage 업로드 상세 오류:', {
            mainImageError: mainImageResult.error,
            thumbnailError: thumbnailResult.error,
            mainImagePath,
            thumbnailPath,
            mainImageSize: Math.round(webpResult.optimizedSize / 1024) + 'KB',
            thumbnailSize: Math.round(responsiveSizes.thumbnailSize / 1024) + 'KB'
          });
          
          // 개발 모드에서는 로컬 파일로 fallback
          if (process.env.NODE_ENV === 'development') {
            console.log('🔧 개발 모드: Supabase Storage 실패, 로컬 fallback 사용');
            return {
              imageUrl: `data:image/webp;base64,${webpResult.optimizedData}`,
              thumbnailUrl: `data:image/webp;base64,${responsiveSizes.thumbnailBase64}`,
              originalSize: webpResult.originalSize || 0,
              optimizedSize: webpResult.optimizedSize,
              thumbnailSize: responsiveSizes.thumbnailSize
            };
          }
          
          throw new Error(`Supabase Storage 업로드 실패: ${mainImageResult.error?.message || thumbnailResult.error?.message}`);
        }
        
        // 공개 URL 생성
        const { data: mainImageUrl } = supabase.storage
          .from('webtoon-images')
          .getPublicUrl(mainImagePath);
          
        const { data: thumbnailUrl } = supabase.storage
          .from('webtoon-images')
          .getPublicUrl(thumbnailPath);
        
        console.log(`✅ Supabase Storage 업로드 완료: ${mainImageUrl.publicUrl}`);
        console.log(`📸 최적화된 이미지 크기: ${Math.round(webpResult.optimizedSize / 1024)}KB`);
        
        return {
          imageUrl: mainImageUrl.publicUrl,
          thumbnailUrl: thumbnailUrl.publicUrl
        };
      } catch (storageError) {
        console.error('Supabase Storage 업로드 실패:', storageError);
        
        // Storage 업로드 실패 시 data URL 대체 사용
        const webpBase64 = webpResult.webpBuffer.toString('base64');
        const thumbnailBase64 = responsiveSizes.thumbnail.toString('base64');
        const webpDataUrl = `data:image/webp;base64,${webpBase64}`;
        const thumbnailDataUrl = `data:image/webp;base64,${thumbnailBase64}`;
        
        console.log('🔄 Storage 실패로 data URL 대체 사용');
        
        return {
          imageUrl: webpDataUrl,
          thumbnailUrl: thumbnailDataUrl
        };
      }
      
    } catch (error) {
      console.error('WebP 최적화 또는 저장 오류:', error);
      
      // WebP 최적화 실패 시 원본 이미지 사용
      if (base64Data) {
        console.log('🔄 WebP 최적화 실패 시 원본 data URL 대체 사용');
        const dataUrl = `data:image/png;base64,${base64Data}`;
        return {
          imageUrl: dataUrl,
          thumbnailUrl: dataUrl
        };
      }
      
      // 완전 실패 시 플레이스홀더
      const seed = `generated-${Date.now()}`;
      const width = aspectRatio === '1:1' ? 1024 : 896;
      const height = aspectRatio === '1:1' ? 1024 : 1152;
      
      return {
        imageUrl: `https://picsum.photos/seed/${seed}/${width}/${height}`,
        thumbnailUrl: `https://picsum.photos/seed/${seed}/300/200`
      };
    }
  }
  
  /**
   * Vertex AI API 호출 (@google/genai SDK 사용) - 멀티모달 지원
   */
  private async callGoogleAI(contents: any[]): Promise<any> {
    try {
      console.log('🚀 Vertex AI SDK 호출 시작...', {
        model: 'gemini-2.5-flash-image-preview',
        contentCount: contents.length,
        hasReferenceImages: contents.some(c => c.inlineData)
      });

      // 레퍼런스 이미지 및 텍스트 프롬프트 구성
      const referenceImages = contents.filter(c => c.inlineData);
      let textPrompt = '';
      for (const content of contents) {
        if (content.text) {
          textPrompt = content.text;
          break;
        }
      }

      // Vertex AI Gemini 공식 형식으로 멀티모달 컨텐츠 구성
      const parts = [];
      
      // 텍스트 프롬프트 추가
      if (referenceImages.length > 0) {
        // 🔧 더욱 강화된 멀티캐릭터 일관성 프롬프트
        const characterCount = referenceImages.length;
        const characterText = characterCount === 1 ? "character" : `${characterCount} characters`;
        
        parts.push({
          text: `${textPrompt}

🎯 CRITICAL MULTI-CHARACTER REQUIREMENTS:
Look at the ${characterCount} reference images provided. Each image shows a DIFFERENT character that MUST appear in this scene.

📸 CHARACTER CONSISTENCY RULES:
- Reference Image 1: Copy this character's EXACT appearance (face, hair, clothing, body)
- Reference Image 2: Copy this character's EXACT appearance (face, hair, clothing, body)
${characterCount > 2 ? '- Reference Image 3: Copy this character\'s EXACT appearance (face, hair, clothing, body)' : ''}

🚨 MANDATORY REQUIREMENTS:
- BOTH/ALL characters from the reference images MUST be visible in the final image
- Each character must look IDENTICAL to their reference image
- Use the EXACT hairstyle, face shape, clothing, and colors from each reference
- Do NOT merge or blend characters - keep them as SEPARATE individuals
- Each character should be clearly distinguishable and recognizable

✅ SUCCESS CRITERIA: I should be able to point to each character in the final image and match them perfectly to their reference images.`
        });
        
        // 레퍼런스 이미지들 순서대로 추가
        referenceImages.forEach((refImage, index) => {
          parts.push({
            inlineData: {
              mimeType: refImage.inlineData.mimeType,
              data: refImage.inlineData.data
            }
          });
          console.log(`📸 Reference Image ${index + 1}: ${refImage.inlineData.mimeType}, ${Math.round(refImage.inlineData.data.length/1024)}KB`);
        });
        
        console.log(`📸 멀티캐릭터 레퍼런스 ${referenceImages.length}개를 균등하게 참조하도록 프롬프트 개선`);
      } else {
        parts.push({ text: textPrompt });
      }

      console.log('📤 Vertex AI 멀티모달 요청 전송 중...', {
        hasReferenceImages: referenceImages.length > 0,
        referenceCount: referenceImages.length,
        partsCount: parts.length
      });
      
      // Vertex AI API 호출 (공식 멀티모달 형식) - 재시도 로직 적용
      const response = await this.retryWithBackoff(async () => {
        return await this.genAI.models.generateContentStream({
          model: 'gemini-2.5-flash-image-preview',
          contents: [
            {
              role: 'USER',
              parts: parts
            }
          ],
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        });
      });

      console.log('✅ Vertex AI SDK 응답 수신 완료');

      // 스트리밍 응답에서 데이터 수집
      const generatedFiles = [];
      let totalTokens = 0;
      let allChunks = [];
      
      for await (const chunk of response) {
        console.log('🔍 Chunk:', {
          hasText: !!chunk.text,
          hasData: !!chunk.data, 
          hasCandidates: !!chunk.candidates,
          hasUsageMetadata: !!chunk.usageMetadata,
          hasPromptFeedback: !!chunk.promptFeedback,
          keys: Object.keys(chunk)
        });
        
        allChunks.push(chunk);
        
        // promptFeedback 확인 - 안전 필터링 감지
        if (chunk.promptFeedback) {
          console.log('🚨 PromptFeedback 감지:', JSON.stringify(chunk.promptFeedback, null, 2));
          
          // 안전 필터링으로 차단된 경우
          if (chunk.promptFeedback.blockReason) {
            console.log('🚫 안전 필터링으로 요청 차단됨:', chunk.promptFeedback.blockReason);
            throw new Error('CONTENT_POLICY_VIOLATION');
          }
          
          // 안전 등급이 문제가 있는 경우
          if (chunk.promptFeedback.safetyRatings) {
            for (const rating of chunk.promptFeedback.safetyRatings) {
              if (rating.probability === 'HIGH' || rating.probability === 'MEDIUM') {
                console.log('🚫 안전성 검사 실패:', rating.category, rating.probability);
                throw new Error('CONTENT_POLICY_VIOLATION');
              }
            }
          }
        }
        
        // 텍스트 처리
        if (chunk.text) {
          console.log('📝 텍스트:', chunk.text.substring(0, 50));
        }
        
        // candidates에서 이미지 처리 (chunk.data는 중복이므로 제거)
        if (chunk.candidates) {
          for (const candidate of chunk.candidates) {
            if (candidate.content?.parts) {
              for (const part of candidate.content.parts) {
                if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
                  console.log(`🖼️ 이미지 발견: ${part.inlineData.mimeType}, ${part.inlineData.data.length} chars`);
                  generatedFiles.push({
                    data: part.inlineData.data,
                    mimeType: part.inlineData.mimeType
                  });
                }
              }
            }
          }
        }
        
        // 토큰 사용량
        if (chunk.usageMetadata) {
          totalTokens = chunk.usageMetadata.totalTokenCount || 0;
        }
      }

      console.log('📊 스트림 완료:', {
        totalChunks: allChunks.length,
        generatedFiles: generatedFiles.length,
        totalTokens
      });

      if (generatedFiles.length === 0) {
        console.error('❌ 이미지가 생성되지 않았습니다');
        console.error('전체 청크:', allChunks.map((c, i) => ({
          index: i,
          keys: Object.keys(c),
          hasText: !!c.text,
          hasData: !!c.data,
          hasCandidates: !!c.candidates
        })));
        
        // 텍스트만 반환된 경우 (Google AI 동시 요청 제한) - 재시도 가능한 오류로 표시
        const hasTextOnly = allChunks.some(c => c.text && !c.data);
        if (hasTextOnly) {
          console.warn('⚠️ Google AI가 텍스트만 반환했습니다 (동시 요청 제한) - 재시도 필요');
          throw new Error('Google AI 동시 요청 제한 - 재시도 필요');
        }
        
        throw new Error('이미지가 생성되지 않았습니다');
      }

      console.log(`✅ 멀티모달 이미지 생성 성공: ${generatedFiles.length}개 이미지, ${totalTokens} 토큰 사용`);

      // 호환성을 위해 Gemini API 형식으로 반환
      return {
        response: {
          candidates: [{
            content: {
              parts: generatedFiles.map(file => ({
                inlineData: {
                  mimeType: file.mimeType,
                  data: file.data
                }
              }))
            },
            finishReason: 'STOP'
          }],
          usageMetadata: {
            totalTokenCount: totalTokens,
            promptTokenCount: Math.floor(totalTokens * 0.7),
            candidatesTokenCount: Math.floor(totalTokens * 0.3)
          }
        }
      };
      
    } catch (error) {
      console.error('❌ Vertex AI SDK 오류:', error);
      throw new Error(`Vertex AI SDK 호출 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }






  /**
   * 🎯 nanobananaMCP 방식 이미지 편집 (수정된 버전)
   * 이전 이미지를 참조하여 일관성을 유지하면서 새로운 패널 생성
   * 
   * @param previousImageUrl 이전 패널의 이미지 URL
   * @param editPrompt 편집 지시사항 (대본 내용)
   * @param characterReferences 캐릭터 레퍼런스 이미지들
   * @param aspectRatio 캔버스 비율
   * @param options 추가 옵션들
   */
  async editImageNanoBananaMCP(
    previousImageUrl: string,
    editPrompt: string,
    characterReferences: any[] = [],
    aspectRatio: '4:5' | '1:1' = '4:5',
    options?: {
      userId?: string;
      panelId?: number;
      sessionId?: string;
      elementImageUrls?: string[];
    }
  ): Promise<{
    imageUrl: string;
    thumbnailUrl: string;
    tokensUsed: number;
    generationTime: number;
  }> {
    const startTime = Date.now();
    const userId = options?.userId || 'anonymous';
    
    console.log(`🍌 nanobananaMCP 편집 시작:`, {
      previousImageUrl: previousImageUrl.substring(0, 100) + '...',
      editPrompt: editPrompt.substring(0, 100) + '...',
      characterReferencesCount: characterReferences.length,
      elementImageUrlsCount: options?.elementImageUrls?.length || 0,
      aspectRatio,
      panelId: options?.panelId
    });

    try {
      // 🎯 nanobananaMCP 핵심: 이전 이미지 + 편집 지시사항
      // callGoogleAI 메서드와 동일한 형식으로 contents 구성
      const contents: any[] = [];

      // 1️⃣ 이전 이미지를 첫 번째로 추가 (nanobananaMCP 방식의 핵심)
      console.log('📸 이전 이미지 로드 중...');
      
      let imageData: string;
      let mimeType: string = 'image/jpeg';
      
      if (previousImageUrl.startsWith('data:image/')) {
        const [headerPart, base64Part] = previousImageUrl.split(',');
        imageData = base64Part;
        const mimeMatch = headerPart.match(/data:([^;]+)/);
        if (mimeMatch) mimeType = mimeMatch[1];
        console.log(`✅ 이전 이미지 Data URL 처리 성공: ${mimeType}`);
      } else {
        imageData = await this.downloadAndConvertImage(previousImageUrl);
        console.log(`✅ 이전 이미지 HTTP URL 다운로드 성공`);
      }

      // 이전 이미지 데이터 검증
      if (!imageData) {
        throw new Error('이전 이미지 로드에 실패했습니다');
      }

      // callGoogleAI와 동일한 형식으로 구성
      contents.push({
        inlineData: {
          mimeType: mimeType,
          data: imageData
        }
      });

      // 2️⃣ 남은 2자리에 최적화해서 이미지 추가 (Gemini 3개 제한 준수)
      let successfulElementImages = 0;
      let successfulReferenceImages = 0;
      const remainingSlots = 2; // 이전 이미지(1개) + 추가 이미지(2개) = 총 3개
      
      // 우선순위 기반 이미지 선택 로직
      const prioritizedImages: Array<{type: 'element' | 'character', imageUrl: string, priority: number}> = [];
      
      // 요소 이미지들을 우선순위 큐에 추가 (요소가 더 중요)
      if (options?.elementImageUrls && options.elementImageUrls.length > 0) {
        console.log(`🎨 요소 이미지 ${options.elementImageUrls.length}개 발견`);
        options.elementImageUrls.forEach((imageUrl, index) => {
          prioritizedImages.push({
            type: 'element',
            imageUrl,
            priority: 100 - index // 첫 번째 요소가 가장 높은 우선순위
          });
        });
      }
      
      // 캐릭터 레퍼런스 이미지들을 우선순위 큐에 추가
      if (characterReferences.length > 0) {
        console.log(`🎭 캐릭터 레퍼런스 ${characterReferences.length}개 발견`);
        characterReferences.forEach((ref, index) => {
          if (ref.imageUrl) {
            prioritizedImages.push({
              type: 'character',
              imageUrl: ref.imageUrl,
              priority: 50 - index // 요소보다 낮은 우선순위
            });
          }
        });
      }
      
      // 우선순위 정렬 (높은 우선순위 먼저)
      prioritizedImages.sort((a, b) => b.priority - a.priority);
      
      // 🎯 최대 2개만 선택해서 추가 (딱 3개 제한 준수)
      console.log(`🎯 총 ${prioritizedImages.length}개 이미지 중 상위 ${Math.min(remainingSlots, prioritizedImages.length)}개 선택`);
      
      for (let i = 0; i < Math.min(remainingSlots, prioritizedImages.length); i++) {
        const imageItem = prioritizedImages[i];
        
        try {
          let imageData: string;
          let mimeType: string = 'image/jpeg';
          
          if (imageItem.imageUrl.startsWith('data:image/')) {
            const [headerPart, base64Part] = imageItem.imageUrl.split(',');
            imageData = base64Part;
            const mimeMatch = headerPart.match(/data:([^;]+)/);
            if (mimeMatch) mimeType = mimeMatch[1];
          } else {
            imageData = await this.downloadAndConvertImage(imageItem.imageUrl);
          }
          
          contents.push({
            inlineData: {
              mimeType: mimeType,
              data: imageData
            }
          });
          
          if (imageItem.type === 'element') {
            successfulElementImages++;
            console.log(`✅ 요소 이미지 추가 성공 (우선순위 ${imageItem.priority})`);
          } else {
            successfulReferenceImages++;
            console.log(`✅ 캐릭터 레퍼런스 이미지 추가 성공 (우선순위 ${imageItem.priority})`);
          }
        } catch (error) {
          console.warn(`⚠️ 우선순위 ${imageItem.priority} ${imageItem.type} 이미지 로드 실패:`, error);
        }
      }
      
      console.log(`🎯 최적화 완료: 총 ${contents.length}개 이미지 (이전:1 + 요소:${successfulElementImages} + 캐릭터:${successfulReferenceImages} = ${contents.length}/3)`);

      // 4️⃣ nanobananaMCP 편집 지시사항 (차별화와 일관성의 균형)
      const panelInfo = options?.panelId ? `패널 ${options.panelId}` : '다음 패널';
      const elementInfo = successfulElementImages > 0 ? `(${successfulElementImages}개 요소 참조 중)` : '';
      const characterInfo = successfulReferenceImages > 0 ? `(${successfulReferenceImages}명 캐릭터 참조 중)` : '';
      
      const nanoBananaPrompt = `🎯 NANOBANA MCP 편집 모드: ${panelInfo} - 이전 이미지를 기반으로 명확히 다른 다음 장면 생성 ${elementInfo} ${characterInfo}

📋 현재 패널의 새로운 장면:
${editPrompt}

🔄 ESSENTIAL CHANGES (반드시 변경):
1. **장면 전환**: 이전 컷과 확실히 구별되는 새로운 장면으로 변경
2. **액션 변화**: 캐릭터의 동작, 표정, 포즈를 현재 대본에 맞게 완전히 새롭게 구성
3. **시점 변화**: 카메라 앵글, 거리, 구도를 다르게 설정하여 시각적 다양성 확보 
4. **상황 전개**: 스토리 진행에 따른 명확한 상황 변화 표현
5. **요소 활용**: ${successfulElementImages > 0 ? '제공된 요소 이미지들을 장면에 자연스럽게 통합' : '장면에 맞는 배경 요소들 구성'}

🎨 CONSISTENCY RULES (유지 사항):
1. **아트 스타일**: 동일한 웹툰 그림체, 선 굵기, 채색 방식 유지
2. **캐릭터 아이덴티티**: ${successfulReferenceImages > 0 ? '레퍼런스 이미지의 캐릭터 외형 정확히 유지' : '기본 캐릭터 특징 유지'} (표정/포즈는 변경)
3. **색상 톤**: 전체적인 색상 팔레트와 분위기 톤 유지

🚀 DIFFERENTIATION FOCUS:
- 이전 이미지와 같은 포즈/표정 절대 금지
- 새로운 동작과 감정 표현으로 스토리 진행감 강화
- 다른 카메라 앵글 사용으로 시각적 흥미 증대
- 배경이나 환경도 상황에 맞게 자연스럽게 변화
- ${panelInfo}에 맞는 독특한 구성과 연출

❌ 절대 금지:
- 텍스트, 말풍선, 글자 추가 금지
- 이전 컷과 동일한 포즈/표정 재사용 금지
- 정적이고 변화 없는 구성 금지
- 무의미한 반복이나 복사

📐 비율: ${aspectRatio === '1:1' ? '정사각형 (1:1)' : '세로형 (4:5)'}

결과: ${panelInfo}를 위한 일관된 스타일의 완전히 새로운 장면 - 스토리 진행이 명확히 느껴지는 역동적인 웹툰 컷`;

      // 강화된 텍스트 차단 안전장치 적용
      const safeguardedPrompt = this.addAntiTextSafeguards(nanoBananaPrompt);
      contents.push({ text: safeguardedPrompt });

      console.log(`✅ contents 구성 완료: ${contents.length}개 항목`, {
        previousImage: 1,
        elementImages: successfulElementImages,
        characterReferences: successfulReferenceImages,
        textPrompt: 1,
        totalContents: contents.length
      });

      // 5️⃣ callGoogleAI 메서드 사용 (기존 generateWebtoonPanel과 동일한 방식)
      console.log(`🚀 Vertex AI SDK ${panelInfo} 편집 호출...`);
      const result = await this.callGoogleAI(contents);
      const response = result.response;
      
      // 실제 토큰 사용량 추출
      let actualTokensUsed = 0;
      if (response.usageMetadata) {
        actualTokensUsed = response.usageMetadata.totalTokenCount || 0;
        console.log('🔢 편집 토큰 사용량:', actualTokensUsed);
      } else {
        actualTokensUsed = GEMINI_COST.TOKENS_PER_IMAGE * 1.2; // 추정치 사용
        console.warn('⚠️ 토큰 사용량을 가져올 수 없어 추정치 사용:', actualTokensUsed);
      }
      
      // 응답 검증
      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('편집된 이미지 생성 결과가 없습니다');
      }
      
      const candidate = candidates[0];
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        if (candidate.finishReason === 'PROHIBITED_CONTENT' || candidate.finishReason === 'SAFETY') {
          throw new Error('CONTENT_POLICY_VIOLATION');
        }
        throw new Error(`이미지 편집이 중단됨: ${candidate.finishReason}`);
      }
      
      if (!candidate.content || !candidate.content.parts) {
        throw new Error('편집된 이미지 데이터가 없습니다');
      }
      
      // 이미지 데이터 찾기
      let editedImageData: string | null = null;
      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
          editedImageData = part.inlineData.data;
          break;
        }
      }
      
      if (!editedImageData) {
        throw new Error('편집된 이미지 데이터를 찾을 수 없습니다');
      }

      // 5️⃣ 이미지 최적화 및 저장 (generateWebtoonPanel과 동일한 방식)
      const { imageUrl, thumbnailUrl } = await this.saveGeneratedImage(
        editedImageData,
        userId,
        aspectRatio
      );

      const generationTime = Date.now() - startTime;
      console.log(`✅ nanobananaMCP ${panelInfo} 편집 완료`, {
        generationTime: `${generationTime}ms`,
        tokensUsed: actualTokensUsed,
        elementImages: successfulElementImages,
        characterReferences: successfulReferenceImages,
        imageUrl: imageUrl.substring(0, 50) + '...'
      });

      return {
        imageUrl,
        thumbnailUrl,
        tokensUsed: actualTokensUsed,
        generationTime
      };

    } catch (error) {
      console.error('❌ nanobananaMCP 편집 실패:', error);
      throw error;
    }
  }

  /**
   * 🎯 기존 editImage (호환성 유지)
   */
  async editImage(
    previousImageUrl: string,
    editPrompt: string,
    options?: {
      userId?: string;
      projectId?: string;
      panelId?: number;
      sessionId?: string;
      selectedCharacterIds?: string[];
      referenceImages?: string[];
      elementImageUrls?: string[];
      characterDescriptions?: Map<string, string>;
      style?: string;
      negativePrompt?: string;
      aspectRatio?: '4:5' | '1:1';
      width?: number;
      height?: number;
    }
  ): Promise<{
    imageUrl: string;
    thumbnailUrl: string;
    tokensUsed: number;
    generationTime: number;
    detectedCharacters?: string[];
    sessionId?: string;
  }> {
    // nanobananaMCP 방식으로 리다이렉트
    const characterReferences = options?.referenceImages?.map(url => ({ imageUrl: url })) || [];
    
    const result = await this.editImageNanoBananaMCP(
      previousImageUrl,
      editPrompt,
      characterReferences,
      options?.aspectRatio || '4:5',
      {
        userId: options?.userId,
        panelId: options?.panelId,
        sessionId: options?.sessionId
      }
    );

    return {
      ...result,
      detectedCharacters: [],
      sessionId: options?.sessionId
    };
  }

  /**
   * 🎯 기존 코드 (삭제될 예정)
   */
  async editImageOld(
    previousImageUrl: string,
    editPrompt: string,
    options?: {
      userId?: string;
      projectId?: string;
      panelId?: number;
      sessionId?: string;
      selectedCharacterIds?: string[];
      referenceImages?: string[];
      elementImageUrls?: string[];
      characterDescriptions?: Map<string, string>;
      style?: string;
      negativePrompt?: string;
      aspectRatio?: '4:5' | '1:1';
      width?: number;
      height?: number;
    }
  ): Promise<{
    imageUrl: string;
    thumbnailUrl: string;
    tokensUsed: number;
    generationTime: number;
    detectedCharacters?: string[];
    sessionId?: string;
  }> {
    const startTime = Date.now();
    
    const userId = options?.userId || 'anonymous';
    const projectId = options?.projectId || 'default';
    
    console.log(`🎭 이미지 편집 시작: 프로젝트 ${projectId}, 유저 ${userId}`);
    console.log(`📸 이전 이미지 참조: ${previousImageUrl.substring(0, 100)}...`);
    
    try {
      // 🧠 프로젝트 컨텍스트 로드 및 컨텍스트 인식 프롬프트 생성
      let contextAwarePrompt = editPrompt;
      if (options?.projectId && options?.panelId && userId !== 'anonymous') {
        console.log(`🧠 프로젝트 컨텍스트 적용: ${options.projectId} - 패널 ${options.panelId}`);
        
        contextAwarePrompt = await ProductionContextManager.buildOptimizedPrompt(
          options.projectId,
          userId,
          editPrompt,
          options.panelId
        );
        
        console.log(`🧠 컨텍스트 인식 프롬프트 길이: ${contextAwarePrompt.length}자`);
      }
      
      // 편집용 프롬프트 구성 (nanobananaMCP 방식)
      const finalEditPrompt = `이 이미지를 기반으로 다음과 같이 수정해주세요:

${contextAwarePrompt}

중요한 지시사항:
- 기존 이미지의 배경, 장소, 전체적인 구도는 최대한 유지하세요
- 캐릭터의 기본 외모와 의상은 동일하게 유지하세요  
- 오직 요청된 행동, 표정, 포즈만 변경하세요
- 웹툰 스타일의 일관성을 유지하세요
- 말풍선이나 텍스트는 추가하지 마세요`;

      console.log(`📝 편집 프롬프트: ${finalEditPrompt.substring(0, 200)}...`);
      
      // 비율 설정
      const aspectRatio = options?.aspectRatio || '4:5';
      console.log(`🎨 이미지 편집 시작: ${aspectRatio} 비율`);
      
      // Gemini API를 위한 컨텐츠 구성 - 이전 이미지를 첫 번째로 추가
      const contents: any[] = [];
      
      // 1️⃣ 이전 이미지를 최우선으로 추가 (nanobananaMCP 방식)
      try {
        let imageData: string;
        let mimeType: string = 'image/jpeg';
        
        if (previousImageUrl.startsWith('data:image/')) {
          // Data URL인 경우
          const [headerPart, base64Part] = previousImageUrl.split(',');
          imageData = base64Part;
          const mimeMatch = headerPart.match(/data:([^;]+)/);
          if (mimeMatch) {
            mimeType = mimeMatch[1];
          }
        } else {
          // HTTP URL인 경우
          const response = await fetch(previousImageUrl);
          if (!response.ok) {
            throw new Error(`이전 이미지 로드 실패: ${response.status}`);
          }
          const buffer = await response.arrayBuffer();
          const base64String = Buffer.from(buffer).toString('base64');
          imageData = base64String;
          
          const contentType = response.headers.get('content-type');
          if (contentType) {
            mimeType = contentType;
          }
        }
        
        contents.push({
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: imageData
              }
            }
          ]
        });
        
        console.log(`✅ 이전 이미지 로드 성공 (${mimeType})`);
        
      } catch (error) {
        console.error('❌ 이전 이미지 로드 실패:', error);
        throw new Error(`이전 이미지를 로드할 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      }
      
      // 2️⃣ 캐릭터 레퍼런스 이미지 추가 (필요시)
      if (options?.referenceImages && options.referenceImages.length > 0) {
        console.log(`🎭 캐릭터 레퍼런스 이미지 ${options.referenceImages.length}개 추가`);
        
        for (const refUrl of options.referenceImages) {
          try {
            let imageData: string;
            let mimeType: string = 'image/jpeg';
            
            if (refUrl.startsWith('data:image/')) {
              const [headerPart, base64Part] = refUrl.split(',');
              imageData = base64Part;
              const mimeMatch = headerPart.match(/data:([^;]+)/);
              if (mimeMatch) {
                mimeType = mimeMatch[1];
              }
            } else {
              const response = await fetch(refUrl);
              if (!response.ok) continue;
              const buffer = await response.arrayBuffer();
              imageData = Buffer.from(buffer).toString('base64');
              const contentType = response.headers.get('content-type');
              if (contentType) {
                mimeType = contentType;
              }
            }
            
            contents.push({
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: imageData
                  }
                }
              ]
            });
            
          } catch (error) {
            console.warn(`⚠️ 레퍼런스 이미지 로드 실패: ${refUrl}`, error);
          }
        }
      }
      
      // 3️⃣ 편집 지시사항 텍스트 추가
      contents.push({
        role: 'user',
        parts: [{ text: finalEditPrompt }]
      });
      
      // Gemini API 호출
      const { width, height } = getRecommendedDimensions(aspectRatio);
      
      console.log('🚀 Vertex AI SDK 호출 시작... {', 
        `model: '${this.model}', contentCount: ${contents.length}, hasReferenceImages: true`
      );
      
      const response = await this.genAI.models.generateContentStream({
        model: this.model,
        contents: contents,
        config: {
          responseModalities: ['IMAGE'],
          imageGenerationConfig: {
            aspectRatio: aspectRatio === '1:1' ? '1:1' : '4:5'
          }
        }
      });
      
      let imageData = '';
      let tokensUsed = 0;
      let candidatesTokens = 0;
      let promptTokens = 0;
      
      for await (const chunk of response) {
        console.log('🔍 Chunk:', {
          hasText: !!chunk.candidates?.[0]?.content?.parts?.some(p => p.text),
          hasData: !!chunk.candidates?.[0]?.content?.parts?.some(p => p.inlineData),
          hasCandidates: !!chunk.candidates?.length,
          hasUsageMetadata: !!chunk.usageMetadata,
          hasPromptFeedback: !!chunk.promptFeedback,
          keys: Object.keys(chunk)
        });

        if (chunk.candidates?.[0]?.content?.parts) {
          for (const part of chunk.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              const dataSize = part.inlineData.data.length;
              console.log(`🖼️ 이미지 발견: ${part.inlineData.mimeType}, ${dataSize} chars`);
              imageData += part.inlineData.data;
            }
          }
        }
        
        if (chunk.usageMetadata) {
          candidatesTokens = chunk.usageMetadata.candidatesTokens || 0;
          promptTokens = chunk.usageMetadata.promptTokens || 0;
          tokensUsed = chunk.usageMetadata.totalTokens || (candidatesTokens + promptTokens);
        }
      }
      
      if (!imageData) {
        throw new Error('이미지 데이터를 받지 못했습니다');
      }
      
      const result = {
        imageData: Buffer.from(imageData, 'base64'),
        tokensUsed
      };
      
      // 이미지 최적화 및 업로드
      const optimizedImage = await this.webpOptimizer.optimizeAndUpload(
        result.imageData,
        `edit_${projectId}_${options?.panelId || Date.now()}`,
        userId
      );
      
      const generationTime = Date.now() - startTime;
      console.log(`✅ 이미지 편집 완료 (${generationTime}ms)`);
      
      return {
        imageUrl: optimizedImage.url,
        thumbnailUrl: optimizedImage.thumbnailUrl,
        tokensUsed: result.tokensUsed,
        generationTime,
        sessionId: options?.sessionId
      };
      
    } catch (error) {
      console.error('❌ 이미지 편집 실패:', error);
      throw error;
    }
  }

  /**
   * 🎨 이미지 생성 메서드 (generateWebtoonPanel의 alias)
   * 배치 생성에서 사용하기 위한 간단한 인터페이스
   */
  async generateImage(
    prompt: string,
    aspectRatio: '4:5' | '1:1' = '4:5',
    characterReferences?: any[],
    options?: {
      requestType?: string;
      panelIndex?: number;
      totalPanels?: number;
      userId?: string;
      projectId?: string;
      sessionId?: string;
    }
  ): Promise<{
    imageUrl: string;
    thumbnailUrl?: string;
    tokensUsed: number;
    generationTime?: number;
  }> {
    console.log(`🎨 generateImage 호출: ${prompt.substring(0, 50)}...`);
    
    // generateWebtoonPanel 호출
    const result = await this.generateWebtoonPanel(prompt, {
      userId: options?.userId,
      projectId: options?.projectId,
      panelId: options?.panelIndex,
      sessionId: options?.sessionId,
      aspectRatio,
      referenceImages: characterReferences?.map(ref => ref.imageUrl).filter(Boolean) || []
    });
    
    return {
      imageUrl: result.imageUrl,
      thumbnailUrl: result.thumbnailUrl,
      tokensUsed: result.tokensUsed,
      generationTime: result.generationTime
    };
  }

  /**
   * Vertex AI를 사용한 텍스트 생성 (대본 생성용) - 세션 격리 적용
   */
  async generateText(
    prompt: string, 
    options?: {
      userId?: string;
      projectId?: string;
      sessionId?: string;
    }
  ): Promise<{ text: string; tokensUsed: number; sessionId?: string }> {
    try {
      console.log('🔤 Vertex AI 텍스트 생성 시작...');
      
      // 🧠 프로덕션 컨텍스트 시스템 적용
      const userId = options?.userId || 'anonymous';
      const projectId = options?.projectId || 'default';
      
      console.log(`📝 텍스트 생성 시작: 프로젝트 ${projectId}, 유저 ${userId}`);
      
      // Vertex AI 텍스트 생성 API 호출 - 이미지 생성과 동일한 방식 사용
      const response = await this.retryWithBackoff(async () => {
        return await this.genAI.models.generateContentStream({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'USER',
              parts: [{ text: prompt }]
            }
          ],
          config: {
            responseModalities: ['TEXT'],
          },
        });
      });

      console.log('✅ Vertex AI SDK 텍스트 응답 수신 완료');

      // 스트리밍 응답에서 텍스트 데이터 수집
      let generatedText = '';
      let totalTokens = 0;
      let allChunks = [];
      
      for await (const chunk of response) {
        console.log('🔍 텍스트 Chunk:', {
          hasText: !!chunk.text,
          hasUsageMetadata: !!chunk.usageMetadata,
          hasPromptFeedback: !!chunk.promptFeedback,
          keys: Object.keys(chunk)
        });
        
        allChunks.push(chunk);
        
        // 텍스트 데이터 수집
        if (chunk.text) {
          generatedText += chunk.text;
          console.log('📝 텍스트 수신:', chunk.text.substring(0, 100) + '...');
        }
        
        // 토큰 사용량 수집
        if (chunk.usageMetadata) {
          totalTokens = chunk.usageMetadata.totalTokenCount || 0;
        }
        
        // promptFeedback 확인 - 안전 필터링 감지
        if (chunk.promptFeedback?.blockReason) {
          console.log('🚫 안전 필터링으로 요청 차단됨:', chunk.promptFeedback.blockReason);
          throw new Error('CONTENT_POLICY_VIOLATION');
        }
      }

      if (!generatedText || generatedText.trim().length === 0) {
        throw new Error('Vertex AI 텍스트 응답이 없습니다');
      }

      const tokensUsed = totalTokens || 1000; // 기본값 설정
      
      // 📋 토큰 사용량 기록
      console.log(`📊 텍스트 생성 토큰 사용량: ${tokensUsed}, 프로젝트: ${projectId}`);
      
      console.log('✅ Vertex AI 텍스트 생성 완료:', {
        textLength: generatedText.length,
        tokensUsed,
        chunksProcessed: allChunks.length
      });
      console.log(`🧠 프로덕션 컨텍스트 시스템 텍스트 생성 완료`);

      return {
        text: generatedText,
        tokensUsed
        // sessionId 제거 - 더 이상 세션 기반 시스템 사용 안함
      };
      
    } catch (error) {
      console.error('❌ Vertex AI 텍스트 생성 실패:', error);
      console.error('❌ 에러 상세 정보:', {
        errorType: error?.constructor?.name,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        hasCredentials: !!this.genAI,
        promptLength: prompt?.length
      });
      
      // 더 구체적인 에러 메시지 제공
      if (error instanceof Error) {
        if (error.message.includes('UNAUTHENTICATED') || error.message.includes('authentication')) {
          throw new Error('Vertex AI 인증 실패: API 키 또는 서비스 계정을 확인해주세요');
        }
        if (error.message.includes('PERMISSION_DENIED')) {
          throw new Error('Vertex AI 권한 부족: 프로젝트 설정을 확인해주세요');
        }
        if (error.message.includes('QUOTA_EXCEEDED')) {
          throw new Error('Vertex AI 할당량 초과: 사용량을 확인해주세요');
        }
        if (error.message.includes('timeout') || error.message.includes('deadline')) {
          throw new Error('Vertex AI 요청 시간 초과: 잠시 후 다시 시도해주세요');
        }
      }
      
      throw new Error(`Vertex AI 텍스트 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  /**
   * 생성된 패널에 대한 간단한 설명 생성 (컨텍스트 관리용)
   */
  private generatePanelDescription(prompt: string, options?: any): string {
    const characters = options?.selectedCharacterIds?.length 
      ? `등장인물: ${options.selectedCharacterIds.length}명` 
      : '등장인물 없음';
    
    const aspectRatio = options?.aspectRatio || '4:5';
    
    // 프롬프트에서 핵심 키워드 추출
    const cleanPrompt = prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt;
    
    return `${cleanPrompt} (${characters}, ${aspectRatio} 비율)`;
  }

  /**
   * 간단한 프롬프트 생성 (하위 호환성)
   */
  generatePrompt(prompt: string, options?: any): string {
    return this.buildEnhancedPrompt(prompt, options);
  }
}

/**
 * 🔐 사용자별 격리된 NanoBananaService 팩토리
 * 멀티테넌트 환경에서 완전한 사용자 격리 보장
 */
export class NanoBananaServiceFactory {
  private static instances = new Map<string, NanoBananaService>();
  
  /**
   * 사용자별 격리된 서비스 인스턴스 생성/반환
   */
  static getUserInstance(userId: string, sessionId?: string): NanoBananaService {
    // 세션별 격리 (더 강한 격리)
    const instanceKey = sessionId ? `${userId}-${sessionId}` : userId;
    
    if (!this.instances.has(instanceKey)) {
      console.log(`🔐 새로운 사용자별 NanoBananaService 인스턴스 생성: ${instanceKey}`);
      this.instances.set(instanceKey, new NanoBananaService());
    }
    
    return this.instances.get(instanceKey)!;
  }
  
  /**
   * 메모리 정리: 만료된 세션 정리
   */
  static cleanup(sessionId?: string) {
    if (sessionId) {
      const keysToDelete = Array.from(this.instances.keys()).filter(key => key.includes(sessionId));
      keysToDelete.forEach(key => {
        this.instances.delete(key);
        console.log(`🧹 만료된 NanoBananaService 인스턴스 정리: ${key}`);
      });
    }
  }
  
  /**
   * 인스턴스 통계
   */
  static getStats() {
    return {
      activeInstances: this.instances.size,
      instanceKeys: Array.from(this.instances.keys())
    };
  }
}

// 🔐 안전한 팩토리 패턴으로 변경
// 하위 호환성을 위한 기본 인스턴스 (개발용)
let _nanoBananaService: NanoBananaService | null = null;

function createNanoBananaService(): NanoBananaService {
  try {
    if (!_nanoBananaService) {
      console.log('🔧 NanoBananaService 초기화 시작...');
      _nanoBananaService = new NanoBananaService();
      console.log('✅ NanoBananaService 초기화 완료');
    }
    return _nanoBananaService;
  } catch (error) {
    console.error('❌ NanoBananaService 초기화 실패:', error);
    throw new Error(`NanoBananaService 초기화 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const nanoBananaService = createNanoBananaService();