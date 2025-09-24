import { GoogleGenAI } from '@google/genai';
import { generateOptimizedPrompt, getRecommendedDimensions, type AspectRatio } from './prompt-templates';
import { WebPOptimizer } from '@/lib/image/webp-optimizer';
import { createClient } from '@/lib/supabase/server';

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
  
  constructor() {
    // Vertex AI 프로젝트 설정 확인
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
    
    if (!projectId) {
      throw new Error("GOOGLE_CLOUD_PROJECT_ID or GOOGLE_CLOUD_PROJECT is required for Vertex AI");
    }
    
    this.genAI = new GoogleGenAI({
      project: projectId,
      location: location,
    });
    this.webpOptimizer = new WebPOptimizer();
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
   * 웹툰 패널 생성 (캐릭터 레퍼런스 지원)
   */
  async generateWebtoonPanel(
    prompt: string, 
    options?: {
      userId?: string;
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
  }> {
    const startTime = Date.now();
    
    try {
      // 캐릭터 정보 로깅
      if (options?.selectedCharacterIds?.length) {
        console.log(`🎭 선택된 캐릭터: ${options.selectedCharacterIds.length}개`);
      }
      if (options?.referenceImages?.length) {
        console.log(`📚 레퍼런스 이미지: ${options.referenceImages.length}개`);
      }

      // 사용자 프롬프트 전처리 (텍스트 관련 키워드 필터링)
      const cleanedPrompt = this.preprocessUserPrompt(prompt);
      
      // 향상된 프롬프트 생성
      const enhancedPrompt = this.buildEnhancedPrompt(cleanedPrompt, options);
      console.log(`📝 향상된 프롬프트: ${enhancedPrompt}`);
      
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
      const finalPrompt = this.addAntiTextSafeguards(enhancedPrompt);
      contents.push({ text: finalPrompt });
      
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
        if (candidate.finishReason === 'PROHIBITED_CONTENT') {
          console.log('🚫 콘텐츠 정책 위반으로 이미지 생성이 거부되었습니다');
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
      
      console.log(`✅ 이미지 생성 완료: ${imageUrl} (${generationTime}ms)`);
      console.log(`🔢 Vertex AI SDK 실제 토큰 사용량: ${actualTokensUsed}`);
      
      return {
        imageUrl,
        thumbnailUrl,
        tokensUsed: actualTokensUsed, // 실제 Google Gemini API 토큰 사용량 반환
        generationTime,
        detectedCharacters: options?.selectedCharacterIds
      };
      
    } catch (error) {
      console.error("🔥 Vertex AI SDK 이미지 생성 오류:", error);
      console.error("🔍 에러 상세:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID ? '***설정됨***' : '❌설정안됨❌',
        location: process.env.GOOGLE_CLOUD_LOCATION || 'global'
      });
      
      throw new Error(`웹툰 패널 생성에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
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
    
    // 캐릭터 정보가 있다면 프롬프트에 추가
    let characterInstructions = '';
    if (options?.referenceImages?.length > 0) {
      characterInstructions = `
[Character Reference Information]
Use the provided reference images to maintain character consistency.
Keep the character's appearance, style, and proportions exactly as shown in references.
Adapt to the scene while keeping character identity intact.

[Character Consistency Requirements]
위에 명시된 캐릭터들은 제공된 레퍼런스 이미지와 정확히 일치해야 합니다.
각 캐릭터의 고유한 특징을 반드시 유지하세요.
레퍼런스 이미지의 스타일과 외형을 그대로 따라주세요.
현재 비율(${aspectRatio})에 최적화된 구도로 생성하세요.
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
        const supabase = await createClient();
        
        // 파일 이름 생성
        const mainImagePath = `generated/${userId}/${aspectRatio}-${timestamp}.webp`;
        const thumbnailPath = `generated/${userId}/${aspectRatio}-${timestamp}-thumb.webp`;
        
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
        parts.push({
          text: `Use the character design and style shown in the reference image to generate: ${textPrompt}

CRITICAL CHARACTER CONSISTENCY REQUIREMENTS:
- Maintain exact character appearance from the reference image
- Keep character proportions, facial features, and styling identical
- Adapt the character to the new scene while preserving their visual identity
- Use the reference image as the definitive guide for character design`
        });
        
        // 레퍼런스 이미지들 추가
        for (const refImage of referenceImages) {
          parts.push({
            inlineData: {
              mimeType: refImage.inlineData.mimeType,
              data: refImage.inlineData.data
            }
          });
        }
        
        console.log(`📸 레퍼런스 이미지 ${referenceImages.length}개를 Vertex AI 멀티모달 형식으로 전달`);
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
          keys: Object.keys(chunk)
        });
        
        allChunks.push(chunk);
        
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
   * Vertex AI를 사용한 텍스트 생성 (대본 생성용)
   */
  async generateText(prompt: string): Promise<{ text: string; tokensUsed: number }> {
    try {
      console.log('🔤 Vertex AI 텍스트 생성 시작...');
      
      // Vertex AI 텍스트 생성 API 호출 - 재시도 로직 적용
      const response = await this.retryWithBackoff(async () => {
        return await this.genAI.models.generateContent({
          model: 'gemini-2.5-flash', // 텍스트 생성용 모델 (최신 안정 버전)
          contents: [
            {
              role: 'USER',
              parts: [{ text: prompt }]
            }
          ]
        });
      });

      // Vertex AI SDK 응답 구조 확인
      console.log('🔍 Vertex AI 텍스트 응답 구조:', {
        hasResponse: !!response,
        hasCandidates: !!response.candidates,
        candidateCount: response.candidates?.length || 0
      });

      const candidates = response.candidates;
      const usageMetadata = response.usageMetadata;

      if (!candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Vertex AI 텍스트 응답이 없습니다');
      }

      const generatedText = candidates[0].content.parts[0].text;
      const tokensUsed = usageMetadata?.totalTokenCount || 0;
      
      console.log('✅ Vertex AI 텍스트 생성 완료:', {
        textLength: generatedText.length,
        tokensUsed,
        promptTokens: usageMetadata?.promptTokenCount || 0,
        candidatesTokens: usageMetadata?.candidatesTokenCount || 0
      });

      return {
        text: generatedText,
        tokensUsed
      };
      
    } catch (error) {
      console.error('❌ Vertex AI 텍스트 생성 실패:', error);
      throw new Error(`Vertex AI 텍스트 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  /**
   * 간단한 프롬프트 생성 (하위 호환성)
   */
  generatePrompt(prompt: string, options?: any): string {
    return this.buildEnhancedPrompt(prompt, options);
  }
}

// 싱글톤 인스턴스 내보내기
export const nanoBananaService = new NanoBananaService();