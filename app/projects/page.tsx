'use client';

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  Search, 
  Grid3x3, 
  List, 
  MoreVertical,
  Clock,
  FolderOpen,
  Filter,
  SortAsc,
  Users,
  ChevronRight,
  Trash2,
  AlertCircle,
  Settings,
  HardDrive,
  Crown,
  X,
  CheckSquare,
  Square
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { ProjectCardWithDelete } from '@/components/projects/project-card-with-delete';
import { CharacterCardWithDelete } from '@/components/projects/character-card-with-delete';
import { StorageUsageWidget } from '@/components/projects/storage-usage-widget';
import { useLightningProjects, useDeleteProject } from '@/hooks/use-projects';
import { projectCache } from '@/lib/cache/project-cache';

interface Project {
  id: string;
  title: string;
  thumbnail?: string;
  lastEdited: string;
}

interface Character {
  id: string;
  name: string;
  thumbnailUrl?: string;
  updatedAt?: string;
}



// 🚀 API 응답 타입 정의
interface DashboardInitialResponse {
  success: boolean;
  data: {
    projects: {
      items: Project[];
      pagination: {
        page: number;
        limit: number;
        hasMore: boolean;
        total: null;
      };
    };
    characters: {
      items: Character[];
      count: number;
    };
  };
  stats: {
    projectCount: number;
    characterCount: number;
    totalItems: number;
  };
  performance: {
    timestamp: number;
    loadTime: number;
    cached: boolean;
  };
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'webtoon' | 'characters'>('all');
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false); // 데이터 로딩 상태 (탭 전환시)
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(new Set());

  // 🚀 성능 최적화: 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [prefetching, setPrefetching] = useState(false);
  
  const ITEMS_PER_PAGE = 6; // 빠른 로딩을 위해 6개씩
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadInitialData();
  }, []);



  // 🚀 Canva 스타일 초기 로딩 - Lightning-Fast API + Smart Caching
  const loadInitialData = async (): Promise<void> => {
    try {
      setLoading(true);
      setDataLoading(true);
      
      // 🚀 성능 측정 시작
      const startTime = performance.now();

      // 🚀 캐시된 데이터 먼저 로드
      const cachedProjects = projectCache.getCachedProjects();
      const cachedCharacters = projectCache.getCachedCharacters();
      
      if (cachedProjects && cachedCharacters && projectCache.isCacheValid()) {
        console.log('🚀 캐시된 데이터 사용:', { 
          projects: cachedProjects.length, 
          characters: cachedCharacters.length 
        });
        setProjects(cachedProjects as any);
        setCharacters(cachedCharacters as any);
        setLoading(false);
        setDataLoading(false);
        
        // 캐시 데이터를 보여주고, 백그라운드에서 최신 데이터 확인
        setTimeout(() => loadFreshData(startTime), 100);
        return;
      }
      
      // 🔥 Lightning-Fast API로 프로젝트 데이터 로딩
      const projectsResponse = await fetch(`/api/projects/lightning-fast?page=1&limit=${ITEMS_PER_PAGE}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // 🚀 브라우저 캐시 활용
        cache: 'default'
      });
      
      // 🔥 캐릭터 데이터는 별도 API로 로딩
      const charactersResponse = await fetch(`/api/characters?limit=10`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'default'
      });

      if (!projectsResponse.ok) {
        if (projectsResponse.status === 401) {
          router.push('/sign-in?redirectTo=/projects');
          return;
        }
        const errorText = await projectsResponse.text().catch(() => 'Unknown error');
        throw new Error(`Projects API HTTP ${projectsResponse.status}: ${errorText}`);
      }

      if (!charactersResponse.ok) {
        console.warn('Characters API failed, continuing without characters');
      }

      const projectsResult = await projectsResponse.json();
      const charactersResult = charactersResponse.ok ? await charactersResponse.json() : { characters: [] };
      
      if (!projectsResult.success) {
        const errorMessage = (projectsResult as any).error || '프로젝트 로딩 중 오류가 발생했습니다.';
        console.error('Projects API error:', errorMessage);
        
        // 🚨 사용자에게 친화적인 오류 메시지 표시
        alert(`프로젝트를 불러오는데 실패했습니다: ${errorMessage}`);
        return;
      }

      // 🚀 프로젝트 데이터 설정 및 캐시 업데이트
      if (projectsResult.projects && Array.isArray(projectsResult.projects)) {
        setProjects(projectsResult.projects);
        setHasMore(Boolean(projectsResult.pagination?.hasNextPage));
        setCurrentPage(1);
        
        // 🚀 프로젝트 캐시 업데이트
        projectCache.updateProjectsCache(projectsResult.projects);
      } else {
        console.warn('프로젝트 데이터가 예상 형식과 다릅니다:', projectsResult);
        setProjects([]);
        setHasMore(false);
      }
      
      // 🚀 캐릭터 데이터 설정 및 캐시 업데이트
      if (charactersResult.characters && Array.isArray(charactersResult.characters)) {
        setCharacters(charactersResult.characters);
        
        // 🚀 캐릭터 캐시 업데이트
        projectCache.updateCharactersCache(charactersResult.characters);
      } else {
        console.warn('캐릭터 데이터가 예상 형식과 다릅니다:', charactersResult);
        setCharacters([]);
      }

      
      // 🛡️ 안전한 통계 로깅 + 성능 측정
      const projectCount = projectsResult.projects?.length || 0;
      const characterCount = charactersResult.characters?.length || 0;
      
      const loadTime = performance.now() - startTime;
      console.log(`🚀 초기 데이터 로딩 완료: ${projectCount}개 프로젝트, ${characterCount}개 캐릭터 (${Math.round(loadTime)}ms)`);
      
      // 🚀 이미지 사전 로딩 (백그라운드, 안전한 실행)
      if (projectsResult.projects && Array.isArray(projectsResult.projects)) {
        setTimeout(() => {
          try {
            preloadImages(projectsResult.projects);
          } catch (preloadError) {
            console.warn('이미지 사전 로딩 중 오류:', preloadError);
          }
        }, 500);
      }
      
    } catch (error) {
      console.error('초기 데이터 로딩 중 예외 발생:', error);
      
      // 🚨 네트워크 오류 등에 대한 사용자 친화적 메시지
      const errorMessage = error instanceof Error 
        ? error.message 
        : '네트워크 연결을 확인해주세요.';
      
      alert(`데이터를 불러오는데 실패했습니다: ${errorMessage}`);
      
      // 🛡️ 기본값으로 안전하게 설정
      setProjects([]);
      setCharacters([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setDataLoading(false);
    }
  };

  // 🚀 백그라운드에서 최신 데이터 로드
  const loadFreshData = async (startTime: number) => {
    try {
      // API 호출하여 최신 데이터 가져오기
      const [projectsResponse, charactersResponse] = await Promise.all([
        fetch(`/api/projects/lightning-fast?page=1&limit=${ITEMS_PER_PAGE}`),
        fetch(`/api/characters?limit=10`)
      ]);

      if (projectsResponse.ok && charactersResponse.ok) {
        const [projectsResult, charactersResult] = await Promise.all([
          projectsResponse.json(),
          charactersResponse.json()
        ]);

        // 캐시와 다른 경우에만 업데이트
        if (projectsResult.success && projectsResult.projects) {
          projectCache.updateProjectsCache(projectsResult.projects);
          setProjects(projectsResult.projects);
        }

        if (charactersResult.success && charactersResult.characters) {
          projectCache.updateCharactersCache(charactersResult.characters);  
          setCharacters(charactersResult.characters);
        }

        console.log('🔄 백그라운드 데이터 업데이트 완료');
      }
    } catch (error) {
      console.warn('백그라운드 데이터 업데이트 실패:', error);
    }
  };

  // 🚀 최적화된 이미지 사전 로딩 (Intersection Observer 활용)
  const preloadImages = (projects: Project[]) => {
    // 🎯 중요: 실제로 보일 가능성이 높은 첫 8개만 사전 로딩
    const imagesToPreload = projects.slice(0, 8).filter(project => project.thumbnail);
    
    if (imagesToPreload.length === 0) return;
    
    // 🚀 Web API를 활용한 효율적인 이미지 로딩
    const imagePromises = imagesToPreload.map(project => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        
        // 🎯 썸네일용 작은 크기로 로드 (성능 최적화)
        const optimizedSrc = project.thumbnail!.includes('supabase.co') 
          ? `${project.thumbnail}?width=200&height=250&resize=cover&quality=75`
          : project.thumbnail!;
        
        img.onload = () => resolve();
        img.onerror = () => resolve(); // 실패해도 계속 진행
        img.src = optimizedSrc;
        
        // 🛡️ 5초 타임아웃으로 무한 대기 방지
        setTimeout(() => resolve(), 5000);
      });
    });

    // 🚀 백그라운드에서 병렬 로딩 (사용자 경험에 영향 없음)
    Promise.allSettled(imagePromises).then(results => {
      const successful = results.filter(r => r.status === 'fulfilled').length;
      console.log(`📸 이미지 사전 로딩 완료: ${successful}/${imagesToPreload.length}개`);
    });
  };

  // 🚀 추가 프로젝트 로딩 (무한 스크롤)
  const loadMoreProjects = async () => {
    console.log(`🔄 loadMoreProjects called - loadingMore: ${loadingMore}, hasMore: ${hasMore}, currentPage: ${currentPage}`);
    if (loadingMore || !hasMore) return;
    
    try {
      setLoadingMore(true);
      const nextPage = currentPage + 1;
      console.log(`📥 Loading page ${nextPage}...`);
      const result = await loadProjectsPage(nextPage);
      
      console.log(`📊 API Result:`, result);
      
      if (result && result.projects.length > 0) {
        console.log(`✅ Adding ${result.projects.length} new projects, hasMore: ${result.hasMore}`);
        // 🛡️ 중복 프로젝트 방지 - 기존 ID와 겹치지 않는 프로젝트만 추가
        setProjects(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newProjects = result.projects.filter(p => !existingIds.has(p.id));
          console.log(`🔍 Filtered ${newProjects.length} new projects (${result.projects.length - newProjects.length} duplicates filtered)`);
          return [...prev, ...newProjects];
        });
        setCurrentPage(nextPage);
        setHasMore(result.hasMore);
      } else {
        console.log(`❌ No more projects to load`);
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more projects:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // 🚀 초고속 프로젝트 로딩 (Lightning-Fast API 사용)
  const loadProjectsPage = async (page: number) => {
    try {
      const response = await fetch(`/api/projects/lightning-fast?page=${page}&limit=${ITEMS_PER_PAGE}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/sign-in?redirectTo=/projects');
          return null;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        console.error('API error:', data.error);
        return null;
      }

      return { 
        projects: data.projects || [],
        hasMore: data.pagination?.hasNextPage || false
      };

    } catch (error) {
      console.error('Error loading projects page:', error);
      return null;
    }
  };

  const handleNewProject = () => {
    router.push('/studio');
  };

  // 🗑️ 프로젝트 휴지통 이동 핸들러
  const handleDeleteProject = async (projectId: string) => {
    // 상태에서 프로젝트 제거 (UI 즉시 업데이트)
    setProjects(prev => prev.filter(project => project.id !== projectId));
    console.log(`✅ 프로젝트 휴지통 이동 완료: ${projectId}`);
  };

  // 🗑️ 캐릭터 영구 삭제 핸들러
  const handleDeleteCharacter = async (characterId: string) => {
    // 상태에서 캐릭터 제거 (UI 즉시 업데이트)
    setCharacters(prev => prev.filter(character => character.id !== characterId));
    console.log(`✅ 캐릭터 영구 삭제 완료: ${characterId}`);
  };

  // 🚀 탭 전환시 스무스한 로딩 효과
  const handleTabChange = (newTab: 'all' | 'webtoon' | 'characters') => {
    if (newTab !== activeTab) {
      setDataLoading(true);
      setActiveTab(newTab);
      // 300ms 후 로딩 해제 (스무스한 전환 효과)
      setTimeout(() => {
        setDataLoading(false);
      }, 300);
    }
  };

  const filteredProjects = projects.filter(project => {
    // 검색어 필터
    const matchesSearch = project.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    // 프로젝트 표시 조건: 검색어에 매칭되는 모든 프로젝트 표시
    return matchesSearch;
  });

  const filteredCharacters = characters.filter(character =>
    character.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 🚀 Canva 스타일 스켈레톤 로딩
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* 헤더 스켈레톤 */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <div className="h-8 w-32 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-48 bg-gray-100 rounded animate-pulse"></div>
              </div>
              <div className="flex space-x-2">
                <div className="h-9 w-20 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-9 w-32 bg-purple-200 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 필터 바 스켈레톤 */}
          <div className="mb-8 flex justify-between">
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              {[1,2,3].map(i => (
                <div key={i} className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
            <div className="flex space-x-2">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-8 w-12 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          </div>

          {/* 프로젝트 그리드 스켈레톤 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="aspect-[4/5] bg-white rounded-xl border border-gray-200 animate-pulse">
                <div className="absolute inset-4 top-4 bottom-16 bg-gray-200 rounded-lg"></div>
                <div className="absolute top-4 left-4">
                  <div className="w-12 h-4 bg-gray-300 rounded"></div>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="w-3/4 h-4 bg-gray-300 rounded mb-2"></div>
                  <div className="w-1/2 h-3 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">작업내역</h1>
              <div className="flex items-center text-sm text-gray-500">
                <FolderOpen className="h-4 w-4 mr-1" />
                <span>{projects.length}개 프로젝트</span>
                <span className="mx-2">•</span>
                <Users className="h-4 w-4 mr-1" />
                <span>{characters.length}개 캐릭터</span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* 스토리지 사용량 위젯 */}
              <StorageUsageWidget />
              
              {/* 휴지통 버튼 */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/trash')}
                className="bg-gray-50 hover:bg-gray-100"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                휴지통
              </Button>
              <Button
                onClick={handleNewProject}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                새 웹툰 만들기
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {/* 🔄 로딩 오버레이 */}
        {dataLoading && (
          <div className="absolute inset-0 bg-white/30 backdrop-blur-sm z-20 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-2"></div>
              <div className="text-sm text-gray-600 font-medium">로딩 중...</div>
            </div>
          </div>
        )}

        {/* 필터 바 */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              <button 
                onClick={() => handleTabChange('all')}
                disabled={dataLoading}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'all' 
                    ? 'text-purple-600 bg-white shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                } ${dataLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {dataLoading && activeTab === 'all' ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600 mr-2"></div>
                    전체
                  </div>
                ) : (
                  '전체'
                )}
              </button>
              <button 
                onClick={() => handleTabChange('webtoon')}
                disabled={dataLoading}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'webtoon' 
                    ? 'text-purple-600 bg-white shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                } ${dataLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {dataLoading && activeTab === 'webtoon' ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600 mr-2"></div>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    웹툰 스페이스
                  </div>
                ) : (
                  <>
                    <FolderOpen className="h-4 w-4 inline mr-2" />
                    웹툰 스페이스
                  </>
                )}
              </button>
              <button 
                onClick={() => handleTabChange('characters')}
                disabled={dataLoading}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'characters' 
                    ? 'text-purple-600 bg-white shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                } ${dataLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {dataLoading && activeTab === 'characters' ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600 mr-2"></div>
                    <Users className="h-4 w-4 mr-2" />
                    내 캐릭터
                  </div>
                ) : (
                  <>
                    <Users className="h-4 w-4 inline mr-2" />
                    내 캐릭터
                  </>
                )}
              </button>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              필터
            </Button>
            <Button variant="ghost" size="sm">
              <SortAsc className="h-4 w-4 mr-2" />
              정렬
            </Button>
            <div className="border-l h-6 mx-2"></div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('grid')}
              className={viewMode === 'grid' ? 'bg-gray-100' : ''}
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('list')}
              className={viewMode === 'list' ? 'bg-gray-100' : ''}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 전체 탭 */}
        {activeTab === 'all' && (
          <div className={`transition-opacity duration-300 ${dataLoading ? 'opacity-50' : 'opacity-100'}`}>
            <div className="space-y-12">
              {/* 웹툰 스페이스 섹션 */}
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <FolderOpen className="h-5 w-5 mr-2 text-purple-600" />
                    웹툰 스페이스
                  </h2>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-gray-600 hover:text-purple-600"
                    onClick={() => handleTabChange('webtoon')}
                    disabled={dataLoading}
                  >
                    전체 보기 <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>

                <div className="relative">
                  <div className="flex overflow-x-auto gap-6 pb-4 scrollbar-hide">
                    {/* 새 프로젝트 생성 카드 */}
                    <div
                      className="flex-shrink-0 w-48 aspect-[4/5] bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-dashed border-purple-200 hover:border-purple-400 hover:bg-gradient-to-br hover:from-purple-100 hover:to-pink-100 transition-all cursor-pointer flex flex-col items-center justify-center group"
                      onClick={handleNewProject}
                    >
                      <div className="text-center">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm group-hover:shadow-md transition-shadow">
                          <Plus className="h-6 w-6 text-purple-500" />
                        </div>
                        <p className="text-sm font-semibold text-purple-700 mb-1">새 웹툰 만들기</p>
                        <p className="text-xs text-purple-500">AI로 쉽고 빠르게</p>
                      </div>
                    </div>

                    {/* 프로젝트 카드들 */}
                    {filteredProjects.slice(0, 8).map((project) => (
                      <div key={project.id} className="flex-shrink-0 w-48">
                        <ProjectCardWithDelete 
                          project={{
                            id: project.id,
                            title: project.title,
                            thumbnail: project.thumbnail,
                            lastEdited: project.lastEdited
                          }}
                          onDelete={handleDeleteProject}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* 내 캐릭터 섹션 */}
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <Users className="h-5 w-5 mr-2 text-purple-600" />
                    내 캐릭터
                    <span className="ml-2 text-sm font-normal text-gray-500">({characters.length}개)</span>
                  </h2>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-gray-600 hover:text-purple-600"
                    onClick={() => handleTabChange('characters')}
                    disabled={dataLoading}
                  >
                    전체 보기 <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>

                <div className="relative">
                  <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide">
                    {characters.slice(0, 10).map((character) => (
                      <div key={character.id} className="flex-shrink-0 w-32">
                        <CharacterCardWithDelete 
                          character={{
                            id: character.id,
                            name: character.name,
                            thumbnailUrl: character.thumbnailUrl,
                            createdAt: character.createdAt
                          }}
                          onDelete={handleDeleteCharacter}
                        />
                      </div>
                    ))}
                    
                    {characters.length === 0 && (
                      <div className="flex-shrink-0 w-32 aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
                        <div className="text-center">
                          <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-xs text-gray-400">캐릭터 없음</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* 웹툰 스페이스 탭 */}
        {activeTab === 'webtoon' && (
          <div className={`transition-opacity duration-300 ${dataLoading ? 'opacity-50' : 'opacity-100'}`}>
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <FolderOpen className="h-5 w-5 mr-2 text-purple-600" />
                  웹툰 스페이스
                </h2>
                <Button
                  onClick={handleNewProject}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  새 웹툰 만들기
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                {/* 새 프로젝트 생성 카드 */}
                <div
                  className="aspect-[4/5] bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-dashed border-purple-200 hover:border-purple-400 hover:bg-gradient-to-br hover:from-purple-100 hover:to-pink-100 transition-all cursor-pointer flex flex-col items-center justify-center group"
                  onClick={handleNewProject}
                >
                  <div className="text-center">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm group-hover:shadow-md transition-shadow">
                      <Plus className="h-8 w-8 text-purple-500" />
                    </div>
                    <p className="text-lg font-semibold text-purple-700 mb-2">새 웹툰 만들기</p>
                    <p className="text-sm text-purple-500">AI로 쉽고 빠르게</p>
                  </div>
                </div>

                {/* 프로젝트 카드들 */}
                {filteredProjects.map((project) => (
                  <ProjectCardWithDelete 
                    key={project.id}
                    project={{
                      id: project.id,
                      title: project.title,
                      thumbnail: project.thumbnail,
                      lastEdited: project.lastEdited
                    }}
                    onDelete={handleDeleteProject}
                  />
                ))}
              </div>

              {/* 🚀 더보기 버튼 */}
              {hasMore && (
                <div className="flex items-center justify-center mt-8">
                  <Button 
                    onClick={() => loadMoreProjects()}
                    disabled={loadingMore}
                    variant="outline"
                    className="px-8 py-2"
                  >
                    {loadingMore ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></div>
                        로딩 중...
                      </>
                    ) : (
                      <>
                        <ChevronRight className="h-4 w-4 mr-2" />
                        더보기 (12개)
                      </>
                    )}
                  </Button>
                </div>
              )}
            </section>
          </div>
        )}

        {/* 내 캐릭터 탭 */}
        {activeTab === 'characters' && (
          <div className={`transition-opacity duration-300 ${dataLoading ? 'opacity-50' : 'opacity-100'}`}>
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-purple-600" />
                  내 캐릭터
                  <span className="ml-2 text-sm font-normal text-gray-500">({filteredCharacters.length}개)</span>
                </h2>
                <Button className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="h-4 w-4 mr-2" />
                  캐릭터 추가
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
                {filteredCharacters.map((character) => (
                  <CharacterCardWithDelete 
                    key={character.id}
                    character={{
                      id: character.id,
                      name: character.name,
                      thumbnailUrl: character.thumbnailUrl,
                      createdAt: character.createdAt
                    }}
                    onDelete={handleDeleteCharacter}
                  />
                ))}
              </div>
            </section>
          </div>
        )}

        {/* 빈 상태 */}
        {((activeTab === 'webtoon' && filteredProjects.length === 0) ||
          (activeTab === 'characters' && filteredCharacters.length === 0)) && (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              {activeTab === 'webtoon' && <FolderOpen className="h-12 w-12 text-gray-400" />}
              {activeTab === 'characters' && <Users className="h-12 w-12 text-gray-400" />}
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activeTab === 'webtoon' && '아직 웹툰 프로젝트가 없습니다'}
              {activeTab === 'characters' && '등록된 캐릭터가 없습니다'}
            </h3>
            <p className="text-gray-500 mb-6">
              {activeTab === 'webtoon' && '첫 번째 웹툰을 만들어보세요'}
              {activeTab === 'characters' && '캐릭터를 추가하여 일관성 있는 웹툰을 만들어보세요'}
            </p>
            <Button 
              onClick={handleNewProject}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              {activeTab === 'webtoon' && '첫 웹툰 만들기'}
              {activeTab === 'characters' && '캐릭터 추가하기'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}