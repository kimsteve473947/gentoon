/**
 * 🎭 Gemini 웹툰 연속성 엔진
 * 
 * Gemini 공식 가이드라인 기반:
 * 1. 극도로 구체적인 디테일 설명
 * 2. 단계별 접근법
 * 3. 이전 패널과의 명시적 연결
 * 4. 핵심 요소 보존 지시
 * 5. 동적 장면 분석으로 실제 배경 추출
 */

import { 
  DynamicSceneAnalyzer,
  type SceneAnalysisResult,
  type CharacterAnalysisResult 
} from './dynamic-scene-analyzer';
import { 
  BackgroundDescriptorEngine,
  type BackgroundDescriptor 
} from './background-descriptor-engine';

export interface WebtoonCharacterProfile {
  name: string;
  physicalDetails: string;     // "분홍색 트윈테일, 갈색 눈, 키 160cm"
  clothing: string;            // "검은색 교복 재킷, 빨간 체크 스커트, 흰색 블라우스"
  accessories: string;         // "목에 빨간 리본, 검은색 무릎양말"
  personalityTraits: string;   // "자신감 있는 표정, 당당한 자세"
  lastSeenAction: string;      // "책상에 앉아 미소짓고 있음"
  lastSeenPose: string;        // "오른손으로 펜을 들고 왼손은 턱을 괴고 있음"
}

export interface WebtoonSceneContext {
  location: string;            // "교실 뒷쪽 창가 자리, 오후 햇살이 비치는"
  lighting: string;            // "따뜻한 오후 햇살, 부드러운 그림자"
  mood: string;                // "평화롭고 일상적인 분위기"
  objects: string[];           // ["나무 책상", "의자", "교과서", "필기구"]
  timeOfDay: string;           // "오후 2시경, 수업 시간"
  weather: string;             // "맑은 날씨, 창 밖으로 파란 하늘"
}

export interface WebtoonVisualStyle {
  artStyle: string;            // "한국 웹툰 스타일, 선명한 라인아트"
  colorPalette: string;        // "따뜻한 톤, 파스텔 컬러"
  lineWeight: string;          // "깔끔한 중간 두께 선"
  shading: string;             // "부드러운 셀 쉐이딩"
  perspective: string;         // "3/4 앵글, 약간 위에서 바라본 시점"
}

export interface WebtoonPanelContext {
  panelNumber: number;
  characters: WebtoonCharacterProfile[];
  scene: WebtoonSceneContext;
  visualStyle: WebtoonVisualStyle;
  backgroundDescriptor?: BackgroundDescriptor; // 🎯 배경 디스크립터 추가
  previousPanel?: {
    summary: string;
    keyElements: string[];
  };
}

export class WebtoonConsistencyEngine {
  
