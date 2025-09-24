import { createClient } from "@/lib/supabase/server";

interface UsageThresholds {
  maxGenerations: number;
  maxCharacters: number;
  maxProjects: number;
  maxPanels: number;
  maxTokens: number;
}

interface UserUsage {
  totalGenerations: number;
  totalCharacters: number;
  totalProjects: number;
  totalPanels: number;
  totalTokensUsed: number;
}

interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage: UserUsage;
  usageLevel: 'normal' | 'medium' | 'high' | 'warning' | 'critical';
  violations: Array<{
    type: string;
    current: number;
    limit: number;
    severity: string;
  }>;
}

export class UsageMonitor {
  private static instance: UsageMonitor;
  private cache: Map<string, { usage: UserUsage; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5분 캐시

  // 기본 사용량 제한 (플랜별로 다르게 설정 가능)
  private defaultThresholds: UsageThresholds = {
    maxGenerations: 10000,
    maxCharacters: 100,
    maxProjects: 100,
    maxPanels: 50000,
    maxTokens: 10000000,
  };

  static getInstance(): UsageMonitor {
    if (!UsageMonitor.instance) {
      UsageMonitor.instance = new UsageMonitor();
    }
    return UsageMonitor.instance;
  }

  /**
   * 사용자의 현재 사용량 조회 (캐시 우선)
   */
  async getUserUsage(userId: string): Promise<UserUsage> {
    const cached = this.cache.get(userId);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.usage;
    }

    const supabase = await createClient();

    const [
      generationsResult,
      charactersResult,
      projectsResult,
      panelsResult
    ] = await Promise.all([
      supabase
        .from('generation')
        .select('id, tokensUsed')
        .eq('userId', userId),
      
      supabase
        .from('character')
        .select('id')
        .eq('userId', userId),
      
      supabase
        .from('project')
        .select('id')
        .eq('userId', userId)
        .is('deletedAt', null),
      
      supabase
        .from('panel')
        .select('id')
        .in('projectId', 
          (await supabase
            .from('project')
            .select('id')
            .eq('userId', userId)
            .is('deletedAt', null)
          ).data?.map(p => p.id) || []
        )
    ]);

    const generations = generationsResult.data || [];
    const characters = charactersResult.data || [];
    const projects = projectsResult.data || [];
    const panels = panelsResult.data || [];

    const usage: UserUsage = {
      totalGenerations: generations.length,
      totalCharacters: characters.length,
      totalProjects: projects.length,
      totalPanels: panels.length,
      totalTokensUsed: generations.reduce((sum, g) => sum + (g.tokensUsed || 0), 0),
    };

    // 캐시 업데이트
    this.cache.set(userId, { usage, timestamp: Date.now() });

    return usage;
  }

  /**
   * 사용자 캐시 무효화 (사용량 변경 시 호출)
   */
  invalidateUserCache(userId: string): void {
    this.cache.delete(userId);
  }

  /**
   * 특정 작업 수행 전 사용량 검증
   */
  async checkUsageBeforeAction(
    userId: string,
    action: 'generation' | 'character' | 'project' | 'panel',
    count: number = 1,
    thresholds?: UsageThresholds
  ): Promise<UsageCheckResult> {
    const currentUsage = await this.getUserUsage(userId);
    const limits = thresholds || this.defaultThresholds;
    const violations = [];

    // 작업 후 예상 사용량 계산
    const projectedUsage = { ...currentUsage };
    switch (action) {
      case 'generation':
        projectedUsage.totalGenerations += count;
        break;
      case 'character':
        projectedUsage.totalCharacters += count;
        break;
      case 'project':
        projectedUsage.totalProjects += count;
        break;
      case 'panel':
        projectedUsage.totalPanels += count;
        break;
    }

    // 제한 검증
    if (projectedUsage.totalGenerations > limits.maxGenerations) {
      violations.push({
        type: 'generations',
        current: projectedUsage.totalGenerations,
        limit: limits.maxGenerations,
        severity: 'critical'
      });
    }

    if (projectedUsage.totalCharacters > limits.maxCharacters) {
      violations.push({
        type: 'characters',
        current: projectedUsage.totalCharacters,
        limit: limits.maxCharacters,
        severity: 'critical'
      });
    }

    if (projectedUsage.totalProjects > limits.maxProjects) {
      violations.push({
        type: 'projects',
        current: projectedUsage.totalProjects,
        limit: limits.maxProjects,
        severity: 'critical'
      });
    }

    if (projectedUsage.totalPanels > limits.maxPanels) {
      violations.push({
        type: 'panels',
        current: projectedUsage.totalPanels,
        limit: limits.maxPanels,
        severity: 'critical'
      });
    }

    // 사용량 레벨 계산
    const usageLevel = 
      violations.length > 0 ? 'critical' :
      currentUsage.totalGenerations > limits.maxGenerations * 0.8 ? 'warning' :
      currentUsage.totalGenerations > 1000 ? 'high' :
      currentUsage.totalGenerations > 100 ? 'medium' : 'normal';

    const allowed = violations.length === 0;
    const reason = violations.length > 0 
      ? `사용량 한도 초과: ${violations.map(v => `${v.type}(${v.current}/${v.limit})`).join(', ')}`
      : undefined;

    return {
      allowed,
      reason,
      currentUsage,
      usageLevel,
      violations
    };
  }

  /**
   * 비정상 사용량 사용자 식별
   */
  async identifyAbnormalUsers(): Promise<Array<{
    userId: string;
    usage: UserUsage;
    violations: Array<{ type: string; current: number; limit: number; severity: string }>;
  }>> {
    const supabase = await createClient();
    
    // 모든 활성 사용자 조회
    const { data: users } = await supabase
      .from('user')
      .select('id')
      .limit(1000); // 배치 처리로 제한

    if (!users) return [];

    const abnormalUsers = [];

    for (const user of users) {
      try {
        const checkResult = await this.checkUsageBeforeAction(user.id, 'generation', 0);
        
        if (checkResult.violations.length > 0) {
          abnormalUsers.push({
            userId: user.id,
            usage: checkResult.currentUsage,
            violations: checkResult.violations
          });
        }
      } catch (error) {
        console.error(`Error checking user ${user.id}:`, error);
      }
    }

    return abnormalUsers;
  }

  /**
   * 사용량 통계 생성
   */
  async generateUsageStats(): Promise<{
    totalUsers: number;
    normalUsers: number;
    warningUsers: number;
    criticalUsers: number;
    totalGenerations: number;
    totalCharacters: number;
    totalProjects: number;
  }> {
    const supabase = await createClient();
    
    const [
      usersResult,
      generationsResult,
      charactersResult,
      projectsResult
    ] = await Promise.all([
      supabase.from('user').select('id', { count: 'exact' }),
      supabase.from('generation').select('id', { count: 'exact' }),
      supabase.from('character').select('id', { count: 'exact' }),
      supabase.from('project').select('id', { count: 'exact' }).is('deletedAt', null)
    ]);

    return {
      totalUsers: usersResult.count || 0,
      normalUsers: 0, // 실제 계산 필요
      warningUsers: 0, // 실제 계산 필요
      criticalUsers: 0, // 실제 계산 필요
      totalGenerations: generationsResult.count || 0,
      totalCharacters: charactersResult.count || 0,
      totalProjects: projectsResult.count || 0,
    };
  }
}

// 싱글톤 인스턴스 내보내기
export const usageMonitor = UsageMonitor.getInstance();