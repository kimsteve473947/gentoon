'use client';

import React from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  staleTime: number;
}

class SmartCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize = 100; // 최대 캐시 엔트리 수

  // 🚀 캐시에서 데이터 가져오기 (stale-while-revalidate)
  get<T>(key: string): { data: T | null; isStale: boolean } {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return { data: null, isStale: false };
    }

    const now = Date.now();
    const isStale = now - entry.timestamp > entry.staleTime;
    
    return { data: entry.data, isStale };
  }

  // 💾 캐시에 데이터 저장
  set<T>(key: string, data: T, staleTime: number = 30000): void {
    // 캐시 크기 제한
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      staleTime
    });

    // localStorage에도 저장 (브라우저 재시작 시 유지)
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify({
        data,
        timestamp: Date.now(),
        staleTime
      }));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  // 🗑️ 특정 키 삭제
  delete(key: string): void {
    this.cache.delete(key);
    try {
      localStorage.removeItem(`cache_${key}`);
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error);
    }
  }

  // 🧹 패턴으로 삭제 (예: projects_* 전체 삭제)
  deleteByPattern(pattern: string): void {
    const regex = new RegExp(pattern.replace('*', '.*'));
    
    // 메모리 캐시
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }

    // localStorage
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cache_') && regex.test(key.slice(6))) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.warn('Failed to clean localStorage:', error);
    }
  }

  // 📂 localStorage에서 캐시 복원
  restoreFromLocalStorage(): void {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cache_')) {
          const cacheKey = key.slice(6);
          const entryStr = localStorage.getItem(key);
          
          if (entryStr) {
            const entry = JSON.parse(entryStr);
            const now = Date.now();
            
            // 1시간 이내의 캐시만 복원
            if (now - entry.timestamp < 60 * 60 * 1000) {
              this.cache.set(cacheKey, entry);
            } else {
              localStorage.removeItem(key);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to restore from localStorage:', error);
    }
  }

  // 📊 캐시 통계
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys())
    };
  }
}

// 🌟 전역 캐시 인스턴스
export const smartCache = new SmartCache();

// 🏭 캐시 키 팩토리
export const cacheKeys = {
  projects: (userId: string, page: number = 1, limit: number = 12) => 
    `projects_${userId}_page_${page}_limit_${limit}`,
  
  characters: (userId: string) => 
    `characters_${userId}`,
  
  userProfile: (userId: string) => 
    `user_profile_${userId}`,
    
  storage: (userId: string) => 
    `storage_${userId}`,
};

// 🔄 캐시 유틸리티 함수들
export const cacheUtils = {
  // 프로젝트 캐시 무효화
  invalidateProjects: (userId: string) => {
    smartCache.deleteByPattern(`projects_${userId}_*`);
  },
  
  // 모든 사용자 캐시 무효화
  invalidateUser: (userId: string) => {
    smartCache.deleteByPattern(`*_${userId}_*`);
    smartCache.deleteByPattern(`*_${userId}`);
  },
  
  // 앱 시작시 캐시 복원
  initializeCache: () => {
    smartCache.restoreFromLocalStorage();
  }
};

// 🎣 React Hook for cached data
export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  staleTime: number = 30000
) {
  const [data, setData] = React.useState<T | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: cachedData, isStale } = smartCache.get<T>(key);
        
        if (cachedData && !isStale) {
          setData(cachedData);
          setIsLoading(false);
          return;
        }

        // 스테일 데이터라도 일단 보여주기
        if (cachedData) {
          setData(cachedData);
          setIsLoading(false);
        }

        // 백그라운드에서 새 데이터 페치
        const freshData = await fetcher();
        smartCache.set(key, freshData, staleTime);
        setData(freshData);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [key, fetcher, staleTime]);

  return { data, isLoading, error };
}