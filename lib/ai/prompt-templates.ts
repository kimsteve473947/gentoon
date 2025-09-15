/**
 * 캔버스 비율에 최적화된 프롬프트 템플릿 생성기
 * 1:1, 4:5, 16:9 비율에 맞는 완벽한 프롬프트를 자동 구성
 */

export type AspectRatio = '1:1' | '4:5' | '16:9';

interface PromptTemplateOptions {
  aspectRatio: AspectRatio;
  userPrompt: string;
  characterInstructions?: string;
  width: number;
  height: number;
}

/**
 * 비율별 최적화된 기본 지시사항
 */
const ASPECT_RATIO_TEMPLATES = {
  '1:1': {
    format: 'PERFECT SQUARE',
    orientation: 'square',
    composition: 'centered square composition',
    requirements: [
      'The image MUST be a perfect 1:1 square ratio',
      'Equal width and height dimensions exactly',
      'Center the subject within the square frame',
      'Fill the ENTIRE SQUARE FRAME from edge to edge',
      'No empty borders, margins, or whitespace - full bleed',
      'Balanced composition that maximally uses the square format',
      'No rectangular or portrait elements - pure square format only'
    ],
    dimensions: (width: number, height: number) => `1024x1024`,
    description: 'Perfect square format with centered composition'
  },
  '4:5': {
    format: 'PORTRAIT VERTICAL',
    orientation: 'portrait',
    composition: 'vertical portrait composition',
    requirements: [
      'The image MUST be in 4:5 portrait ratio (vertical orientation)',
      'Taller than wide - vertical format',
      'Fill the ENTIRE VERTICAL FRAME from top to bottom',
      'No empty borders, margins, or whitespace - full bleed',
      'Compose vertically with full height utilization',
      'Utilize the full vertical space effectively - edge to edge',
      'Perfect for social media portrait format - maximize frame usage'
    ],
    dimensions: (width: number, height: number) => `${width}x${height}`,
    description: 'Vertical portrait format (Gemini generation size: 896×1152px)'
  },
  '16:9': {
    format: 'LANDSCAPE HORIZONTAL',
    orientation: 'landscape',
    composition: 'horizontal landscape composition',
    requirements: [
      'The image MUST be in 16:9 landscape ratio (horizontal orientation)',
      'Wider than tall - horizontal format',
      'Fill the ENTIRE HORIZONTAL FRAME from left to right',
      'No empty borders, margins, or whitespace - full bleed',
      'Compose horizontally with full width utilization',
      'Utilize the full width for panoramic effect - edge to edge',
      'Perfect for widescreen landscape format - maximize frame usage'
    ],
    dimensions: (width: number, height: number) => `${width}x${height}`,
    description: 'Wide horizontal landscape format'
  }
} as const;

/**
 * 비율에 최적화된 간단하고 효과적인 프롬프트 생성
 */
export function generateOptimizedPrompt(options: PromptTemplateOptions): string {
  const { aspectRatio, userPrompt, characterInstructions, width, height } = options;
  const template = ASPECT_RATIO_TEMPLATES[aspectRatio];
  
  const optimizedPrompt = `${userPrompt}

${characterInstructions ? `
캐릭터 일관성: ${characterInstructions}
레퍼런스 이미지와 정확히 동일한 외모로 그려주세요.
` : ''}

스타일: 한국 웹툰 스타일, 깨끗한 디지털 아트, 선명한 색상
비율: ${aspectRatio} (${template.orientation})
크기: ${width}×${height}px

중요 규칙:
• 그림이 전체 캔버스를 꽉 채우도록 그리기
• 바깥쪽 여백이나 패딩 절대 금지
• 액자나 테두리 효과 금지
• 텍스트, 말풍선, 글자 일체 금지
• 완전한 장면을 ${template.orientation} 구도로 채우기

Generate a full-bleed ${aspectRatio} Korean webtoon illustration that completely fills the canvas with no padding or borders.`;

  return optimizedPrompt;
}

/**
 * 비율별 권장 치수 반환
 */
export function getRecommendedDimensions(aspectRatio: AspectRatio): { width: number; height: number } {
  switch (aspectRatio) {
    case '1:1':
      return { width: 1024, height: 1024 }; // Perfect square
    case '4:5':
      return { width: 896, height: 1152 }; // Gemini 4:5 generation size
    case '16:9':
      return { width: 1920, height: 1080 }; // Landscape widescreen
    default:
      return { width: 896, height: 1152 }; // Default to Gemini 4:5
  }
}

/**
 * 비율 검증
 */
export function validateAspectRatio(width: number, height: number, expectedRatio: AspectRatio): boolean {
  const actualRatio = width / height;
  
  switch (expectedRatio) {
    case '1:1':
      return Math.abs(actualRatio - 1.0) < 0.01; // Allow 1% tolerance
    case '4:5':
      return Math.abs(actualRatio - 0.8) < 0.01; // 4/5 = 0.8
    case '16:9':
      return Math.abs(actualRatio - (16/9)) < 0.01; // 16/9 ≈ 1.778
    default:
      return false;
  }
}

/**
 * 비율별 내부 처리용 메타데이터 (UI 노출 없음)
 */
export function getInternalRatioMetadata(aspectRatio: AspectRatio): {
  formatName: string;
  orientation: string;
  description: string;
} {
  const template = ASPECT_RATIO_TEMPLATES[aspectRatio];
  return {
    formatName: template.format,
    orientation: template.orientation,
    description: template.description
  };
}