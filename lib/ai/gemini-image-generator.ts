import { GoogleGenAI } from "@google/genai";

// Gemini 2.5 Flash Image 생성 클라이언트 (공식 문서 방식)
const genAI = new GoogleGenAI({ 
  apiKey: process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || ""
});

// 이미지 생성을 위한 모델
const imageModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image-preview" });

// 웹툰 전용 프롬프트 템플릿
export class WebtoonPromptTemplate {
  private static readonly BASE_SYSTEM_PROMPT = `
You are an expert webtoon art director specializing in Korean webtoon style illustrations.
Your role is to maintain consistent character designs and art style across all panels.

Key requirements:
1. Maintain exact character features (face shape, hair style, eye color, clothing details)
2. Use clean line art typical of Korean webtoons
3. Apply vibrant but harmonious color schemes
4. Ensure Instagram-friendly 1:1 aspect ratio
5. Create emotionally expressive scenes
`;

  private static readonly STYLE_PRESETS = {
    korean_webtoon: "Korean webtoon style, clean digital line art, cel shading, vibrant colors, manhwa aesthetic",
    romance: "Romantic Korean webtoon style, soft colors, sparkle effects, detailed eyes, shoujo manga influence",
    action: "Dynamic action webtoon style, bold lines, dramatic angles, speed lines, intense expressions",
    comedy: "Comedy webtoon style, exaggerated expressions, chibi moments, bright colors, humorous details",
    slice_of_life: "Slice of life webtoon style, warm colors, realistic proportions, detailed backgrounds, cozy atmosphere",
  };

  static buildPrompt(
    userPrompt: string,
    options: {
      style?: keyof typeof WebtoonPromptTemplate.STYLE_PRESETS;
      characters?: Array<{ name: string; description: string }>;
      panelNumber?: number;
      previousContext?: string;
      emotion?: string;
      background?: string;
    } = {}
  ): string {
    const stylePrompt = options.style 
      ? this.STYLE_PRESETS[options.style]
      : this.STYLE_PRESETS.korean_webtoon;

    let finalPrompt = `${this.BASE_SYSTEM_PROMPT}\n\n`;
    
    // 스타일 설정
    finalPrompt += `Art Style: ${stylePrompt}\n\n`;
    
    // 캐릭터 설명
    if (options.characters && options.characters.length > 0) {
      finalPrompt += "Character Designs (MUST maintain consistency):\n";
      options.characters.forEach(char => {
        finalPrompt += `[${char.name}]: ${char.description}\n`;
      });
      finalPrompt += "\n";
    }
    
    // 이전 컨텍스트 (연속성 유지)
    if (options.previousContext) {
      finalPrompt += `Previous Panel Context: ${options.previousContext}\n\n`;
    }
    
    // 패널 번호
    if (options.panelNumber) {
      finalPrompt += `Panel Number: ${options.panelNumber}\n`;
    }
    
    // 감정 상태
    if (options.emotion) {
      finalPrompt += `Emotional Tone: ${options.emotion}\n`;
    }
    
    // 배경 설정
    if (options.background) {
      finalPrompt += `Background Setting: ${options.background}\n`;
    }
    
    // 사용자 프롬프트
    finalPrompt += `\nScene Description: ${userPrompt}\n\n`;
    
    // 추가 지시사항
    finalPrompt += `
Technical Requirements:
- Format: Single webtoon panel
- Aspect Ratio: 1:1 (Instagram optimized)
- Style Consistency: Maintain exact character designs from descriptions
- Line Quality: Clean, professional digital line art
- Color: Vibrant but not oversaturated
- Composition: Clear focal point, readable at mobile size
- Text Space: Leave appropriate space for speech bubbles if dialogue is mentioned
`;

    return finalPrompt;
  }
}

// 캐릭터 일관성 유지 시스템
export class CharacterConsistencySystem {
  private characterLibrary: Map<string, {
    id: string;
    name: string;
    baseDescription: string;
    visualFeatures: string[];
    referencePrompts: string[];
    lastUsed: Date;
  }> = new Map();

