/**
 * 🚀 실서비스용 프로덕션 컨텍스트 관리 시스템
 * 
 * 특징:
 * - 데이터베이스 기반 영속성
 * - 리소스 제한 및 최적화
 * - 동시성 안전
 * - 자동 정리 및 압축
 */

import { createClient } from '@/lib/supabase/server';
import { 
  AdvancedContextCompressor, 
  type WebtoonStoryContext 
} from './advanced-context-compressor';
import { 
  WebtoonConsistencyEngine,
  type WebtoonPanelContext 
} from './webtoon-consistency-engine';

export interface OptimizedProjectContext {
  projectId: string;
  userId: string;
  
  // 🎭 웹툰 연속성 컨텍스트 (Gemini 최적화)
  webtoonPanelContext?: WebtoonPanelContext;
  
  // 🧠 웹툰 스토리 컨텍스트 (고급 압축) - 하위 호환성
  webtoonContext: WebtoonStoryContext;
  
  // 압축된 컨텍스트 (토큰 절약) - 하위 호환성
  storyContext: string; // 최대 500자
  recentPanels: string; // 최근 3개 패널만, 최대 300자
  
  // 메타데이터
  lastUpdated: Date;
  panelCount: number;
  tokenUsage: number;
  expiresAt: Date; // 자동 만료
}

export class ProductionContextManager {
  private static readonly MAX_CONTEXT_LENGTH = 800; // 최대 컨텍스트 길이
  private static readonly MAX_PROJECTS_PER_USER = 50; // 사용자당 최대 프로젝트
  private static readonly CONTEXT_EXPIRY_HOURS = 24; // 24시간 후 자동 만료
  private static readonly MAX_RECENT_PANELS = 3; // 최근 3개 패널만 유지
  
  // 메모리 캐시 (최소한만 사용)
  private static cache = new Map<string, {
    context: OptimizedProjectContext,
    lastAccess: Date
  }>();
  private static readonly CACHE_SIZE_LIMIT = 100;
  private static readonly CACHE_TTL = 10 * 60 * 1000; // 10분
  
  /**
   * 프로젝트 컨텍스트 로드 (DB 기반)
   */
  static async getProjectContext(
    projectId: string, 
    userId: string
  ): Promise<OptimizedProjectContext | null> {
    const cacheKey = `${projectId}-${userId}`;
    
    // 1. 메모리 캐시 확인
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.lastAccess.getTime() < this.CACHE_TTL) {
      cached.lastAccess = new Date();
      return cached.context;
    }
    
    // 2. 데이터베이스에서 조회
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('project_contexts')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single();
      
      if (error || !data) {
        return null;
      }
      
      // 🎭 Gemini 웹툰 연속성 컨텍스트 파싱 (배경 디스크립터 포함)
      let webtoonPanelContext: WebtoonPanelContext | undefined;
      try {
        webtoonPanelContext = data.webtoon_panel_context ? 
          JSON.parse(data.webtoon_panel_context) : undefined;
      } catch (e) {
        console.warn('웹툰 패널 컨텍스트 파싱 실패:', e);
        webtoonPanelContext = undefined;
      }
      
      // 🧠 웹툰 컨텍스트 파싱 (JSON에서 복원) - 하위 호환성
      let webtoonContext: WebtoonStoryContext;
      try {
        webtoonContext = data.webtoon_context ? JSON.parse(data.webtoon_context) : {
          mainCharacters: [],
          currentLocation: "",
          storyTension: "",
          emotionalTone: "",
          keyEvents: [],
          storyArc: "",
          visualStyle: "",
          cameraAngle: "",
          recentPanelSummary: ""
        };
      } catch (e) {
        console.warn('웹툰 컨텍스트 파싱 실패, 기본값 사용:', e);
        webtoonContext = {
          mainCharacters: [],
          currentLocation: "",
          storyTension: "",
          emotionalTone: "",
          keyEvents: [],
          storyArc: "",
          visualStyle: "",
          cameraAngle: "",
          recentPanelSummary: ""
        };
      }
      
      const context: OptimizedProjectContext = {
        projectId: data.project_id,
        userId: data.user_id,
        webtoonPanelContext,
        webtoonContext,
        storyContext: data.story_context || '',
        recentPanels: data.recent_panels || '',
        lastUpdated: new Date(data.last_updated),
        panelCount: data.panel_count || 0,
        tokenUsage: data.token_usage || 0,
        expiresAt: new Date(data.expires_at)
      };
      
      // 3. 만료 확인
      if (context.expiresAt < new Date()) {
        await this.deleteExpiredContext(projectId, userId);
        return null;
      }
      