  /**
   * 🎯 Gemini 최적화 웹툰 프롬프트 생성
   * 공식 가이드라인: "극도로 구체적인 설명 + 단계별 접근"
   */
  static generateGeminiOptimizedPrompt(
    userPrompt: string,
    context: WebtoonPanelContext
  ): string {
    let prompt = '';
    
    // 1. 웹툰 스타일 정의 (최우선)
    prompt += `🎨 [웹툰 스타일]\n`;
    prompt += `${context.visualStyle.artStyle}, ${context.visualStyle.colorPalette}\n`;
    prompt += `${context.visualStyle.lineWeight}, ${context.visualStyle.shading}\n`;
    prompt += `앵글: ${context.visualStyle.perspective}\n\n`;
    
    // 2. 이전 패널과의 연결성 (Gemini 핵심 요구사항)
    if (context.previousPanel) {
      prompt += `🔗 [이전 패널 연결성 - 필수 유지]\n`;
      prompt += `이전 장면: ${context.previousPanel.summary}\n`;
      prompt += `연속성 유지 요소: ${context.previousPanel.keyElements.join(', ')}\n`;
      prompt += `⚠️ 위 요소들을 정확히 동일하게 유지하면서 다음 장면으로 자연스럽게 연결\n\n`;
    }
    
    // 3. 캐릭터 극상세 설명 (Gemini 일관성 핵심)
    if (context.characters.length > 0) {
      prompt += `👤 [캐릭터 정확한 재현 - 변경 금지]\n`;
      context.characters.forEach((char, index) => {
        prompt += `${char.name}:\n`;
        prompt += `- 외모: ${char.physicalDetails}\n`;
        prompt += `- 의상: ${char.clothing}\n`;
        prompt += `- 액세서리: ${char.accessories}\n`;
        prompt += `- 성격표현: ${char.personalityTraits}\n`;
        prompt += `- 이전 자세: ${char.lastSeenPose}\n`;
        prompt += `- 이전 행동: ${char.lastSeenAction}\n`;
        if (index < context.characters.length - 1) prompt += '\n';
      });
      prompt += '\n⚠️ 위 모든 캐릭터 디테일을 정확히 동일하게 유지\n\n';
    }
    
    // 4. 🎯 극도로 구체적인 배경 연속성 (배경 디스크립터 사용)
    if (context.backgroundDescriptor) {
      prompt += BackgroundDescriptorEngine.generateConsistencyPrompt(context.backgroundDescriptor);
    } else {
      // 폴백: 기존 방식
      prompt += `🏫 [배경 연속성 유지]\n`;
      prompt += `장소: ${context.scene.location}\n`;
      prompt += `조명: ${context.scene.lighting}\n`;
      prompt += `분위기: ${context.scene.mood}\n`;
      prompt += `시간: ${context.scene.timeOfDay}\n`;
      prompt += `날씨: ${context.scene.weather}\n`;
      if (context.scene.objects.length > 0) {
        prompt += `오브젝트: ${context.scene.objects.join(', ')}\n`;
      }
      prompt += '\n';
    }
    
    // 5. 사용자 요청사항 (구체적 변화만)
    prompt += `📝 [${context.panelNumber}컷 새로운 요소]\n`;
    prompt += `${userPrompt}\n\n`;
    
    // 6. Gemini 핵심 지시사항
    prompt += `🎯 [Gemini 생성 지시사항]\n`;
    prompt += `1. 위에 명시된 모든 캐릭터와 배경 디테일을 정확히 동일하게 유지\n`;
    prompt += `2. 오직 사용자가 요청한 새로운 요소만 추가/변경\n`;
    prompt += `3. 웹툰 패널 형태로 구성, 텍스트나 말풍선 없이\n`;
    prompt += `4. 이전 패널과 자연스럽게 연결되는 장면 구성\n`;
    prompt += `5. 한국 웹툰 스타일 유지, 높은 디테일과 선명한 색상\n`;
    
    return prompt;
  }
  
  /**
   * 📸 패널 분석 후 컨텍스트 업데이트 (동적 분석)
   */
  static analyzeAndUpdateContext(
    panelNumber: number,
    userPrompt: string,
    currentContext: WebtoonPanelContext
  ): WebtoonPanelContext {
    
    // 🔍 동적 장면 분석
    const sceneAnalysis = DynamicSceneAnalyzer.analyzeSceneFromPrompt(userPrompt);
    const characterAnalysis = DynamicSceneAnalyzer.analyzeCharacterFromPrompt(userPrompt);
    
    // 캐릭터 상태 업데이트 (기존 정보 유지 + 새로운 정보 추가)
    const updatedCharacters = currentContext.characters.map(char => ({
      ...char,
      // 새로운 의상 정보가 있으면 업데이트, 없으면 기존 유지
      clothing: characterAnalysis.clothing.length > 0 
        ? characterAnalysis.clothing.join(', ') 
        : char.clothing,
      // 새로운 액세서리 정보가 있으면 업데이트
      accessories: characterAnalysis.accessories.length > 0
        ? characterAnalysis.accessories.join(', ')
        : char.accessories,
      // 새로운 외모 정보가 있으면 기존과 결합
      physicalDetails: characterAnalysis.physicalDetails.length > 0
        ? `${char.physicalDetails}, ${characterAnalysis.physicalDetails.join(', ')}`
        : char.physicalDetails,
      // 행동과 포즈는 항상 업데이트
      lastSeenAction: characterAnalysis.action,
      lastSeenPose: characterAnalysis.pose,
      personalityTraits: `${characterAnalysis.expression}, ${char.personalityTraits}`
    }));
    
    // 씬 컨텍스트 업데이트 (새로운 장소가 감지되지 않으면 기존 유지)
    const updatedScene: WebtoonSceneContext = {
      // 새로운 장소가 기본값이 아니면 업데이트, 아니면 기존 유지
      location: sceneAnalysis.location !== '일반적인 실내 공간' 
        ? sceneAnalysis.location 
        : currentContext.scene.location,
      
      // 새로운 조명 정보가 기본값이 아니면 업데이트
      lighting: sceneAnalysis.lighting !== '자연스러운 조명'
        ? sceneAnalysis.lighting
        : currentContext.scene.lighting,
        
      // 새로운 분위기가 기본값이 아니면 업데이트
      mood: sceneAnalysis.mood !== '자연스럽고 일상적인 분위기'
        ? sceneAnalysis.mood
        : currentContext.scene.mood,
        
      // 시간대 업데이트
      timeOfDay: sceneAnalysis.timeOfDay !== '일반적인 시간'
        ? sceneAnalysis.timeOfDay
        : currentContext.scene.timeOfDay,
        
      // 오브젝트는 기존 + 새로운 것들 결합 (중복 제거)
      objects: sceneAnalysis.objects.length > 0
        ? [...new Set([...currentContext.scene.objects, ...sceneAnalysis.objects])]
        : currentContext.scene.objects,
        
      // 날씨는 기존 유지
      weather: currentContext.scene.weather
    };
    
    // 이전 패널 정보 생성
    const previousPanel = {
      summary: this.generatePanelSummary(currentContext, userPrompt),
      keyElements: this.extractKeyElements(currentContext)
    };
    
    console.log(`🔍 동적 분석 결과:`, {
      장소변화: sceneAnalysis.location !== currentContext.scene.location,
      새로운오브젝트: sceneAnalysis.objects,
      캐릭터액션: characterAnalysis.action,
      이전장소: currentContext.scene.location,
      새장소: updatedScene.location
    });
    
    return {
      panelNumber: panelNumber + 1,
      characters: updatedCharacters,
      scene: updatedScene,
      visualStyle: currentContext.visualStyle,
      backgroundDescriptor: currentContext.backgroundDescriptor, // 🎯 배경 디스크립터 유지
      previousPanel
    };
  }
  
