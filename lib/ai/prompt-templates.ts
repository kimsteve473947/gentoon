/**
 * 캔버스 비율에 최적화된 프롬프트 템플릿 생성기
 * 1:1, 4:5, 16:9 비율에 맞는 완벽한 프롬프트를 자동 구성
 */

export type AspectRatio = '1:1' | '4:5';

interface PromptTemplateOptions {
  aspectRatio: AspectRatio;
  userPrompt: string;
  characterInstructions?: string;
  elementInstructions?: string;
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
      '🚨 CRITICAL: 4:5 세로 비율 (896×1152px) 캔버스를 100% 완전히 채움 - 절대적 요구사항',
      '🚨 MANDATORY: 위쪽 끝부터 아래쪽 끝까지 완전히 채워진 그림 - 빈 공간 금지',
      '🚨 MANDATORY: 좌측 끝부터 우측 끝까지 완전히 채워진 그림 - 빈 공간 금지',
      '🚨 FORBIDDEN: 상하좌우 어떤 여백도 절대 금지 - FULL BLEED 필수',
      '🚨 FORBIDDEN: 캔버스 가장자리에 흰색, 투명, 빈 공간 절대 금지',
      '🚨 MANDATORY: 캐릭터와 배경이 캔버스 경계를 넘어서도 됨 - 잘려도 OK',
      '🚨 MANDATORY: 배경이 캔버스 모든 픽셀을 덮어야 함 - 하늘, 벽, 풍경 등',
      '🚨 COMPOSITION: 장면을 캔버스에 완전히 꽉 채워서 구성 - 패널이나 프레임 없이 자연스러운 장면만',
      '🚨 SCALE: 캐릭터를 크게 그려서 캔버스 공간을 최대한 활용 - 작은 캐릭터 금지',
      '🚨 ZOOM: 클로즈업이나 미디엄샷으로 캔버스를 가득 채움 - 풀샷 금지'
    ],
    dimensions: (width: number, height: number) => `${width}x${height}`,
    description: 'Vertical portrait format (Gemini generation size: 896×1152px)'
  }
} as const;

/**
 * 비율에 최적화된 간단하고 효과적인 프롬프트 생성
 */
export function generateOptimizedPrompt(options: PromptTemplateOptions): string {
  const { aspectRatio, userPrompt, characterInstructions, elementInstructions, width, height } = options;
  const template = ASPECT_RATIO_TEMPLATES[aspectRatio];
  
  const optimizedPrompt = `${userPrompt}

${characterInstructions ? `
캐릭터 일관성: ${characterInstructions}
레퍼런스 이미지와 정확히 동일한 외모로 그려주세요.
` : ''}

${elementInstructions ? `
요소/배경 포함: ${elementInstructions}
이 요소들을 장면에 자연스럽게 배치하고 통합하세요.
` : ''}

스타일: 한국 웹툰 스타일, 깨끗한 디지털 아트, 선명한 색상
비율: ${aspectRatio} (${template.orientation})
크기: ${width}×${height}px

📷 CAMERA STYLE: ${aspectRatio} CROPPED SHOT

Generate this image using professional photography techniques:

🎬 SHOT TYPE: Close-up to medium shot (like Instagram post or magazine photo)
📐 FRAMING: Tight crop that fills entire ${width}×${height}px canvas
🔍 COMPOSITION: Zoom into scene - show partial views, cut off elements naturally

VISUAL STYLE:
- Modern digital photography aesthetic
- Sharp, detailed Korean webtoon illustration style
- Magazine-quality composition
- Social media post formatting (tight crop, engaging angle)

CAMERA TECHNIQUE:
- Position: Close to subject (like smartphone camera 1-2 feet away)
- Crop: Shoulder-up portrait or torso view (not full body)
- Angle: Slight low angle or eye-level for dynamic feel
- Focus: Subject fills most of frame space

BACKGROUND TREATMENT:
- Extend background to all edges naturally
- Blur or stylize background to emphasize subject
- Environment continues beyond visible frame
- No white space or empty areas

REFERENCE STYLE: "Instagram portrait post" + "Korean webtoon art style"

TECHNICAL SPECS:
- Canvas: ${width}×${height}px (${aspectRatio} ratio)
- Fill: Complete edge-to-edge coverage
- Crop: Partial character view (not full body unless specifically requested)
- Style: Clean digital illustration with photographic composition

COMPOSITION GOAL: Create engaging, social-media ready artwork that looks like a professionally cropped digital illustration.`;

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