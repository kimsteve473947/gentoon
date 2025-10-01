/**
 * 🧠 Gemini급 고급 컨텍스트 압축 시스템
 * 웹툰 스토리 연속성을 유지하면서 토큰을 최적화
 */

export interface WebtoonStoryContext {
  // 핵심 스토리 요소
  mainCharacters: string[]; // ["주인공 김철수", "히로인 이영희"]
  currentLocation: string;  // "학교 옥상"
  storyTension: string;     // "갈등 상황", "평화로운", "긴장감"
  emotionalTone: string;    // "로맨틱", "코믹", "시리어스"
  
  // 스토리 진행
  keyEvents: string[];      // ["고백 장면", "오해 발생"]
  storyArc: string;         // "만남 → 갈등 → 해결"
  
  // 시각적 연속성
  visualStyle: string;      // "밝은 톤", "어두운 분위기"
  cameraAngle: string;      // "클로즈업", "전체샷"
  
  // 최근 패널 요약
  recentPanelSummary: string; // 압축된 최근 2-3컷 요약
}

export interface PanelAnalysis {
  characters: string[];
  emotions: string[];
  actions: string[];
  visualElements: string[];
  storyProgression: string;
}

export class AdvancedContextCompressor {
  
  /**
   * 🎭 패널 내용 분석 및 핵심 요소 추출
   */
  static analyzePanelContent(
    panelNumber: number,
    userPrompt: string,
    generatedDescription: string
  ): PanelAnalysis {
    const fullText = `${userPrompt} ${generatedDescription}`;
    
    // 캐릭터 감지 (한국 이름 패턴)
    const characters = this.extractCharacters(fullText);
    
    // 감정 키워드 추출
    const emotions = this.extractEmotions(fullText);
    
    // 액션/행동 추출
    const actions = this.extractActions(fullText);
    
    // 시각적 요소 추출
    const visualElements = this.extractVisualElements(fullText);
    
    // 스토리 진행도 분석
    const storyProgression = this.analyzeStoryProgression(fullText, panelNumber);
    
    return {
      characters,
      emotions,
      actions,
      visualElements,
      storyProgression
    };
  }
  
  /**
   * 📚 웹툰 스토리 컨텍스트 생성
   */
  static buildWebtoonStoryContext(
    existingContext: WebtoonStoryContext | null,
    newPanelAnalysis: PanelAnalysis,
    panelNumber: number
  ): WebtoonStoryContext {
    
    if (!existingContext) {
      // 첫 패널 - 새 컨텍스트 생성
      return {
        mainCharacters: newPanelAnalysis.characters.slice(0, 3), // 최대 3명
        currentLocation: this.extractLocation(newPanelAnalysis.visualElements),
        storyTension: this.classifyTension(newPanelAnalysis.emotions),
        emotionalTone: this.classifyEmotionalTone(newPanelAnalysis.emotions),
        keyEvents: [newPanelAnalysis.storyProgression],
        storyArc: this.initializeStoryArc(newPanelAnalysis),
        visualStyle: this.extractVisualStyle(newPanelAnalysis.visualElements),
        cameraAngle: this.extractCameraAngle(newPanelAnalysis.visualElements),
        recentPanelSummary: this.summarizePanel(newPanelAnalysis, panelNumber)
      };
    }
    
    // 기존 컨텍스트 업데이트
    return {
      mainCharacters: this.updateMainCharacters(existingContext.mainCharacters, newPanelAnalysis.characters),
      currentLocation: this.updateLocation(existingContext.currentLocation, newPanelAnalysis.visualElements),
      storyTension: this.updateTension(existingContext.storyTension, newPanelAnalysis.emotions),
      emotionalTone: this.updateEmotionalTone(existingContext.emotionalTone, newPanelAnalysis.emotions),
      keyEvents: this.updateKeyEvents(existingContext.keyEvents, newPanelAnalysis.storyProgression),
      storyArc: this.updateStoryArc(existingContext.storyArc, newPanelAnalysis, panelNumber),
      visualStyle: this.updateVisualStyle(existingContext.visualStyle, newPanelAnalysis.visualElements),
      cameraAngle: this.updateCameraAngle(existingContext.cameraAngle, newPanelAnalysis.visualElements),
      recentPanelSummary: this.updateRecentSummary(existingContext.recentPanelSummary, newPanelAnalysis, panelNumber)
    };
  }
  
