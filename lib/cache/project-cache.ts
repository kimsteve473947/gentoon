// 🚀 프로젝트 데이터 캐싱 시스템
interface CachedProject {
  id: string;
  title: string;
  thumbnail: string | null;
  lastEdited: string;
  cachedAt: number;
}

interface CachedCharacter {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  updatedAt?: string;
  cachedAt: number;
}

interface CacheData {
  projects: CachedProject[];
  characters: CachedCharacter[];
  lastFetch: number;
  version: string;
}

const CACHE_KEY = 'gentoon_project_cache';
const CACHE_VERSION = '2.0'; // 버전 업데이트로 기존 캐시 무효화
const CACHE_DURATION = 2 * 60 * 1000; // 2분으로 단축  
const MAX_CACHE_SIZE = 50; // 크기 대폭 축소

class ProjectCache {
  private cache: CacheData | null = null;

  // 캐시 로드
  private loadCache(): CacheData | null {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const data: CacheData = JSON.parse(cached);
      
      // 버전 체크
      if (data.version !== CACHE_VERSION) {
        this.clearCache();
        return null;
      }

      // 만료 체크
      if (Date.now() - data.lastFetch > CACHE_DURATION) {
        this.clearCache();
        return null;
      }

      return data;
    } catch (error) {
      console.warn('캐시 로드 실패:', error);
      this.clearCache();
      return null;
    }
  }

  // 캐시 저장
  private saveCache(data: CacheData): void {
    try {
      // 크기 제한
      if (data.projects.length > MAX_CACHE_SIZE) {
        data.projects = data.projects.slice(0, MAX_CACHE_SIZE);
      }
      if (data.characters.length > MAX_CACHE_SIZE) {
        data.characters = data.characters.slice(0, MAX_CACHE_SIZE);
      }

      // 데이터 크기 추정 (대략적으로)
      const dataString = JSON.stringify(data);
      const dataSize = new Blob([dataString]).size;
      
      // 5MB 이상이면 저장하지 않음
      if (dataSize > 5 * 1024 * 1024) {
        console.warn('캐시 데이터가 너무 큽니다. 저장을 건너뜁니다.');
        return;
      }

      localStorage.setItem(CACHE_KEY, dataString);
      this.cache = data;
    } catch (error) {
      console.warn('캐시 저장 실패:', error);
      // localStorage 공간 부족시 캐시 클리어 후 재시도
      this.clearCache();
      try {
        // 간소화된 데이터만 저장 시도
        const simplifiedData = {
          ...data,
          projects: data.projects.slice(0, 10), // 최대 10개만
          characters: data.characters.slice(0, 10) // 최대 10개만
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(simplifiedData));
        this.cache = simplifiedData;
      } catch (retryError) {
        console.warn('간소화된 캐시 저장도 실패:', retryError);
        // 완전히 실패하면 캐시 비활성화
        this.cache = null;
      }
    }
  }

  // 캐시 클리어
  clearCache(): void {
    try {
      localStorage.removeItem(CACHE_KEY);
      this.cache = null;
    } catch (error) {
      console.warn('캐시 클리어 실패:', error);
    }
  }

  // 프로젝트 캐시 가져오기
  getCachedProjects(): CachedProject[] | null {
    const cached = this.loadCache();
    return cached?.projects || null;
  }

  // 캐릭터 캐시 가져오기  
  getCachedCharacters(): CachedCharacter[] | null {
    const cached = this.loadCache();
    return cached?.characters || null;
  }

  // 프로젝트 캐시 업데이트
  updateProjectsCache(projects: any[]): void {
    const now = Date.now();
    const cached = this.loadCache() || {
      projects: [],
      characters: [],
      lastFetch: 0,
      version: CACHE_VERSION
    };

    const cachedProjects: CachedProject[] = projects.map(p => ({
      id: p.id,
      title: p.title,
      thumbnail: p.thumbnail,
      lastEdited: p.lastEdited,
      cachedAt: now
    }));

    this.saveCache({
      ...cached,
      projects: cachedProjects,
      lastFetch: now
    });
  }

  // 캐릭터 캐시 업데이트
  updateCharactersCache(characters: any[]): void {
    const now = Date.now();
    const cached = this.loadCache() || {
      projects: [],
      characters: [],
      lastFetch: 0,
      version: CACHE_VERSION
    };

    const cachedCharacters: CachedCharacter[] = characters.map(c => ({
      id: c.id,
      name: c.name,
      thumbnailUrl: c.thumbnailUrl,
      updatedAt: c.updatedAt,
      cachedAt: now
    }));

    this.saveCache({
      ...cached,
      characters: cachedCharacters,
      lastFetch: now
    });
  }

  // 캐시가 유효한지 확인
  isCacheValid(): boolean {
    const cached = this.loadCache();
    if (!cached) return false;
    
    return Date.now() - cached.lastFetch < CACHE_DURATION;
  }

  // 캐시 통계
  getCacheStats(): {
    projectCount: number;
    characterCount: number;
    lastFetch: string;
    isValid: boolean;
  } {
    const cached = this.loadCache();
    return {
      projectCount: cached?.projects?.length || 0,
      characterCount: cached?.characters?.length || 0,
      lastFetch: cached ? new Date(cached.lastFetch).toLocaleString() : 'Never',
      isValid: this.isCacheValid()
    };
  }
}

export const projectCache = new ProjectCache();