  /**
   * 🔍 사용자 프롬프트에서 변화 요소 추출
   */
  private static extractChanges(userPrompt: string): {
    actions: string[];
    poses: string[];
    mood?: string;
    lighting?: string;
  } {
    const changes = {
      actions: [] as string[],
      poses: [] as string[],
      mood: undefined as string | undefined,
      lighting: undefined as string | undefined
    };
    
    // 행동 키워드 감지
    const actionKeywords = ['웃다', '말하다', '일어나다', '앉다', '바라보다', '돌아보다'];
    actionKeywords.forEach(keyword => {
      if (userPrompt.includes(keyword)) {
        changes.actions.push(`${keyword} 중`);
      }
    });
    
    // 자세 키워드 감지
    const poseKeywords = ['손을 든다', '고개를 끄덕', '팔짱을 낀다'];
    poseKeywords.forEach(keyword => {
      if (userPrompt.includes(keyword)) {
        changes.poses.push(keyword);
      }
    });
    
    // 분위기 변화 감지
    if (userPrompt.includes('긴장') || userPrompt.includes('놀란')) {
      changes.mood = '긴장감 있는 분위기';
    } else if (userPrompt.includes('웃음') || userPrompt.includes('즐거운')) {
      changes.mood = '밝고 즐거운 분위기';
    }
    
    return changes;
  }
  
  /**
   * 📋 패널 요약 생성
   */
  private static generatePanelSummary(
    context: WebtoonPanelContext, 
    userPrompt: string
  ): string {
    const charNames = context.characters.map(c => c.name).join(', ');
    const location = context.scene.location;
    const action = userPrompt.substring(0, 50);
    
    return `${charNames}이/가 ${location}에서 ${action}`;
  }
  
  /**
   * 🔑 핵심 요소 추출 (연속성 유지용)
   */
  private static extractKeyElements(context: WebtoonPanelContext): string[] {
    const elements: string[] = [];
    
    // 캐릭터 핵심 요소
    context.characters.forEach(char => {
      elements.push(`${char.name} 외모: ${char.physicalDetails}`);
      elements.push(`${char.name} 의상: ${char.clothing}`);
    });
    
    // 배경 핵심 요소
    elements.push(`배경: ${context.scene.location}`);
    elements.push(`조명: ${context.scene.lighting}`);
    elements.push(`시간: ${context.scene.timeOfDay}`);
    
    return elements;
  }
  