  // 캐릭터 등록
  registerCharacter(
    id: string,
    name: string,
    description: string,
    referenceImage?: string
  ): void {
    const visualFeatures = this.extractVisualFeatures(description);
    
    this.characterLibrary.set(id, {
      id,
      name,
      baseDescription: description,
      visualFeatures,
      referencePrompts: [description],
      lastUsed: new Date(),
    });
  }

  // 시각적 특징 추출
  private extractVisualFeatures(description: string): string[] {
    const features: string[] = [];
    
    // 얼굴 특징
    const faceFeatures = [
      /(\w+)\s+face\s+shape/gi,
      /(\w+)\s+jawline/gi,
      /(\w+)\s+cheekbones/gi,
    ];
    
    // 머리 특징
    const hairFeatures = [
      /(\w+)\s+hair\s+color/gi,
      /(\w+)\s+hairstyle/gi,
      /(long|short|medium)\s+hair/gi,
      /(straight|wavy|curly)\s+hair/gi,
    ];
    
    // 눈 특징
    const eyeFeatures = [
      /(\w+)\s+eyes/gi,
      /(\w+)\s+eye\s+shape/gi,
      /(big|small|narrow|wide)\s+eyes/gi,
    ];
    
    // 체형 특징
    const bodyFeatures = [
      /(tall|short|average)\s+height/gi,
      /(slim|athletic|muscular|chubby)\s+build/gi,
    ];
    
    // 모든 패턴 매칭
    [...faceFeatures, ...hairFeatures, ...eyeFeatures, ...bodyFeatures].forEach(pattern => {
      const matches = description.match(pattern);
      if (matches) {
        features.push(...matches);
      }
    });
    
    return features;
  }

  // 캐릭터 설명 강화
  enhanceCharacterDescription(characterId: string): string {
    const character = this.characterLibrary.get(characterId);
    if (!character) return "";
    
    const enhanced = `
${character.name} Character Reference:
Base Description: ${character.baseDescription}
Key Visual Features: ${character.visualFeatures.join(", ")}
IMPORTANT: Maintain these exact features in every appearance.
`;
    
    return enhanced;
  }

  // 모든 활성 캐릭터 가져오기
  getActiveCharacters(characterIds: string[]): Array<{ name: string; description: string }> {
    return characterIds
      .map(id => {
        const char = this.characterLibrary.get(id);
        if (!char) return null;
        
        char.lastUsed = new Date();
        return {
          name: char.name,
          description: this.enhanceCharacterDescription(id),
        };
      })
      .filter(Boolean) as Array<{ name: string; description: string }>;
  }
}

// Gemini 이미지 생성 서비스 (나노바나나)
export class NanoBananaImageService {
  private promptTemplate = WebtoonPromptTemplate;
  private consistencySystem = new CharacterConsistencySystem();
  
  // 프롬프트 최적화
  async optimizePrompt(
    userPrompt: string,
    style?: string
  ): Promise<string> {
    try {
      const optimizationRequest = `
You are a webtoon prompt optimization expert. Enhance the following prompt for Gemini image generation.
Make it more specific, visually descriptive, and suitable for Korean webtoon style.

Original prompt: ${userPrompt}
Style preference: ${style || "Korean webtoon"}

Optimized prompt (be specific about visual elements, composition, and mood):
`;

      const result = await imageModel.generateContent(optimizationRequest);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error("Prompt optimization error:", error);
      return userPrompt;
    }
  }

  // 웹툰 패널 생성
  async generateWebtoonPanel(
    userPrompt: string,
    options: {
      characterIds?: string[];
      style?: keyof typeof WebtoonPromptTemplate["STYLE_PRESETS"];
      panelNumber?: number;
      previousContext?: string;
      emotion?: string;
      background?: string;
      referenceImages?: string[];
    } = {}
  ): Promise<{
    imageUrl: string;
    finalPrompt: string;
    tokensUsed: number;
    metadata: any;
  }> {
    try {
      // 1. 프롬프트 최적화
      const optimizedPrompt = await this.optimizePrompt(userPrompt, options.style);
      
      // 2. 캐릭터 정보 가져오기
      const characters = options.characterIds 
        ? this.consistencySystem.getActiveCharacters(options.characterIds)
        : [];
      
      // 3. 최종 프롬프트 생성
      const finalPrompt = WebtoonPromptTemplate.buildPrompt(optimizedPrompt, {
        ...options,
        characters,
      });
      
      // 4. Gemini 2.5 Flash Image API 호출 (공식 문서 방식)
      const result = await genAI.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: `Generate image: ${finalPrompt}`
      });
      
