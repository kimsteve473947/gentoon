/**
 * 요소 타입별 최적화된 프롬프트 생성기
 * 각 요소 타입에 맞는 자연스러운 통합 방식을 제안
 */

interface ElementData {
  name: string;
  description: string;
  category: string;
}

interface ElementPromptOptions {
  elements: ElementData[];
  sceneContext?: string;
}

/**
 * 요소 타입별 프롬프트 최적화 규칙
 */
const ELEMENT_PROMPT_RULES = {
  background: {
    placement: '배경으로 사용하여 전체 장면의 분위기를 설정하세요',
    integration: '캐릭터 뒤에 자연스럽게 배치하여 깊이감을 만들어주세요',
    style: '배경은 캐릭터보다 약간 흐리게 하여 포커스를 맞춰주세요'
  },
  object: {
    placement: '캐릭터가 상호작용할 수 있도록 적절한 위치에 배치하세요',
    integration: '캐릭터의 행동과 자연스럽게 연결되도록 포함시켜주세요',
    style: '물건의 질감과 재질감을 살려서 현실감 있게 그려주세요'
  },
  prop: {
    placement: '캐릭터 주변이나 손에 들고 있도록 자연스럽게 배치하세요',
    integration: '장면의 스토리를 강화하는 소품으로 활용하세요',
    style: '소품의 디테일을 살려서 눈에 띄지만 과하지 않게 표현하세요'
  },
  effect: {
    placement: '장면에 역동성과 시각적 임팩트를 더하도록 배치하세요',
    integration: '캐릭터의 감정이나 액션과 연결되도록 이펙트를 표현하세요',
    style: '이펙트는 밝고 선명하게 하여 장면에 생동감을 주세요'
  },
  nature: {
    placement: '자연스러운 환경 요소로 장면에 생명력을 더해주세요',
    integration: '계절감이나 자연스러운 분위기를 연출하도록 포함시켜주세요',
    style: '자연물의 유기적인 형태와 색감을 살려서 그려주세요'
  },
  food: {
    placement: '캐릭터가 먹고 있거나 테이블 위에 자연스럽게 배치하세요',
    integration: '식사 장면이나 일상 상황과 어울리도록 포함시켜주세요',
    style: '음식의 맛있어 보이는 질감과 색감을 강조해서 그려주세요'
  },
  vehicle: {
    placement: '캐릭터가 타고 있거나 배경에 자연스럽게 배치하세요',
    integration: '이동 장면이나 교통수단과 관련된 상황으로 연출하세요',
    style: '탈것의 메탈릭하고 견고한 질감을 현실감 있게 표현하세요'
  },
  other: {
    placement: '장면과 어울리도록 적절한 위치에 배치하세요',
    integration: '전체적인 장면 구성과 조화롭게 포함시켜주세요',
    style: '해당 요소의 특성에 맞는 질감과 스타일로 표현하세요'
  }
} as const;

/**
 * 요소 타입별 한국어 레이블
 */
const ELEMENT_TYPE_LABELS = {
  background: '배경',
  object: '물건',
  prop: '소품',
  effect: '효과',
  nature: '자연물',
  food: '음식',
  vehicle: '탈것',
  other: '기타'
} as const;

/**
 * 요소들을 자연스럽게 통합한 프롬프트 생성
 */
export function generateElementPrompt(options: ElementPromptOptions): string {
  const { elements, sceneContext } = options;
  
  if (!elements || elements.length === 0) {
    return '';
  }

  // 요소를 타입별로 그룹화
  const elementsByType = elements.reduce((acc, element) => {
    const category = element.category as keyof typeof ELEMENT_PROMPT_RULES;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(element);
    return acc;
  }, {} as Record<string, ElementData[]>);

  const promptParts: string[] = [];

  // 각 타입별로 최적화된 프롬프트 생성
  Object.entries(elementsByType).forEach(([category, categoryElements]) => {
    const rules = ELEMENT_PROMPT_RULES[category as keyof typeof ELEMENT_PROMPT_RULES];
    const typeLabel = ELEMENT_TYPE_LABELS[category as keyof typeof ELEMENT_TYPE_LABELS];
    
    const elementDescriptions = categoryElements.map(element => {
      return `${element.name}(${element.description})`;
    }).join(', ');

    const categoryPrompt = `
${typeLabel}: ${elementDescriptions}
- ${rules.placement}
- ${rules.integration}
- ${rules.style}`;

    promptParts.push(categoryPrompt);
  });

  // 전체 통합 지시사항
  const integrationInstructions = `
🎨 요소 통합 지시사항:
${promptParts.join('\n')}

💡 전체적인 조화:
- 모든 요소들이 하나의 장면에서 자연스럽게 어울리도록 구성하세요
- 각 요소의 크기와 비율을 장면에 맞게 조정하세요
- 조명과 그림자를 일관되게 적용하여 통일감을 만들어주세요
- 색감과 스타일을 맞춰서 전체적인 harmony를 유지하세요

${sceneContext ? `\n📖 장면 맥락: ${sceneContext}에 맞게 모든 요소를 자연스럽게 배치하세요` : ''}`;

  return integrationInstructions;
}

/**
 * 단일 요소에 대한 간단한 프롬프트 생성
 */
export function generateSingleElementPrompt(element: ElementData, context?: string): string {
  const rules = ELEMENT_PROMPT_RULES[element.category as keyof typeof ELEMENT_PROMPT_RULES];
  const typeLabel = ELEMENT_TYPE_LABELS[element.category as keyof typeof ELEMENT_TYPE_LABELS];
  
  return `
${typeLabel} 포함: ${element.name} - ${element.description}
- ${rules.placement}
- ${rules.integration}
- ${rules.style}
${context ? `\n상황: ${context}에 적합하게 배치하세요` : ''}`;
}

/**
 * 요소 타입별 추천 배치 위치
 */
export function getRecommendedPlacement(category: string): {
  position: string;
  priority: number;
  tips: string[];
} {
  const placements = {
    background: {
      position: '전체 배경',
      priority: 1,
      tips: ['캐릭터 뒤쪽 전체 영역', '원근감 고려', '색상 톤 조절']
    },
    object: {
      position: '캐릭터 근처',
      priority: 2,
      tips: ['손이 닿는 거리', '상호작용 가능한 위치', '적절한 크기 비율']
    },
    prop: {
      position: '캐릭터 손이나 주변',
      priority: 3,
      tips: ['자연스러운 그립', '캐릭터와의 조화', '스토리 연관성']
    },
    effect: {
      position: '액션 포인트',
      priority: 4,
      tips: ['감정 표현 위치', '시선 유도', '임팩트 극대화']
    },
    nature: {
      position: '환경 요소',
      priority: 2,
      tips: ['계절감 연출', '자연스러운 배치', '생동감 부여']
    },
    food: {
      position: '테이블이나 손',
      priority: 3,
      tips: ['먹음직스러운 표현', '일상적인 배치', '질감 강조']
    },
    vehicle: {
      position: '배경이나 탑승',
      priority: 2,
      tips: ['현실적인 크기', '이동감 표현', '안전한 배치']
    },
    other: {
      position: '상황에 맞게',
      priority: 3,
      tips: ['맥락적 배치', '조화로운 구성', '적절한 강조']
    }
  };

  return placements[category as keyof typeof placements] || placements.other;
}