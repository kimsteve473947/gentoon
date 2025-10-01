/**
 * 프로젝트별 컨텍스트 관리 시스템
 * 웹툰 제작에서 스토리 연속성과 캐릭터 일관성 유지
 */

export interface ProjectContext {
  projectId: string;
  userId: string;
  
  // 스토리 컨텍스트
  storyLine: string; // 전체 스토리 요약
  currentScene: string; // 현재 장면 설명
  
  // 캐릭터 컨텍스트
  characters: Array<{
    id: string;
    name: string;
    description: string;
    currentState: string; // "바다에서 배를 타고 있음"
    lastAppearance: number; // 마지막 등장 패널 번호
  }>;
  
  // 배경/설정 컨텍스트
  currentLocation: string; // "바다, 작은 어선 위"
  timeOfDay: string; // "오후, 해질녘"
  mood: string; // "평화로운, 약간의 긴장감"
  
  // 패널 히스토리 (최근 5개 패널만 유지)
  panelHistory: Array<{
    panelNumber: number;
    prompt: string;
    description: string;
    generatedAt: Date;
    imageUrl?: string;
  }>;
  
  // 중요한 설정들
  artStyle: string; // "한국 웹툰 스타일, 컬러풀한 톤"
  aspectRatio: '1:1' | '4:5';
  
  // 메타데이터
  lastUpdated: Date;
  tokenUsage: number;
}

export class ProjectContextManager {
  private static contexts = new Map<string, ProjectContext>();
  
  /**
   * 프로젝트 컨텍스트 초기화 또는 로드
   */
  static async getProjectContext(
    projectId: string, 
    userId: string
  ): Promise<ProjectContext> {
    const contextKey = `${projectId}-${userId}`;
    
    if (!this.contexts.has(contextKey)) {
      // 새 프로젝트 컨텍스트 생성
      const newContext: ProjectContext = {
        projectId,
        userId,
        storyLine: "",
        currentScene: "",
        characters: [],
        currentLocation: "",
        timeOfDay: "",
        mood: "",
        panelHistory: [],
        artStyle: "한국 웹툰 스타일, 세밀한 디지털 아트",
        aspectRatio: '4:5',
        lastUpdated: new Date(),
        tokenUsage: 0
      };
      
      this.contexts.set(contextKey, newContext);
      console.log(`🆕 새 프로젝트 컨텍스트 생성: ${contextKey}`);
    }
    
    return this.contexts.get(contextKey)!;
  }
  
  /**
   * 새 패널 생성 시 컨텍스트 업데이트
   */
  static updateContextForNewPanel(
    projectId: string,
    userId: string,
    panelNumber: number,
    prompt: string,
    generatedDescription: string,
    imageUrl?: string
  ): void {
    const contextKey = `${projectId}-${userId}`;
    const context = this.contexts.get(contextKey);
    
    if (context) {
      // 패널 히스토리 추가 (최근 5개만 유지)
      context.panelHistory.push({
        panelNumber,
        prompt,
        description: generatedDescription,
        generatedAt: new Date(),
        imageUrl
      });
      
      // 최근 5개 패널만 유지 (토큰 절약)
      if (context.panelHistory.length > 5) {
        context.panelHistory = context.panelHistory.slice(-5);
      }
      
      context.lastUpdated = new Date();
      
      console.log(`📝 프로젝트 컨텍스트 업데이트: ${contextKey}, 패널 ${panelNumber}`);
    }
  }
  
  /**
   * 컨텍스트를 고려한 향상된 프롬프트 생성
   */
  static buildContextAwarePrompt(
    projectId: string,
    userId: string,
    userPrompt: string,
    panelNumber: number
  ): string {
    const context = this.contexts.get(`${projectId}-${userId}`);
    
    if (!context || context.panelHistory.length === 0) {
      // 첫 패널이거나 컨텍스트가 없는 경우
      return userPrompt;
    }
    
    // 컨텍스트 기반 향상된 프롬프트 구성
    let contextPrompt = "";
    
    // 1. 스토리 연속성 정보
    if (context.panelHistory.length > 0) {
      const recentPanels = context.panelHistory.slice(-2); // 최근 2개 패널
      contextPrompt += `\n[스토리 연속성 정보]\n`;
      recentPanels.forEach(panel => {
        contextPrompt += `- ${panel.panelNumber}컷: ${panel.description}\n`;
      });
    }
    
    // 2. 현재 설정 정보
    if (context.currentLocation || context.timeOfDay || context.mood) {
      contextPrompt += `\n[현재 설정]\n`;
      if (context.currentLocation) contextPrompt += `- 장소: ${context.currentLocation}\n`;
      if (context.timeOfDay) contextPrompt += `- 시간: ${context.timeOfDay}\n`;
      if (context.mood) contextPrompt += `- 분위기: ${context.mood}\n`;
    }
    
    // 3. 등장 캐릭터 정보
    if (context.characters.length > 0) {
      contextPrompt += `\n[등장 캐릭터]\n`;
      context.characters.forEach(char => {
        contextPrompt += `- ${char.name}: ${char.currentState}\n`;
      });
    }
    
    // 4. 아트 스타일 일관성
    contextPrompt += `\n[아트 스타일]: ${context.artStyle}\n`;
    
    // 5. 연속성 지시
    contextPrompt += `\n[연속성 요구사항]\n`;
    contextPrompt += `- 이전 패널들과 시각적, 스토리적 연속성을 유지하세요\n`;
    contextPrompt += `- 캐릭터의 외형과 설정을 일관되게 유지하세요\n`;
    contextPrompt += `- 배경과 분위기의 자연스러운 전환을 고려하세요\n`;
    
    // 최종 프롬프트 조합
    const finalPrompt = `${contextPrompt}\n\n[${panelNumber}컷 생성 요청]\n${userPrompt}`;
    
    console.log(`🧠 컨텍스트 인식 프롬프트 생성 완료 (${panelNumber}컷)`);
    
    return finalPrompt;
  }
  
  /**
   * 메모리 정리
   */
  static cleanup(): void {
    // 1시간 이상 사용되지 않은 컨텍스트 정리
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    for (const [key, context] of this.contexts.entries()) {
      if (context.lastUpdated < oneHourAgo) {
        this.contexts.delete(key);
        console.log(`🧹 만료된 프로젝트 컨텍스트 정리: ${key}`);
      }
    }
  }
  
  /**
   * 통계 정보
   */
  static getStats(): {
    activeProjects: number;
    totalTokenUsage: number;
    contextKeys: string[];
  } {
    const activeProjects = this.contexts.size;
    const totalTokenUsage = Array.from(this.contexts.values())
      .reduce((sum, ctx) => sum + ctx.tokenUsage, 0);
    const contextKeys = Array.from(this.contexts.keys());
    
    return {
      activeProjects,
      totalTokenUsage,
      contextKeys
    };
  }
}

// 1시간마다 메모리 정리
setInterval(() => {
  ProjectContextManager.cleanup();
}, 60 * 60 * 1000);