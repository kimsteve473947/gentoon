import { createClient } from '@/lib/supabase/server';

// 사용자별 캐시 업데이트를 위한 통합 관리 시스템
export class UsageCacheManager {
  private static supabaseCache: any = null;
  private static cacheExpiry: number = 0;
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5분 TTL
  private static readonly MAX_PARALLEL_REQUESTS = 5;
  private static pendingRequests = new Map<string, Promise<any>>();

  // 🚀 성능 최적화: Supabase 클라이언트 캐싱
  private static async getSupabase() {
    const now = Date.now();
    
    if (!this.supabaseCache || now > this.cacheExpiry) {
      this.supabaseCache = await createClient();
      this.cacheExpiry = now + this.CACHE_TTL;
    }
    
    return this.supabaseCache;
  }

  // 🚀 메모리 최적화: 중복 요청 방지
  private static async deduplicateRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    if (this.pendingRequests.has(key)) {
      console.log(`📋 중복 요청 방지: ${key}`);
      return await this.pendingRequests.get(key);
    }

    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  // 프로젝트 생성/삭제 시 캐시 업데이트
  static async updateProjectCount(userId: string, change: number = 0) {
    return this.deduplicateRequest(`project-${userId}`, async () => {
      try {
        const supabase = await this.getSupabase();
        
        // 실제 프로젝트 개수 조회 (최적화된 쿼리)
        const { count: totalProjects } = await supabase
          .from('project')
          .select('id', { count: 'exact', head: true })
          .eq('userId', userId)
          .is('deletedAt', null); // soft delete 고려

        await this.updateUserCache(userId, {
          total_projects: totalProjects || 0
        });

        console.log(`✅ [UsageCache] 사용자 ${userId} 프로젝트 캐시 업데이트: ${totalProjects}개`);
        return totalProjects;
      } catch (error) {
        console.error('❌ [UsageCache] 프로젝트 캐시 업데이트 실패:', error);
        return 0;
      }
    });
  }

  // 캐릭터 생성/삭제 시 캐시 업데이트
  static async updateCharacterCount(userId: string, change: number = 0) {
    return this.deduplicateRequest(`character-${userId}`, async () => {
      try {
        const supabase = await this.getSupabase();
        
        // 실제 캐릭터 개수 조회
        const { count: totalCharacters } = await supabase
          .from('character')
          .select('id', { count: 'exact', head: true })
          .eq('userId', userId);

        await this.updateUserCache(userId, {
          total_characters: totalCharacters || 0
        });

        console.log(`✅ [UsageCache] 사용자 ${userId} 캐릭터 캐시 업데이트: ${totalCharacters}개`);
        return totalCharacters;
      } catch (error) {
        console.error('❌ [UsageCache] 캐릭터 캐시 업데이트 실패:', error);
        return 0;
      }
    });
  }

  // 이미지 생성 시 토큰 사용량 및 이미지 수 캐시 업데이트
  static async updateGenerationStats(userId: string, tokensUsed: number = 2) {
    try {
      const supabase = await this.getSupabase();
      const now = new Date();
      const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
      
      // 현재 월 이미지 생성 수 조회
      const { count: currentMonthImages } = await supabase
        .from('generation')
        .select('id', { count: 'exact', head: true })
        .eq('userId', userId)
        .gte('createdAt', `${currentMonth}-01T00:00:00.000Z`)
        .lt('createdAt', this.getNextMonthStart(currentMonth));

      // 현재 월 토큰 사용량 조회 (구독 테이블에서)
      const { data: subscription } = await supabase
        .from('subscription')
        .select('tokensUsed')
        .eq('userId', userId)
        .single();

      await this.updateUserCache(userId, {
        current_month_images: currentMonthImages || 0,
        current_month_tokens: subscription?.tokensUsed || 0
      });

      console.log(`✅ [UsageCache] 사용자 ${userId} 생성 통계 캐시 업데이트: 이미지 ${currentMonthImages}개, 토큰 ${subscription?.tokensUsed || 0}개`);
      return { images: currentMonthImages, tokens: subscription?.tokensUsed || 0 };
    } catch (error) {
      console.error('❌ [UsageCache] 생성 통계 캐시 업데이트 실패:', error);
      return { images: 0, tokens: 0 };
    }
  }

  // 스토리지 사용량 캐시 업데이트
  static async updateStorageUsage(userId: string) {
    try {
      const supabase = await this.getSupabase();
      
      // user_storage 테이블에서 실제 사용량 조회
      const { data: storage } = await supabase
        .from('user_storage')
        .select('used_bytes, max_bytes')
        .eq('userId', userId)
        .single();

      if (storage) {
        await this.updateUserCache(userId, {
          storage_used_bytes: storage.used_bytes,
          storage_limit_bytes: storage.max_bytes
        });

        console.log(`✅ [UsageCache] 사용자 ${userId} 스토리지 캐시 업데이트: ${storage.used_bytes}/${storage.max_bytes} bytes`);
        return { used: storage.used_bytes, limit: storage.max_bytes };
      }
      return { used: 0, limit: 1073741824 };
    } catch (error) {
      console.error('❌ [UsageCache] 스토리지 캐시 업데이트 실패:', error);
      return { used: 0, limit: 1073741824 };
    }
  }