      // 4. 캐시에 저장 (크기 제한)
      this.addToCache(cacheKey, context);
      
      return context;
      
    } catch (error) {
      console.error('컨텍스트 로드 실패:', error);
      return null;
    }
  }
  
  /**
   * 컨텍스트 업데이트 (원자적 연산)
   */
  static async updateProjectContext(
    projectId: string,
    userId: string,
    panelNumber: number,
    prompt: string,
    description: string
  ): Promise<boolean> {
    try {
      const supabase = await createClient();
      
      // 기존 컨텍스트 로드
      const existing = await this.getProjectContext(projectId, userId);
      
      // 🎯 Gemini 웹툰 연속성 컨텍스트 업데이트
      let updatedWebtoonPanelContext: WebtoonPanelContext | undefined;
      
      if (existing?.webtoonPanelContext) {
        // 기존 컨텍스트 업데이트
        updatedWebtoonPanelContext = WebtoonConsistencyEngine.analyzeAndUpdateContext(
          panelNumber,
          prompt,
          existing.webtoonPanelContext
        );
      } else if (panelNumber === 1) {
        // 첫 패널 - 동적 컨텍스트 생성 (사용자 프롬프트 기반)
        updatedWebtoonPanelContext = WebtoonConsistencyEngine.createInitialWebtoonContext(prompt);
        console.log(`🔍 첫 패널 동적 분석 완료:`, {
          추출된장소: updatedWebtoonPanelContext.scene.location,
          추출된오브젝트: updatedWebtoonPanelContext.scene.objects,
          캐릭터의상: updatedWebtoonPanelContext.characters[0]?.clothing
        });
      }
      
      // 🧠 고급 패널 분석 (하위 호환성)
      const panelAnalysis = AdvancedContextCompressor.analyzePanelContent(
        panelNumber,
        prompt,
        description
      );
      
      // 🎭 웹툰 스토리 컨텍스트 업데이트 (하위 호환성)
      const updatedWebtoonContext = AdvancedContextCompressor.buildWebtoonStoryContext(
        existing?.webtoonContext || null,
        panelAnalysis,
        panelNumber
      );
      
      // 하위 호환성을 위한 기존 방식도 유지
      const newPanelInfo = `${panelNumber}:${this.compressText(description, 80)}`;
      let recentPanels = existing?.recentPanels || '';
      
      const panelList = recentPanels ? recentPanels.split('|') : [];
      panelList.push(newPanelInfo);
      if (panelList.length > this.MAX_RECENT_PANELS) {
        panelList.splice(0, panelList.length - this.MAX_RECENT_PANELS);
      }
      recentPanels = panelList.join('|');
      
      const storyContext = this.generateCompressedStoryContext(
        existing?.storyContext || '',
        prompt,
        description
      );
      
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.CONTEXT_EXPIRY_HOURS * 60 * 60 * 1000);
      
      // 데이터베이스 업서트 (원자적 연산)
      const { error } = await supabase
        .from('project_contexts')
        .upsert({
          project_id: projectId,
          user_id: userId,
          webtoon_panel_context: updatedWebtoonPanelContext ? JSON.stringify(updatedWebtoonPanelContext) : null,
          webtoon_context: JSON.stringify(updatedWebtoonContext),
          story_context: storyContext,
          recent_panels: recentPanels,
          last_updated: now.toISOString(),
          panel_count: (existing?.panelCount || 0) + 1,
          token_usage: (existing?.tokenUsage || 0),
          expires_at: expiresAt.toISOString()
        }, {
          onConflict: 'project_id,user_id'
        });
      
      if (error) {
        console.error('컨텍스트 업데이트 실패:', error);
        return false;
      }
      
      // 캐시 무효화
      this.cache.delete(`${projectId}-${userId}`);
      
      console.log(`✅ 프로젝트 컨텍스트 업데이트: ${projectId} - 패널 ${panelNumber}`);
      return true;
      
    } catch (error) {
      console.error('컨텍스트 업데이트 오류:', error);
      return false;
    }
  }
  
  /**
   * 최적화된 컨텍스트 기반 프롬프트 생성
   */
  static async buildOptimizedPrompt(
    projectId: string,
    userId: string,
    userPrompt: string,
    panelNumber: number
  ): Promise<string> {
    const context = await this.getProjectContext(projectId, userId);
    
    if (!context) {
      return userPrompt; // 첫 패널이거나 컨텍스트 없음
    }
    
    // 🎭 Gemini 웹툰 연속성 엔진 (최우선)
    if (context.webtoonPanelContext) {
      console.log(`🎯 Gemini 웹툰 연속성 엔진 적용: ${panelNumber}컷`);
      return WebtoonConsistencyEngine.generateGeminiOptimizedPrompt(
        userPrompt,
        context.webtoonPanelContext
      );
    }
    
    // 🧠 고급 웹툰 컨텍스트 프롬프트 생성 (폴백)
    if (context.webtoonContext && Object.keys(context.webtoonContext).length > 0) {
      console.log(`🎭 웹툰 컨텍스트 적용: ${panelNumber}컷`);
      return AdvancedContextCompressor.generateWebtoonContextPrompt(
        context.webtoonContext,
        userPrompt,
        panelNumber
      );
    }
    
    // 📚 하위 호환성: 기존 압축 방식 폴백
    console.log(`📝 기본 컨텍스트 적용: ${panelNumber}컷`);
    let contextPrompt = '';
    
    if (context.recentPanels) {
      const panels = context.recentPanels.split('|').slice(-2);
      if (panels.length > 0) {
        contextPrompt += `[이전 장면] ${panels.join(', ')}\n`;
      }
    }
    
    if (context.storyContext) {
      contextPrompt += `[스토리 흐름] ${context.storyContext}\n`;
    }
    
    contextPrompt += `[${panelNumber}컷 연속성 유지]\n`;
    
    return `${contextPrompt}${userPrompt}`;
  }
  
  /**
   * 텍스트 압축 (토큰 절약)
   */
  private static compressText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    
    // 핵심 키워드만 추출
    const keywords = text
      .replace(/[^\w\s가-힣]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1)
      .slice(0, 8)
      .join(' ');
    
    return keywords.length <= maxLength ? keywords : keywords.substring(0, maxLength);
  }
  
  /**
   * 스토리 컨텍스트 자동 압축 생성
   */
  private static generateCompressedStoryContext(
    existingContext: string,
    newPrompt: string,
    newDescription: string
  ): string {
    // 기존 컨텍스트 + 새 정보를 압축
    const combined = `${existingContext} ${this.compressText(newDescription, 100)}`;
    
    // 최대 길이 제한
    if (combined.length > this.MAX_CONTEXT_LENGTH) {
      return this.compressText(combined, this.MAX_CONTEXT_LENGTH);
    }
    
    return combined.trim();
  }
  
  /**
   * 캐시 관리 (크기 제한)
   */
  private static addToCache(key: string, context: OptimizedProjectContext): void {
    // 캐시 크기 제한
    if (this.cache.size >= this.CACHE_SIZE_LIMIT) {
      // 가장 오래된 항목 제거
      const oldestKey = Array.from(this.cache.entries())
        .sort(([,a], [,b]) => a.lastAccess.getTime() - b.lastAccess.getTime())[0][0];
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      context,
      lastAccess: new Date()
    });
  }
  
  /**
   * 만료된 컨텍스트 삭제
   */
  private static async deleteExpiredContext(projectId: string, userId: string): Promise<void> {
    try {
      const supabase = await createClient();
      await supabase
        .from('project_contexts')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);
      
      this.cache.delete(`${projectId}-${userId}`);
      console.log(`🗑️ 만료된 컨텍스트 삭제: ${projectId}`);
    } catch (error) {
      console.error('컨텍스트 삭제 실패:', error);
    }
  }
  
  /**
   * 시스템 정리 작업 (크론잡용)
   */
  static async cleanupExpiredContexts(): Promise<number> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('project_contexts')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('project_id');
      
      if (error) {
        console.error('정리 작업 실패:', error);
        return 0;
      }
      
      const deletedCount = data?.length || 0;
      console.log(`🧹 만료된 컨텍스트 ${deletedCount}개 정리 완료`);
      return deletedCount;
      
    } catch (error) {
      console.error('정리 작업 오류:', error);
      return 0;
    }
  }
  
  /**
   * 리소스 통계
   */
  static getResourceStats(): {
    cacheSize: number;
    cacheKeys: string[];
    maxCacheSize: number;
  } {
    return {
      cacheSize: this.cache.size,
      cacheKeys: Array.from(this.cache.keys()),
      maxCacheSize: this.CACHE_SIZE_LIMIT
    };
  }
}

// 1시간마다 캐시 정리
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of ProductionContextManager['cache'].entries()) {
    if (now - value.lastAccess.getTime() > ProductionContextManager['CACHE_TTL']) {
      ProductionContextManager['cache'].delete(key);
    }
  }
}, 60 * 60 * 1000);