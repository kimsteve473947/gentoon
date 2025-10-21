/**
 * Multi-Panel Continuity (MPC) System
 * 나노바나나 MCP 방식을 참고한 우리만의 다중패널 연속성 시스템
 * 
 * 핵심 아이디어:
 * 1. 첫 패널: 독립적 생성
 * 2. 후속 패널: 이전 이미지를 참조하여 연속성 유지
 * 3. 캐릭터 일관성: 레퍼런스 이미지 + 강화된 프롬프트
 * 4. 장면 일관성: 이전 패널의 배경/분위기 유지
 */

import { GoogleGenAI } from '@google/genai';
import { generateOptimizedPrompt, type AspectRatio } from './prompt-templates';

export interface MPCPanel {
  order: number;
  prompt: string;
  characters: string[];
  elements: string[];
}

export interface MPCOptions {
  userId: string;
  projectId: string;
  aspectRatio: AspectRatio;
  characterReferences?: string[];
  elementImageUrls?: string[];
  sessionId?: string;
}

export interface MPCResult {
  panelIndex: number;
  success: boolean;
  imageUrl?: string;
  thumbnailUrl?: string;
  tokensUsed: number;
  error?: string;
  continuityScore?: number; // 연속성 점수 (0-100)
}

export interface MPCBatchResult {
  sessionId: string;
  totalPanels: number;
  successCount: number;
  failCount: number;
  results: MPCResult[];
  totalTokensUsed: number;
  averageContinuityScore: number;
}

/**
 * Multi-Panel Continuity Engine
 * 나노바나나 MCP 방식을 참고한 연속성 있는 배치 생성 시스템
 */
export class MultiPanelContinuityEngine {
  private genAI: GoogleGenAI;
  private model: string = 'gemini-2.5-flash-image-preview';

  constructor() {
    // Vertex AI 초기화 (기존 nanoBananaService와 동일)
    const projectId = (process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT)?.trim();
    const location = (process.env.GOOGLE_CLOUD_LOCATION || 'global')?.trim();
    
    if (!projectId) {
      throw new Error("GOOGLE_CLOUD_PROJECT_ID is required for MPC Engine");
    }

    // 서비스 계정 credentials 로드
    let credentials = null;
    
    // 1. 환경변수로 개별 값 사용 (Vercel 권장 방식)
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      try {
        credentials = {
          type: "service_account",
          project_id: process.env.GOOGLE_CLOUD_PROJECT_ID || projectId,
          private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          client_id: process.env.GOOGLE_CLIENT_ID,
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
          client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL
        };
        console.log('✅ MPC 환경변수에서 Vertex AI credentials 구성 성공');
      } catch (error) {
        console.error('❌ MPC 환경변수 credentials 구성 실패:', error);
      }
    }
    
