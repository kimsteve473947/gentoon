import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { generateOptimizedPrompt, getRecommendedDimensions, type AspectRatio } from './prompt-templates';

// Gemini 토큰 비용 정보 (token-manager.ts와 일치)
const GEMINI_COST = {
  TOKENS_PER_IMAGE: 1290,
  COST_PER_MILLION: 30,
  USD_TO_KRW: 1330,
  COST_PER_IMAGE_KRW: 52,
} as const;

/**
 * Nano Banana (Gemini 2.5 Flash Image Preview) Service - 실제 이미지 생성
 * 
 * Google Gemini 2.5 Flash Image Preview 모델을 사용한 웹툰 이미지 생성
 * 캐릭터 레퍼런스 이미지 지원으로 일관성 있는 캐릭터 생성
 */
export class NanoBananaService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  
  constructor() {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("Google API key is required");
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Gemini 2.5 Flash Image Preview 모델 사용 (이미지 생성)
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash-image-preview" // 이미지 생성 전용 모델
    });
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
      characterDescriptions?: Map<string, string>;
      style?: string;
      negativePrompt?: string;
      aspectRatio?: '4:5' | '1:1' | '16:9';
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
      
      // 레퍼런스 이미지가 있다면 추가 (캐릭터 일관성을 위해)
      let successfulReferenceImages = 0;
      if (options?.referenceImages && options.referenceImages.length > 0) {
        console.log(`🖼️  레퍼런스 이미지 ${options.referenceImages.length}개를 Gemini에 전달 시도`);
        
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
              
              console.log(`✅ 레퍼런스 이미지 Data URL 처리 성공: ${mimeType}, ${Math.round(base64Part.length/1024)}KB`);
            } else {
              // HTTP URL인 경우 기존 로직 사용
              imageData = await this.downloadAndConvertImage(imageUrl);
              console.log(`✅ 레퍼런스 이미지 HTTP URL 다운로드 성공: ${imageUrl}`);
            }
            
            contents.push({
              inlineData: {
                mimeType: mimeType,
                data: imageData
              }
            });
            successfulReferenceImages++;
          } catch (error) {
            console.warn(`⚠️  레퍼런스 이미지 로드 실패 (계속 진행): ${imageUrl}`, error);
          }
        }
        
        console.log(`📊 레퍼런스 이미지 로드 결과: ${successfulReferenceImages}/${options.referenceImages.length}개 성공`);
      }
      
      // 텍스트 프롬프트 추가 (강화된 텍스트 차단 프롬프트)
      const finalPrompt = this.addAntiTextSafeguards(enhancedPrompt);
      contents.push({ text: finalPrompt });
      
      // 레퍼런스 이미지가 없으면 경고하지만 계속 진행
      if (successfulReferenceImages === 0 && options?.referenceImages && options.referenceImages.length > 0) {
        console.warn('⚠️  모든 레퍼런스 이미지 로드 실패 - 텍스트 프롬프트만으로 생성 진행');
      }
      
      console.log(`🚀 Gemini API 호출 시작 (컨텐츠 ${contents.length}개, 레퍼런스 이미지 ${successfulReferenceImages}개)`);
      console.log(`📋 최종 프롬프트 미리보기: ${finalPrompt.substring(0, 500)}...`);
      
      // Gemini 2.5 Flash Image Preview API 호출
      console.log('🌟 Gemini API 요청 상세:', {
        model: 'gemini-2.5-flash-image-preview',
        contentCount: contents.length,
        hasReference: contents.some(c => c.inlineData),
        aspectRatio
      });
      
      const result = await this.model.generateContent(contents);
      console.log('📋 Raw Gemini API Result:', {
        hasResponse: !!result.response,
        candidateCount: result.response?.candidates?.length || 0
      });
      
      const response = await result.response;
      
      // 실제 토큰 사용량 추출 (Google Gemini API 응답에서)
      let actualTokensUsed = 0;
      if (response.usageMetadata) {
        actualTokensUsed = response.usageMetadata.totalTokenCount || 0;
        console.log('🔢 Gemini API 실제 토큰 사용량:', {
          promptTokens: response.usageMetadata.promptTokenCount,
          candidatesTokens: response.usageMetadata.candidatesTokenCount,
          totalTokens: response.usageMetadata.totalTokenCount,
          actualUsed: actualTokensUsed
        });
      } else {
        // 토큰 정보가 없는 경우 추정치 사용 (보수적으로 높게 설정)
        actualTokensUsed = GEMINI_COST.TOKENS_PER_IMAGE * 1.2; // 20% 여유분
        console.warn('⚠️ Gemini API에서 토큰 사용량을 가져올 수 없어 추정치 사용:', actualTokensUsed);
      }
      
      // 응답 구조 디버깅
      console.log('🔍 Gemini API 응답 구조:', JSON.stringify(response, null, 2));
      
      // 생성 성공/실패 명확히 로깅
      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        console.log('❌ Gemini 이미지 생성 실패: 후보가 없습니다');
        throw new Error('이미지 생성 결과가 없습니다');
      }
      
      const candidate = candidates[0];
      console.log('📋 첫 번째 후보 구조:', JSON.stringify(candidate, null, 2));
      
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        console.log(`⚠️ Gemini 생성 중단됨: ${candidate.finishReason}`);
        if (candidate.finishReason === 'PROHIBITED_CONTENT') {
          console.log('🚫 콘텐츠 정책 위반으로 이미지 생성이 거부되었습니다');
        }
        throw new Error(`이미지 생성이 중단됨: ${candidate.finishReason}`);
      }
      
      // 이미지 생성 성공
      console.log('✅ Gemini 이미지 생성 성공!');
      
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
      const Sharp = (await import('sharp')).default;
      const originalImageBuffer = Buffer.from(generatedImageData, 'base64');
      const originalMetadata = await Sharp(originalImageBuffer).metadata();
      
      console.log('==================== 📏 GEMINI 이미지 크기 확인 ====================');
      console.log(`🎯 요청한 비율: ${aspectRatio}`);
      console.log(`📐 Gemini가 실제로 생성한 이미지 크기: ${originalMetadata.width} × ${originalMetadata.height} pixels`);
      console.log(`🔍 이미지 포맷: ${originalMetadata.format}`);
      console.log(`📊 예상 크기와 비교:`);
      if (aspectRatio === '1:1') {
        console.log(`   - 예상: 1024 × 1024 (정사각형)`);
        console.log(`   - 실제: ${originalMetadata.width} × ${originalMetadata.height}`);
        console.log(`   - 크기 일치: ${originalMetadata.width === 1024 && originalMetadata.height === 1024 ? '✅' : '❌'}`);
      } else if (aspectRatio === '4:5') {
        console.log(`   - 예상: 896 × 1152 (Gemini 4:5 크기)`);
        console.log(`   - 실제: ${originalMetadata.width} × ${originalMetadata.height}`);
        console.log(`   - 크기 일치: ${originalMetadata.width === 896 && originalMetadata.height === 1152 ? '✅' : '❌'}`);
      } else if (aspectRatio === '16:9') {
        console.log(`   - 예상: 1920 × 1080 (가로형)`);
        console.log(`   - 실제: ${originalMetadata.width} × ${originalMetadata.height}`);
        console.log(`   - 크기 일치: ${originalMetadata.width === 1920 && originalMetadata.height === 1080 ? '✅' : '❌'}`);
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
            imageBuffer = resizedBuffer;
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
      console.log(`🔢 Google Gemini API 실제 토큰 사용량: ${actualTokensUsed}`);
      
      return {
        imageUrl,
        thumbnailUrl,
        tokensUsed: actualTokensUsed, // 실제 Google Gemini API 토큰 사용량 반환
        generationTime,
        detectedCharacters: options?.selectedCharacterIds
      };
      
    } catch (error) {
      console.error("🔥 Gemini 이미지 생성 오류:", error);
      
      // 에러 시 개발 모드에서는 플레이스홀더 반환
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 개발 모드: 플레이스홀더 이미지 반환');
        const width = options?.width || (options?.aspectRatio === '1:1' ? 1024 : options?.aspectRatio === '16:9' ? 1920 : 896);
        const height = options?.height || (options?.aspectRatio === '1:1' ? 1024 : options?.aspectRatio === '16:9' ? 1080 : 1152);
        
        let seed = 'webtoon-fallback';
        if (options?.selectedCharacterIds?.length) {
          seed += `-${options.selectedCharacterIds.join('-')}`;
        }
        seed += `-${options?.aspectRatio || '4:5'}`;
        
        // 개발 모드에서도 실제 토큰 추정치 반환 (테스트용)
        const estimatedTokens = GEMINI_COST.TOKENS_PER_IMAGE + (options?.referenceImages?.length || 0) * 200;
        console.log(`🔄 개발 모드 플레이스홀더 - 토큰 추정치: ${estimatedTokens}`);
        
        return {
          imageUrl: `https://picsum.photos/seed/${seed}/${width}/${height}`,
          thumbnailUrl: `https://picsum.photos/seed/${seed}/300/200`,
          tokensUsed: estimatedTokens,
          generationTime: Date.now() - startTime,
          detectedCharacters: options?.selectedCharacterIds
        };
      }
      
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
        
        // AbortController로 타임아웃 설정 (15초)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
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
      console.log('💾 실제 Gemini 생성 이미지 저장 시도...');
      
      // 개발 환경에서는 base64 데이터를 data URL로 반환
      if (process.env.NODE_ENV === 'development') {
        const timestamp = Date.now();
        const dataUrl = `data:image/png;base64,${base64Data}`;
        
        console.log('🎯 개발 모드: Gemini 생성 이미지를 data URL로 반환');
        console.log('📸 생성된 이미지 크기:', Math.round(base64Data.length / 1024), 'KB');
        
        // 실제 생성된 이미지를 data URL로 반환
        return {
          imageUrl: dataUrl,
          thumbnailUrl: dataUrl // 썸네일도 같은 이미지 사용
        };
      }
      
      // 프로덕션에서는 Vercel Blob 사용 시도
      const { put } = await import('@vercel/blob');
      
      // Base64 데이터를 Buffer로 변환
      const buffer = Buffer.from(base64Data, 'base64');
      
      // 파일 이름 생성
      const timestamp = Date.now();
      const fileName = `generated/${userId}/${aspectRatio}-${timestamp}.png`;
      
      // 원본 이미지 업로드
      const imageBlob = await put(fileName, buffer, {
        access: 'public',
        contentType: 'image/png'
      });
      
      console.log('💾 이미지 저장 완료:', imageBlob.url);
      
      return {
        imageUrl: imageBlob.url,
        thumbnailUrl: imageBlob.url // 프로덕션에서도 같은 이미지 사용
      };
      
    } catch (error) {
      console.error('이미지 저장 오류:', error);
      
      // 저장 실패 시에도 실제 생성된 이미지를 data URL로 반환
      if (base64Data) {
        console.log('🔄 저장 실패 시 data URL 대체 사용');
        const dataUrl = `data:image/png;base64,${base64Data}`;
        return {
          imageUrl: dataUrl,
          thumbnailUrl: dataUrl
        };
      }
      
      // 완전 실패 시 플레이스홀더
      const seed = `generated-${Date.now()}`;
      const width = aspectRatio === '1:1' ? 1024 : aspectRatio === '16:9' ? 1920 : 896;
      const height = aspectRatio === '1:1' ? 1024 : aspectRatio === '16:9' ? 1080 : 1152;
      
      return {
        imageUrl: `https://picsum.photos/seed/${seed}/${width}/${height}`,
        thumbnailUrl: `https://picsum.photos/seed/${seed}/300/200`
      };
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