  /**
   * 🎭 동적 웹툰 컨텍스트 생성 (첫 패널용)
   */
  static createInitialWebtoonContext(userPrompt: string): WebtoonPanelContext {
    // 🔍 사용자 프롬프트에서 실제 장면 정보 추출
    const sceneAnalysis = DynamicSceneAnalyzer.analyzeSceneFromPrompt(userPrompt);
    const characterAnalysis = DynamicSceneAnalyzer.analyzeCharacterFromPrompt(userPrompt);
    
    // 🎯 배경 디스크립터 생성 (연속성을 위한 극도로 구체적인 배경 설명)
    const backgroundDescriptor = BackgroundDescriptorEngine.generateBackgroundDescriptor(userPrompt);
    
    // 추출된 정보로 동적 캐릭터 프로필 생성
    const dynamicCharacter: WebtoonCharacterProfile = {
      name: "주인공",
      physicalDetails: characterAnalysis.physicalDetails.length > 0 
        ? characterAnalysis.physicalDetails.join(', ')
        : "매력적인 외모, 표현력이 풍부한 눈",
      clothing: characterAnalysis.clothing.length > 0
        ? characterAnalysis.clothing.join(', ')
        : "세련된 캐주얼 의상",
      accessories: characterAnalysis.accessories.length > 0
        ? characterAnalysis.accessories.join(', ')
        : "심플한 액세서리",
      personalityTraits: `${characterAnalysis.expression}, 자연스러운 매력`,
      lastSeenAction: characterAnalysis.action,
      lastSeenPose: characterAnalysis.pose
    };
    
    // 추출된 정보로 동적 장면 컨텍스트 생성
    const dynamicScene: WebtoonSceneContext = {
      location: sceneAnalysis.location,
      lighting: sceneAnalysis.lighting,
      mood: sceneAnalysis.mood,
      objects: sceneAnalysis.objects.length > 0 ? sceneAnalysis.objects : ["테이블", "의자"],
      timeOfDay: sceneAnalysis.timeOfDay,
      weather: "자연스러운 날씨"
    };
    
    console.log(`🎯 첫 패널 배경 디스크립터 생성:`, {
      장소타입: backgroundDescriptor.primaryType,
      색상구성: backgroundDescriptor.colorScheme,
      조명: backgroundDescriptor.lighting,
      고유특징: backgroundDescriptor.uniqueFeatures
    });
    
    return {
      panelNumber: 1,
      characters: [dynamicCharacter],
      scene: dynamicScene,
      visualStyle: {
        artStyle: "한국 웹툰 스타일, 선명한 라인아트",
        colorPalette: "따뜻한 톤, 자연스러운 컬러",
        lineWeight: "깔끔한 중간 두께 선",
        shading: "부드러운 셀 쉐이딩",
        perspective: "자연스러운 앵글, 장면에 최적화된 시점"
      },
      backgroundDescriptor // 🎯 배경 디스크립터 포함
    };
  }
  
  /**
   * 🔄 기본 웹툰 컨텍스트 생성 (하위 호환성)
   */
  static createInitialWebtoonContextLegacy(): WebtoonPanelContext {
    return {
      panelNumber: 1,
      characters: [
        {
          name: "주인공",
          physicalDetails: "분홍색 트윈테일 머리, 갈색 눈, 키 160cm, 날씬한 체형",
          clothing: "검은색 교복 재킷, 빨간 체크 스커트, 흰색 블라우스",
          accessories: "목에 빨간 리본, 검은색 무릎양말, 갈색 로퍼",
          personalityTraits: "자신감 있는 표정, 당당한 자세",
          lastSeenAction: "책상에 앉아 있음",
          lastSeenPose: "오른손으로 펜을 들고 있음"
        }
      ],
      scene: {
        location: "교실 뒷쪽 창가 자리",
        lighting: "따뜻한 오후 햇살이 창문을 통해 비침",
        mood: "평화롭고 일상적인 분위기",
        objects: ["나무 책상", "의자", "교과서", "필기구", "창문"],
        timeOfDay: "오후 2시경, 수업 시간",
        weather: "맑은 날씨, 창 밖으로 파란 하늘"
      },
      visualStyle: {
        artStyle: "한국 웹툰 스타일, 선명한 라인아트",
        colorPalette: "따뜻한 톤, 파스텔 컬러",
        lineWeight: "깔끔한 중간 두께 선",
        shading: "부드러운 셀 쉐이딩",
        perspective: "3/4 앵글, 약간 위에서 바라본 시점"
      }
    };
  }
}