  /**
   * 🎯 웹툰 전용 컨텍스트 프롬프트 생성
   */
  static generateWebtoonContextPrompt(
    context: WebtoonStoryContext,
    userPrompt: string,
    panelNumber: number
  ): string {
    let contextPrompt = '';
    
    // 1. 스토리 연속성 정보 (간결하게)
    if (context.recentPanelSummary) {
      contextPrompt += `[스토리 흐름] ${context.recentPanelSummary}\\n`;
    }
    
    // 2. 핵심 캐릭터 정보
    if (context.mainCharacters.length > 0) {
      contextPrompt += `[등장인물] ${context.mainCharacters.join(', ')}\\n`;
    }
    
    // 3. 현재 상황/분위기
    const situationInfo = [
      context.currentLocation && `장소: ${context.currentLocation}`,
      context.emotionalTone && `분위기: ${context.emotionalTone}`,
      context.storyTension && `상황: ${context.storyTension}`
    ].filter(Boolean).join(', ');
    
    if (situationInfo) {
      contextPrompt += `[현재 상황] ${situationInfo}\\n`;
    }
    
    // 4. 시각적 연속성
    const visualInfo = [
      context.visualStyle && `스타일: ${context.visualStyle}`,
      context.cameraAngle && `앵글: ${context.cameraAngle}`
    ].filter(Boolean).join(', ');
    
    if (visualInfo) {
      contextPrompt += `[시각적 연속성] ${visualInfo}\\n`;
    }
    
    // 5. 스토리 진행 지시
    contextPrompt += `[${panelNumber}컷] 이전 장면과 자연스럽게 연결되는 다음 장면을 그려주세요.\\n`;
    
    // 최종 조합 (토큰 효율성)
    return `${contextPrompt}\\n${userPrompt}`;
  }
  
  // ================== 내부 분석 메서드들 ==================
  
  private static extractCharacters(text: string): string[] {
    const koreanNamePattern = /[가-힣]{2,4}(?=\s|$|,|\.)/g;
    const matches = text.match(koreanNamePattern) || [];
    return [...new Set(matches)].slice(0, 5); // 중복 제거, 최대 5명
  }
  
  private static extractEmotions(text: string): string[] {
    const emotionKeywords = [
      '기쁨', '슬픔', '분노', '놀람', '두려움', '혐오', '행복',
      '화남', '웃음', '울음', '미소', '찡그림', '당황', '부끄러움',
      '사랑', '미움', '질투', '후회', '걱정', '안도', '희망'
    ];
    
    return emotionKeywords.filter(emotion => 
      text.includes(emotion)
    ).slice(0, 3);
  }
  
  private static extractActions(text: string): string[] {
    const actionKeywords = [
      '걷다', '뛰다', '앉다', '서다', '말하다', '웃다', '울다',
      '바라보다', '돌아보다', '손을 흔들다', '포옹하다', '키스하다',
      '싸우다', '도망가다', '쫓다', '숨다', '발견하다'
    ];
    
    return actionKeywords.filter(action => 
      text.includes(action.replace('다', ''))
    ).slice(0, 3);
  }
  
  private static extractVisualElements(text: string): string[] {
    const visualKeywords = [
      '클로즈업', '전체샷', '중간샷', '배경', '실내', '실외',
      '밝은', '어두운', '화려한', '단순한', '복잡한',
      '학교', '집', '카페', '공원', '바다', '산'
    ];
    
    return visualKeywords.filter(visual => 
      text.includes(visual)
    ).slice(0, 4);
  }
  
  private static analyzeStoryProgression(text: string, panelNumber: number): string {
    // 스토리 진행 단계 분석
    if (panelNumber <= 2) return "스토리 시작";
    if (text.includes('갈등') || text.includes('문제')) return "갈등 발생";
    if (text.includes('해결') || text.includes('화해')) return "갈등 해결";
    if (text.includes('결말') || text.includes('끝')) return "스토리 마무리";
    return "스토리 진행";
  }
  
  private static extractLocation(visualElements: string[]): string {
    const locations = ['학교', '집', '카페', '공원', '바다', '산', '도시', '시골'];
    const found = visualElements.find(element => 
      locations.some(loc => element.includes(loc))
    );
    return found || "일반적인 장소";
  }
  