      const response = await result.response;
      
      // 5. 생성된 이미지 처리
      // 실제 구현시 Gemini의 이미지 생성 응답 처리
      const imageData = response.text();
      
      // 임시: 실제 이미지 URL 또는 base64 데이터 반환
      // 프로덕션에서는 실제 이미지 저장 및 URL 생성 필요
      const imageUrl = `/api/generated-image/${Date.now()}`;
      
      // 6. 토큰 계산 (Gemini 실제 사용량 기반)
      const tokensUsed = 1; // 1 이미지 = 1 플랫폼 토큰
      
      return {
        imageUrl,
        finalPrompt,
        tokensUsed,
        metadata: {
          style: options.style,
          characterCount: characters.length,
          panelNumber: options.panelNumber,
          timestamp: new Date().toISOString(),
          model: "gemini-2.5-flash-image-preview",
        },
      };
    } catch (error) {
      console.error("Webtoon panel generation error:", error);
      throw new Error("웹툰 패널 생성에 실패했습니다");
    }
  }

  // 캐릭터 등록
  registerCharacter(
    id: string,
    name: string,
    description: string,
    referenceImage?: string
  ): void {
    this.consistencySystem.registerCharacter(id, name, description, referenceImage);
  }

  // 배치 생성 (여러 패널 동시 생성)
  async generateBatch(
    panels: Array<{
      prompt: string;
      characterIds?: string[];
      emotion?: string;
      background?: string;
    }>,
    style?: keyof typeof WebtoonPromptTemplate["STYLE_PRESETS"]
  ): Promise<Array<{
    imageUrl: string;
    panelNumber: number;
    tokensUsed: number;
  }>> {
    const results = [];
    let previousContext = "";
    
    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      
      const result = await this.generateWebtoonPanel(panel.prompt, {
        characterIds: panel.characterIds,
        style,
        panelNumber: i + 1,
        previousContext,
        emotion: panel.emotion,
        background: panel.background,
      });
      
      results.push({
        imageUrl: result.imageUrl,
        panelNumber: i + 1,
        tokensUsed: result.tokensUsed,
      });
      
      // 다음 패널을 위한 컨텍스트 업데이트
      previousContext = panel.prompt;
      
      // API 레이트 리밋 고려하여 딜레이
      if (i < panels.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  // 스타일 변환 (기존 이미지를 다른 스타일로)
  async transformStyle(
    imageUrl: string,
    targetStyle: keyof typeof WebtoonPromptTemplate["STYLE_PRESETS"],
    maintainCharacters: boolean = true
  ): Promise<{
    imageUrl: string;
    tokensUsed: number;
  }> {
    try {
      const stylePrompt = `
Transform the given image to ${targetStyle} style.
${maintainCharacters ? "IMPORTANT: Maintain exact character appearances." : ""}
Apply the following style: ${WebtoonPromptTemplate["STYLE_PRESETS"][targetStyle]}
`;

      // Vision 모델을 사용한 스타일 변환
      // 실제 구현시 이미지 입력 처리 필요
      const result = await imageModel.generateContent({
        contents: [{
          role: "user",
          parts: [
            { text: stylePrompt },
            // { inlineData: { mimeType: "image/jpeg", data: imageData } }
          ]
        }]
      });
      
      return {
        imageUrl: `/api/transformed-image/${Date.now()}`,
        tokensUsed: 1,
      };
    } catch (error) {
      console.error("Style transformation error:", error);
      throw new Error("스타일 변환에 실패했습니다");
    }
  }
}

// 싱글톤 인스턴스
export const nanoBananaService = new NanoBananaImageService();