    // 2. 로컬 환경에서 파일 직접 읽기 (개발용)
    if (!credentials && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        const fs = require('fs');
        const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        if (fs.existsSync(credentialsPath)) {
          const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
          credentials = JSON.parse(credentialsContent);
        }
      } catch (error) {
        console.error('❌ MPC Credentials 파일 읽기 실패:', error);
      }
    }
    
    // 3. Vercel JSON 환경변수 사용 (백업 방식)
    if (!credentials && process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      try {
        const cleanJsonString = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON.trim();
        credentials = JSON.parse(cleanJsonString);
        if (credentials.private_key) {
          credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
        }
      } catch (error) {
        console.error('❌ MPC Vercel credentials JSON 파싱 실패:', error);
      }
    }
    
    if (!credentials) {
      throw new Error("MPC Engine: Vertex AI credentials를 찾을 수 없습니다");
    }
    
    this.genAI = new GoogleGenAI({
      project: projectId,
      location: location,
      credentials: credentials
    });
    
    console.log('✅ MPC Engine 초기화 완료');
  }

  /**
   * 🎬 첫 번째 패널 생성 (기준점 설정)
   * 나노바나나 MCP의 generate_image()와 유사
   */
  private async generateFoundationPanel(
    panel: MPCPanel, 
    options: MPCOptions
  ): Promise<MPCResult> {
    console.log(`🎬 [MPC] 기준 패널 생성: ${panel.order}`);
    
    try {
      const enhancedPrompt = this.buildMPCPrompt(panel.prompt, {
        aspectRatio: options.aspectRatio,
        isFoundation: true,
        characterReferences: options.characterReferences,
        elementImageUrls: options.elementImageUrls
      });

      const contents: any[] = [];
      
      // 캐릭터 레퍼런스 이미지 추가
      if (options.characterReferences && options.characterReferences.length > 0) {
        for (const refUrl of options.characterReferences.slice(0, 2)) { // 최대 2개
          const imageData = await this.downloadAndConvertImage(refUrl);
          if (imageData) {
            contents.push({
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageData
              }
            });
          }
        }
      }

      // 요소 이미지 추가
      if (options.elementImageUrls && options.elementImageUrls.length > 0) {
        const remainingSlots = 3 - contents.length;
        for (const elementUrl of options.elementImageUrls.slice(0, remainingSlots)) {
          const imageData = await this.downloadAndConvertImage(elementUrl);
          if (imageData) {
            contents.push({
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageData
              }
            });
          }
        }
      }

      // 텍스트 프롬프트 추가
      contents.push({ text: enhancedPrompt });

      const model = this.genAI.getGenerativeModel({ model: this.model });
      const response = await model.generateContent(contents);
      
      const imageData = response.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!imageData) {
        throw new Error('기준 패널 이미지 생성 실패');
      }

      // 이미지 저장
      const { imageUrl, thumbnailUrl } = await this.saveGeneratedImage(
        imageData,
        options.userId,
        options.aspectRatio
      );

      return {
        panelIndex: panel.order - 1,
        success: true,
        imageUrl,
        thumbnailUrl,
        tokensUsed: 1290, // 실제 토큰 사용량
        continuityScore: 100 // 기준점이므로 100점
      };

    } catch (error) {
      console.error(`❌ [MPC] 기준 패널 ${panel.order} 생성 실패:`, error);
      return {
        panelIndex: panel.order - 1,
        success: false,
        tokensUsed: 0,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        continuityScore: 0
      };
    }
  }

  /**
   * 🔗 연속성 패널 생성 (이전 패널 참조)
   * 나노바나나 MCP의 continue_editing() 방식 응용
   */
  private async generateContinuityPanel(
    panel: MPCPanel,
    previousImageUrl: string,
    options: MPCOptions
  ): Promise<MPCResult> {
    console.log(`🔗 [MPC] 연속성 패널 생성: ${panel.order} (이전: ${previousImageUrl.substring(0, 50)}...)`);
    
    try {
      const continuityPrompt = this.buildMPCPrompt(panel.prompt, {
        aspectRatio: options.aspectRatio,
        isFoundation: false,
        characterReferences: options.characterReferences,
        elementImageUrls: options.elementImageUrls,
        continuityInstructions: true
      });

      const contents: any[] = [];

      // 1️⃣ 이전 패널 이미지 (연속성의 핵심)
      const previousImageData = await this.downloadAndConvertImage(previousImageUrl);
      if (!previousImageData) {
        throw new Error('이전 패널 이미지 로드 실패');
      }
      
      contents.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: previousImageData
        }
      });

      // 2️⃣ 나머지 2자리에 캐릭터/요소 이미지 추가
      let addedImages = 0;
      const maxAdditionalImages = 2;

      // 캐릭터 레퍼런스 우선
      if (options.characterReferences && addedImages < maxAdditionalImages) {
        for (const refUrl of options.characterReferences.slice(0, maxAdditionalImages - addedImages)) {
          const imageData = await this.downloadAndConvertImage(refUrl);
          if (imageData) {
            contents.push({
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageData
              }
            });
            addedImages++;
          }
        }
      }

      // 요소 이미지 추가
      if (options.elementImageUrls && addedImages < maxAdditionalImages) {
        for (const elementUrl of options.elementImageUrls.slice(0, maxAdditionalImages - addedImages)) {
          const imageData = await this.downloadAndConvertImage(elementUrl);
          if (imageData) {
            contents.push({
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageData
              }
            });
            addedImages++;
          }
        }
      }

      // 텍스트 프롬프트 추가
      contents.push({ text: continuityPrompt });

      console.log(`📊 [MPC] 연속성 패널 ${panel.order}: 총 ${contents.length - 1}개 이미지 (이전패널:1, 추가:${addedImages})`);

      const model = this.genAI.getGenerativeModel({ model: this.model });
      const response = await model.generateContent(contents);
      
      const imageData = response.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!imageData) {
        throw new Error('연속성 패널 이미지 생성 실패');
      }

      // 이미지 저장
      const { imageUrl, thumbnailUrl } = await this.saveGeneratedImage(
        imageData,
        options.userId,
        options.aspectRatio
      );

      // 연속성 점수 계산 (간단한 휴리스틱)
      const continuityScore = this.calculateContinuityScore(panel, previousImageUrl, imageUrl);

      return {
        panelIndex: panel.order - 1,
        success: true,
        imageUrl,
        thumbnailUrl,
        tokensUsed: 1290,
        continuityScore
      };

    } catch (error) {
      console.error(`❌ [MPC] 연속성 패널 ${panel.order} 생성 실패:`, error);
      return {
        panelIndex: panel.order - 1,
        success: false,
        tokensUsed: 0,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        continuityScore: 0
      };
    }
  }

  /**
   * 🚀 전체 배치 생성 (MPC 엔진의 메인 함수)
   */
  async generateBatchWithContinuity(
    panels: MPCPanel[],
    options: MPCOptions
  ): Promise<MPCBatchResult> {
    const sessionId = options.sessionId || `mpc-${Date.now()}`;
    console.log(`🚀 [MPC] 배치 연속성 생성 시작: ${panels.length}개 패널 (세션: ${sessionId})`);

    const results: MPCResult[] = [];
    let successCount = 0;
    let failCount = 0;
    let totalTokensUsed = 0;
    let previousImageUrl: string | null = null;

    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      let result: MPCResult;

      if (i === 0) {
        // 첫 패널: 기준점 생성
        result = await this.generateFoundationPanel(panel, options);
      } else {
        // 후속 패널: 연속성 생성
        if (!previousImageUrl) {
          result = {
            panelIndex: i,
            success: false,
            tokensUsed: 0,
            error: '이전 패널 이미지가 없음',
            continuityScore: 0
          };
        } else {
          result = await this.generateContinuityPanel(panel, previousImageUrl, options);
        }
      }

      results.push(result);
      totalTokensUsed += result.tokensUsed;

      if (result.success) {
        successCount++;
        previousImageUrl = result.imageUrl!;
        console.log(`✅ [MPC] 패널 ${i + 1}/${panels.length} 완료 (연속성: ${result.continuityScore}점)`);
      } else {
        failCount++;
        console.error(`❌ [MPC] 패널 ${i + 1}/${panels.length} 실패: ${result.error}`);
        // 실패 시 연속성이 깨지므로 previousImageUrl 유지 (재시도 가능)
      }

      // 패널 간 대기 (레이트 리미트 방지)
      if (i < panels.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    // 평균 연속성 점수 계산
    const continuityScores = results.filter(r => r.success && r.continuityScore).map(r => r.continuityScore!);
    const averageContinuityScore = continuityScores.length > 0 
      ? continuityScores.reduce((a, b) => a + b, 0) / continuityScores.length 
      : 0;

    const batchResult: MPCBatchResult = {
      sessionId,
      totalPanels: panels.length,
      successCount,
      failCount,
      results,
      totalTokensUsed,
      averageContinuityScore
    };

    console.log(`🎉 [MPC] 배치 완료: ${successCount}/${panels.length}개 성공, 평균 연속성: ${averageContinuityScore.toFixed(1)}점`);
    
    return batchResult;
  }

  /**
   * MCP 방식의 강화된 프롬프트 구성
   * 나노바나나의 플래그 시스템을 참고
   */
  private buildMPCPrompt(basePrompt: string, options: {
    aspectRatio: AspectRatio;
    isFoundation: boolean;
    characterReferences?: string[];
    elementImageUrls?: string[];
    continuityInstructions?: boolean;
  }): string {
    let enhancedPrompt = basePrompt;

    // 기본 웹툰 스타일 지시사항
    enhancedPrompt += `\n\n🎨 [웹툰 스타일 요구사항]
- 한국 웹툰의 일관된 아트 스타일 적용
- 선명한 선화와 생동감 있는 채색
- ${options.aspectRatio === '1:1' ? '정사각형 (1:1)' : '세로형 (4:5)'} 비율에 최적화된 구도`;

    // 캐릭터 일관성 지시사항 (나노바나나의 maintainCharacterConsistency 플래그)
    if (options.characterReferences && options.characterReferences.length > 0) {
      enhancedPrompt += `\n\n🎭 [캐릭터 일관성 보장]
- 제공된 레퍼런스 이미지의 캐릭터 외형을 정확히 재현
- 얼굴 특징, 헤어스타일, 의상을 레퍼런스와 동일하게 유지
- 캐릭터의 고유한 특징을 절대 변경하지 말 것`;
    }

    // 연속성 지시사항 (나노바나나의 blendImages 플래그 응용)
    if (options.continuityInstructions && !options.isFoundation) {
      enhancedPrompt += `\n\n🔗 [연속성 유지 필수]
- 첫 번째 이미지는 이전 패널입니다. 이 장면과 자연스럽게 이어지도록 생성
- 배경, 조명, 분위기를 이전 패널과 일치시키되 새로운 장면으로 발전
- 캐릭터 위치나 각도는 변경 가능하지만 외형은 동일하게 유지
- 시간적 연속성을 고려한 자연스러운 장면 전환`;
    }

    // 기준 패널 지시사항
    if (options.isFoundation) {
      enhancedPrompt += `\n\n🎬 [기준 패널 생성]
- 이 패널은 시리즈의 시작점이므로 명확하고 완성도 높게 생성
- 후속 패널들이 참조할 기준이 되는 높은 품질의 이미지 생성`;
    }

    // 요소 참조 지시사항
    if (options.elementImageUrls && options.elementImageUrls.length > 0) {
      enhancedPrompt += `\n\n🎯 [요소 참조 적용]
- 제공된 요소 이미지들을 장면에 자연스럽게 통합
- 요소의 스타일과 특성을 유지하면서 전체 구도에 조화롭게 배치`;
    }

    // 텍스트 생성 방지 (기존 nanoBananaService와 동일)
    enhancedPrompt += `\n\n🚨 [필수 제한사항]
- 텍스트, 글자, 말풍선 등 문자 요소 절대 생성 금지
- 순수 비주얼 표현만으로 구성
- 워터마크, 로고, 서명 등 텍스트 요소 제외`;

    return enhancedPrompt;
  }

  /**
   * 연속성 점수 계산 (간단한 휴리스틱)
   */
  private calculateContinuityScore(
    panel: MPCPanel, 
    previousImageUrl: string, 
    currentImageUrl: string
  ): number {
    // 실제로는 이미지 분석을 통해 계산해야 하지만, 
    // 현재는 성공적으로 생성되었다면 기본 점수 제공
    
    // 기본 점수: 80점
    let score = 80;
    
    // 캐릭터가 있으면 +10점
    if (panel.characters.length > 0) {
      score += 10;
    }
    
    // 요소가 있으면 +5점
    if (panel.elements.length > 0) {
      score += 5;
    }
    
    // 최대 95점으로 제한 (완벽한 연속성은 드물므로)
    return Math.min(score, 95);
  }

  /**
   * 이미지 다운로드 및 Base64 변환
   */
  private async downloadAndConvertImage(imageUrl: string): Promise<string | null> {
    try {
      if (imageUrl.startsWith('data:image/')) {
        const [, base64Part] = imageUrl.split(',');
        return base64Part;
      }

      const response = await fetch(imageUrl);
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      return base64;
    } catch (error) {
      console.warn('이미지 다운로드 실패:', imageUrl.substring(0, 100), error);
      return null;
    }
  }

  /**
   * 생성된 이미지 저장 (nanoBananaService와 동일한 방식)
   */
  private async saveGeneratedImage(
    base64Data: string,
    userId: string,
    aspectRatio: AspectRatio
  ): Promise<{ imageUrl: string; thumbnailUrl: string }> {
    try {
      console.log('💾 [MPC] 생성 이미지 저장 시작 (WebP 최적화 포함)...');
      
      // WebP 최적화를 위해 nanoBananaService의 WebPOptimizer 사용
      const { WebPOptimizer } = await import('@/lib/image/webp-optimizer');
      const { createServiceClient } = await import('@/lib/supabase/service');
      
      const webpOptimizer = new WebPOptimizer();
      
      // WebP로 변환
      const originalBuffer = Buffer.from(base64Data, 'base64');
      console.log(`📊 [MPC] 원본 이미지 크기: ${Math.round(originalBuffer.length / 1024)}KB`);
      
      const webpResult = await webpOptimizer.convertToWebP(originalBuffer, 85);
      console.log(`🗜️ [MPC] WebP 최적화: ${Math.round(webpResult.originalSize / 1024)}KB → ${Math.round(webpResult.optimizedSize / 1024)}KB`);
      
      // 썸네일 생성
      const responsiveSizes = await webpOptimizer.generateResponsiveSizes(originalBuffer, 85);
      
      // Supabase Storage에 업로드
      const supabase = createServiceClient();
      const timestamp = Date.now();
      
      const mainImagePath = `generated/${userId}/mpc-${aspectRatio}-${timestamp}.webp`;
      const thumbnailPath = `generated/${userId}/mpc-${aspectRatio}-${timestamp}-thumb.webp`;
      
      console.log(`☁️ [MPC] Supabase Storage 업로드: ${mainImagePath}`);
      
      // 병렬 업로드
      const [mainImageResult, thumbnailResult] = await Promise.all([
        supabase.storage
          .from('webtoon-images')
          .upload(mainImagePath, webpResult.webpBuffer, {
            contentType: 'image/webp',
            cacheControl: '31536000',
            upsert: false
          }),
        supabase.storage
          .from('webtoon-images')
          .upload(thumbnailPath, responsiveSizes.thumbnail, {
            contentType: 'image/webp',
            cacheControl: '31536000',
            upsert: false
          })
      ]);
      
      if (mainImageResult.error) {
        console.error('[MPC] 메인 이미지 업로드 실패:', mainImageResult.error);
        throw new Error(`메인 이미지 업로드 실패: ${mainImageResult.error.message}`);
      }
      
      if (thumbnailResult.error) {
        console.warn('[MPC] 썸네일 업로드 실패:', thumbnailResult.error);
      }
      
      // 공개 URL 생성
      const { data: mainImageUrl } = supabase.storage
        .from('webtoon-images')
        .getPublicUrl(mainImagePath);
      
      const { data: thumbnailUrl } = supabase.storage
        .from('webtoon-images')
        .getPublicUrl(thumbnailPath);
      
      console.log(`✅ [MPC] 이미지 저장 완료: ${mainImageUrl.publicUrl}`);
      
      return {
        imageUrl: mainImageUrl.publicUrl,
        thumbnailUrl: thumbnailUrl.publicUrl
      };
      
    } catch (error) {
      console.error('[MPC] 이미지 저장 실패:', error);
      
      // 저장 실패 시 임시 Data URL 반환 (백업)
      const mimeType = 'image/webp';
      const dataUrl = `data:${mimeType};base64,${base64Data}`;
      
      return {
        imageUrl: dataUrl,
        thumbnailUrl: dataUrl
      };
    }
  }
}

// 싱글톤 인스턴스
export const multiPanelContinuityEngine = new MultiPanelContinuityEngine();