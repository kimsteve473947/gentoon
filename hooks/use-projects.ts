'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectKeys } from '@/lib/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { smartCache, cacheKeys, cacheUtils } from '@/lib/cache/smart-cache';

// ⚡ 초고속 프로젝트 목록 조회 (Smart Cache + Lightning-Fast API)
export function useLightningProjects(page = 1, limit = 12) {
  return useQuery({
    queryKey: ['lightning-projects', page, limit],
    queryFn: async () => {
      // 1. 스마트 캐시 확인
      const cacheKey = cacheKeys.projects('current_user', page, limit);
      const { data: cachedData, isStale } = smartCache.get(cacheKey);
      
      if (cachedData && !isStale) {
        return cachedData;
      }
      
      // 2. API 호출
      const response = await fetch(`/api/projects/lightning-fast?page=${page}&limit=${limit}`);
      if (!response.ok) {
        throw new Error('프로젝트를 불러오는데 실패했습니다');
      }
      
      const data = await response.json();
      
      // 3. 캐시에 저장 (30초 stale time)
      smartCache.set(cacheKey, data, 30000);
      
      return data;
    },
    staleTime: 30 * 1000, // 30초간 fresh
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

// 🚀 기존 프로젝트 목록 조회 (호환성 유지)
export function useProjects(page = 1, limit = 12) {
  return useLightningProjects(page, limit);
}

// 🗑️ 프로젝트 삭제 (Optimistic Updates)
export function useDeleteProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (projectId: string) => {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('프로젝트 삭제에 실패했습니다');
      }
      
      return response.json();
    },
    onMutate: async (projectId) => {
      // 🚀 Optimistic Update - 즉시 UI에서 제거
      await queryClient.cancelQueries({ queryKey: projectKeys.all });
      
      const previousData = queryClient.getQueryData(projectKeys.minimal(1, 12));
      
      queryClient.setQueryData(projectKeys.minimal(1, 12), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          projects: old.projects.filter((p: any) => p.id !== projectId),
        };
      });
      
      return { previousData };
    },
    onError: (err, projectId, context) => {
      // 실패시 롤백
      if (context?.previousData) {
        queryClient.setQueryData(projectKeys.minimal(1, 12), context.previousData);
      }
      toast.error('프로젝트 삭제에 실패했습니다');
    },
    onSuccess: () => {
      toast.success('프로젝트가 삭제되었습니다');
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      queryClient.invalidateQueries({ queryKey: ['lightning-projects'] });
      // 스마트 캐시도 무효화
      cacheUtils.invalidateProjects('current_user');
    },
  });
}

// 📝 새 프로젝트 생성
export function useCreateProject() {
  const queryClient = useQueryClient();
  const router = useRouter();
  
  return useMutation({
    mutationFn: async (projectData: { title: string; description?: string }) => {
      const response = await fetch('/api/studio/create-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData),
      });
      
      if (!response.ok) {
        throw new Error('프로젝트 생성에 실패했습니다');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast.success('새 프로젝트가 생성되었습니다');
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      router.push(`/studio?projectId=${data.project.id}`);
    },
    onError: () => {
      toast.error('프로젝트 생성에 실패했습니다');
    },
  });
}

// 🔍 프로젝트 검색
export function useProjectSearch(searchTerm: string) {
  return useQuery({
    queryKey: projectKeys.search(searchTerm),
    queryFn: async () => {
      if (!searchTerm.trim()) return { projects: [] };
      
      const response = await fetch(`/api/projects/search?q=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) {
        throw new Error('검색에 실패했습니다');
      }
      return response.json();
    },
    enabled: searchTerm.length > 0,
    staleTime: 30 * 1000, // 30초
  });
}

// 🔄 프로젝트 새로고침
export function useRefreshProjects() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      // 캐시 무효화
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      return true;
    },
    onSuccess: () => {
      toast.success('프로젝트 목록이 새로고침되었습니다');
    },
  });
}