  // 전체 캐시 새로고침 (관리자용)
  static async refreshAllUserCache(userId: string) {
    try {
      const supabase = await this.getSupabase();
      
      // 모든 실제 데이터 조회
      const [
        { count: totalProjects },
        { count: totalCharacters },
        { count: currentMonthImages },
        { data: subscription },
        { data: storage }
      ] = await Promise.all([
        supabase
          .from('project')
          .select('id', { count: 'exact', head: true })
          .eq('userId', userId)
          .is('deletedAt', null),
        
        supabase
          .from('character')
          .select('id', { count: 'exact', head: true })
          .eq('userId', userId),
          
        supabase
          .from('generation')
          .select('id', { count: 'exact', head: true })
          .eq('userId', userId)
          .gte('createdAt', this.getCurrentMonthStart()),
          
        supabase
          .from('subscription')
          .select('tokensUsed')
          .eq('userId', userId)
          .single(),
          
        supabase
          .from('user_storage')
          .select('used_bytes, max_bytes')
          .eq('userId', userId)
          .single()
      ]);

      const cacheData = {
        user_id: userId,
        total_projects: totalProjects || 0,
        total_characters: totalCharacters || 0,
        current_month_images: currentMonthImages || 0,
        current_month_tokens: subscription?.tokensUsed || 0,
        storage_used_bytes: storage?.used_bytes || 0,
        storage_limit_bytes: storage?.max_bytes || 1073741824,
        last_calculated: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await supabase
        .from('user_usage_cache')
        .upsert(cacheData, { onConflict: 'user_id' });

      console.log(`🔄 [UsageCache] 사용자 ${userId} 전체 캐시 새로고침 완료:`, cacheData);
      return cacheData;
    } catch (error) {
      console.error('❌ [UsageCache] 전체 캐시 새로고침 실패:', error);
      return null;
    }
  }

  // 모든 사용자 캐시 새로고침 (관리자용)
  static async refreshAllUsersCache() {
    try {
      const supabase = await this.getSupabase();
      
      // 모든 사용자 ID 조회
      const { data: users } = await supabase
        .from('user')
        .select('id');

      if (!users) return { success: false, updated: 0 };

      let updated = 0;
      for (const user of users) {
        try {
          await this.refreshAllUserCache(user.id);
          updated++;
        } catch (error) {
          console.error(`❌ 사용자 ${user.id} 캐시 업데이트 실패:`, error);
        }
      }

      console.log(`🚀 [UsageCache] 전체 사용자 캐시 새로고침 완료: ${updated}/${users.length}명`);
      return { success: true, updated, total: users.length };
    } catch (error) {
      console.error('❌ [UsageCache] 전체 사용자 캐시 새로고침 실패:', error);
      return { success: false, updated: 0 };
    }
  }

  // 내부 헬퍼 함수들
  private static async updateUserCache(userId: string, updateData: Partial<any>) {
    const supabase = await this.getSupabase();
    
    return await supabase
      .from('user_usage_cache')
      .upsert({
        user_id: userId,
        ...updateData,
        last_calculated: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
  }

  private static getCurrentMonthStart(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`;
  }

  private static getNextMonthStart(currentMonth: string): string {
    const [year, month] = currentMonth.split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000Z`;
  }

  // 🚀 메모리 정리 함수들
  static clearCache() {
    this.supabaseCache = null;
    this.cacheExpiry = 0;
    this.pendingRequests.clear();
    console.log('🧹 UsageCacheManager 캐시 정리 완료');
  }

  static getCacheStats() {
    return {
      supabaseCacheActive: !!this.supabaseCache,
      cacheExpiry: new Date(this.cacheExpiry).toISOString(),
      pendingRequestsCount: this.pendingRequests.size,
      pendingKeys: Array.from(this.pendingRequests.keys())
    };
  }

  // 🚀 배치 처리로 메모리 효율성 증대
  static async batchUpdateUserCaches(userIds: string[]) {
    const batchSize = this.MAX_PARALLEL_REQUESTS;
    const results = [];
    
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(userId => 
        this.refreshAllUserCache(userId).catch(error => {
          console.error(`배치 캐시 업데이트 실패 (${userId}):`, error);
          return null;
        })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // 배치 간 짧은 지연 (메모리 압박 완화)
      if (i + batchSize < userIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results.filter(result => result !== null);
  }
}

// 트리거 함수들 (실제 데이터 변경 시 자동 호출)
export const usageTriggers = {
  // 프로젝트 관련
  onProjectCreated: (userId: string) => UsageCacheManager.updateProjectCount(userId),
  onProjectDeleted: (userId: string) => UsageCacheManager.updateProjectCount(userId),
  
  // 캐릭터 관련
  onCharacterCreated: (userId: string) => UsageCacheManager.updateCharacterCount(userId),
  onCharacterDeleted: (userId: string) => UsageCacheManager.updateCharacterCount(userId),
  
  // 생성 관련
  onImageGenerated: (userId: string, tokensUsed: number = 2) => 
    UsageCacheManager.updateGenerationStats(userId, tokensUsed),
  
  // 스토리지 관련
  onStorageChanged: (userId: string) => UsageCacheManager.updateStorageUsage(userId)
};