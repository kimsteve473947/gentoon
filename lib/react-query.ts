'use client';

import { QueryClient } from '@tanstack/react-query';

// 🚀 React Query 설정 (성능 최적화)
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5분간 fresh 상태 유지
      gcTime: 10 * 60 * 1000, // 10분간 캐시 유지
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

// 🗂️ Query Keys Factory
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: any) => [...projectKeys.lists(), filters] as const,
  minimal: (page: number, limit: number) => [...projectKeys.all, 'minimal', page, limit] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  search: (term: string) => [...projectKeys.all, 'search', term] as const,
};

export const characterKeys = {
  all: ['characters'] as const,
  lists: () => [...characterKeys.all, 'list'] as const,
  list: (filters: any) => [...characterKeys.lists(), filters] as const,
  details: () => [...characterKeys.all, 'detail'] as const,
  detail: (id: string) => [...characterKeys.details(), id] as const,
};

// 🛠️ Query Client 유틸리티
export const queryUtils = {
  invalidateProjects: () => {
    queryClient.invalidateQueries({ queryKey: projectKeys.all });
  },
  
  invalidateCharacters: () => {
    queryClient.invalidateQueries({ queryKey: characterKeys.all });
  },
  
  prefetchProjects: async (page: number = 1, limit: number = 12) => {
    await queryClient.prefetchQuery({
      queryKey: projectKeys.minimal(page, limit),
      queryFn: async () => {
        const response = await fetch(`/api/projects/minimal?page=${page}&limit=${limit}`);
        return response.json();
      },
      staleTime: 2 * 60 * 1000,
    });
  },
  
  setProjectsData: (data: any) => {
    queryClient.setQueryData(projectKeys.minimal(1, 12), data);
  },
  
  getProjectsData: () => {
    return queryClient.getQueryData(projectKeys.minimal(1, 12));
  },
};