  private static classifyTension(emotions: string[]): string {
    if (emotions.some(e => ['분노', '화남', '싸움'].includes(e))) return "긴장 상황";
    if (emotions.some(e => ['기쁨', '행복', '웃음'].includes(e))) return "평화로운";
    if (emotions.some(e => ['두려움', '걱정', '당황'].includes(e))) return "불안한";
    return "평온한";
  }
  
  private static classifyEmotionalTone(emotions: string[]): string {
    if (emotions.some(e => ['사랑', '미소', '포옹'].includes(e))) return "로맨틱";
    if (emotions.some(e => ['웃음', '기쁨', '장난'].includes(e))) return "코믹";
    if (emotions.some(e => ['슬픔', '울음', '후회'].includes(e))) return "시리어스";
    return "일상적";
  }
  
  private static initializeStoryArc(analysis: PanelAnalysis): string {
    return "시작";
  }
  
  private static extractVisualStyle(visualElements: string[]): string {
    if (visualElements.some(e => e.includes('밝은'))) return "밝은 톤";
    if (visualElements.some(e => e.includes('어두운'))) return "어두운 톤";
    return "자연스러운 톤";
  }
  
  private static extractCameraAngle(visualElements: string[]): string {
    if (visualElements.includes('클로즈업')) return "클로즈업";
    if (visualElements.includes('전체샷')) return "전체샷";
    return "중간샷";
  }
  
  private static summarizePanel(analysis: PanelAnalysis, panelNumber: number): string {
    const summary = [
      analysis.characters.length > 0 ? analysis.characters[0] : '',
      analysis.actions.length > 0 ? analysis.actions[0] : '',
      analysis.emotions.length > 0 ? analysis.emotions[0] : ''
    ].filter(Boolean).join(' ');
    
    return `${panelNumber}컷: ${summary}`.substring(0, 50);
  }
  
  // ================== 업데이트 메서드들 ==================
  
  private static updateMainCharacters(existing: string[], newChars: string[]): string[] {
    const combined = [...existing, ...newChars];
    return [...new Set(combined)].slice(0, 3); // 최대 3명 유지
  }
  
  private static updateLocation(existing: string, newVisuals: string[]): string {
    const newLocation = this.extractLocation(newVisuals);
    return newLocation !== "일반적인 장소" ? newLocation : existing;
  }
  
  private static updateTension(existing: string, newEmotions: string[]): string {
    const newTension = this.classifyTension(newEmotions);
    return newTension !== "평온한" ? newTension : existing;
  }
  
  private static updateEmotionalTone(existing: string, newEmotions: string[]): string {
    const newTone = this.classifyEmotionalTone(newEmotions);
    return newTone !== "일상적" ? newTone : existing;
  }
  
  private static updateKeyEvents(existing: string[], newEvent: string): string[] {
    if (newEvent && !existing.includes(newEvent)) {
      const updated = [...existing, newEvent];
      return updated.slice(-3); // 최근 3개 이벤트만 유지
    }
    return existing;
  }
  
  private static updateStoryArc(existing: string, analysis: PanelAnalysis, panelNumber: number): string {
    // 스토리 아크 진행 업데이트 로직
    if (panelNumber <= 3) return "도입부";
    if (panelNumber <= 6) return "전개";
    if (panelNumber <= 9) return "클라이맥스";
    return "결말";
  }
  
  private static updateVisualStyle(existing: string, newVisuals: string[]): string {
    const newStyle = this.extractVisualStyle(newVisuals);
    return newStyle !== "자연스러운 톤" ? newStyle : existing;
  }
  
  private static updateCameraAngle(existing: string, newVisuals: string[]): string {
    const newAngle = this.extractCameraAngle(newVisuals);
    return newAngle !== "중간샷" ? newAngle : existing;
  }
  
  private static updateRecentSummary(
    existing: string, 
    analysis: PanelAnalysis, 
    panelNumber: number
  ): string {
    const newSummary = this.summarizePanel(analysis, panelNumber);
    const summaries = existing ? existing.split(' | ') : [];
    summaries.push(newSummary);
    
    // 최근 2개 패널 요약만 유지
    return summaries.slice(-2).join(' | ');
  }
}