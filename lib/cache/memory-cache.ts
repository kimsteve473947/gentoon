/**
 * 메모리 기반 캐시 시스템
 * API 응답 속도 개선을 위한 인메모리 캐싱
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number;
};

class MemoryCache {
  private cache: Map<string, CacheEntry<any>>;
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.cleanupInterval = null;
    this.startCleanup();
  }

  /**
   * 캐시에 데이터 저장
   */
  set<T>(key: string, data: T, ttl = 60000): void {
    // 캐시 크기 제한 체크
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * 캐시에서 데이터 가져오기
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // TTL 체크
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * 캐시 항목 삭제
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 패턴과 일치하는 캐시 항목 삭제
   */
  deletePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 전체 캐시 비우기
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 캐시 크기 반환
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 주기적으로 만료된 캐시 제거
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(key);
        }
      }
    }, 60000); // 1분마다 정리
  }

  /**
   * 캐시 정리 중지
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// 싱글톤 인스턴스
export const memoryCache = new MemoryCache(100);

/**
 * 캐시 데코레이터 (함수 결과 캐싱)
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyGenerator: (...args: Parameters<T>) => string,
  ttl = 60000
): T {
  return (async (...args: Parameters<T>) => {
    const key = keyGenerator(...args);
    
    // 캐시 체크
    const cached = memoryCache.get(key);
    if (cached !== null) {
      return cached;
    }

    // 캐시 미스 - 함수 실행
    const result = await fn(...args);
    
    // 결과 캐싱
    memoryCache.set(key, result, ttl);
    
    return result;
  }) as T;
}

/**
 * React Query와 통합을 위한 캐시 어댑터
 */
export const cacheAdapter = {
  get: async (key: string) => {
    return memoryCache.get(key);
  },
  
  set: async (key: string, data: any, ttl?: number) => {
    memoryCache.set(key, data, ttl);
  },
  
  delete: async (key: string) => {
    memoryCache.delete(key);
  },
  
  clear: async () => {
    memoryCache.clear();
  },
};