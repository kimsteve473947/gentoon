import { useState, useCallback } from 'react';
import { projectCache } from '@/lib/cache/project-cache';

interface Character {
  id: string;
  name: string;
  thumbnailUrl: string | null;
}

interface UseIncrementalCharactersResult {
  characters: Character[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

const CHARACTERS_PER_PAGE = 6; // 한번에 6개씩 로드

export function useIncrementalCharacters(): UseIncrementalCharactersResult {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  // 캐릭터 추가 로드
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    try {
      setLoading(true);

      // 첫 로드시 캐시 확인
      if (offset === 0) {
        const cachedCharacters = projectCache.getCachedCharacters();
        if (cachedCharacters && projectCache.isCacheValid()) {
          setCharacters(cachedCharacters);
          // 캐시된 데이터가 6개 미만이면 더 로드할 수 없다고 가정
          setHasMore(cachedCharacters.length >= CHARACTERS_PER_PAGE);
          setOffset(cachedCharacters.length);
          setLoading(false);
          return;
        }
      }

      // API 호출
      const response = await fetch(
        `/api/characters?limit=${CHARACTERS_PER_PAGE}&offset=${offset}`
      );

      if (!response.ok) {
        throw new Error('캐릭터 로딩 실패');
      }

      const result = await response.json();
      
      if (result.success && result.characters) {
        const newCharacters = result.characters;
        
        // 기존 캐릭터와 합치기 (중복 제거)
        const existingIds = new Set(characters.map(c => c.id));
        const uniqueNewCharacters = newCharacters.filter(
          (char: Character) => !existingIds.has(char.id)
        );

        const updatedCharacters = [...characters, ...uniqueNewCharacters];
        setCharacters(updatedCharacters);
        setOffset(prev => prev + uniqueNewCharacters.length);
        
        // 더 로드할 캐릭터가 있는지 확인
        setHasMore(newCharacters.length >= CHARACTERS_PER_PAGE);

        // 캐시 업데이트 (전체 캐릭터 목록)
        if (offset === 0) {
          projectCache.updateCharactersCache(updatedCharacters);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('캐릭터 로딩 중 오류:', error);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, offset, characters]);

  // 캐릭터 목록 새로고침
  const refresh = useCallback(async () => {
    setCharacters([]);
    setOffset(0);
    setHasMore(true);
    projectCache.clearCache();
    await loadMore();
  }, [loadMore]);

  return {
    characters,
    loading,
    hasMore,
    loadMore,
    refresh
  };
}