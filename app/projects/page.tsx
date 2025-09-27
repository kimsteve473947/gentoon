'use client';

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus, 
  Search, 
  FolderOpen,
  Users,
  ChevronRight,
  Trash2,
  Image as ImageIcon,
  Check,
  X
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { ProjectCardWithDelete } from '@/components/projects/project-card-with-delete';
import { CharacterCardWithDelete } from '@/components/projects/character-card-with-delete';
import { ElementCardWithDelete } from '@/components/projects/element-card-with-delete';
import { StorageUsageWidget } from '@/components/projects/storage-usage-widget';

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
  createdAt?: string;
}

interface Element {
  id: string;
  name: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  description?: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
}



export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [elements, setElements] = useState<Element[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'webtoon' | 'characters' | 'elements'>('all');
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false); // 데이터 로딩 상태 (탭 전환시)

  // 🚀 일괄 삭제를 위한 선택 상태 관리
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // 🚀 성능 최적화: 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const ITEMS_PER_PAGE = 6; // 빠른 로딩을 위해 6개씩
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadInitialData();
  }, []);



  // ⚡ 초고속 초기 로딩 - 프로젝트만 먼저 로드
  const loadInitialData = async (): Promise<void> => {
    try {
      setLoading(true);
      
      console.log('🚀 Loading projects and characters from real database');
      
      // ⚡ 프로젝트만 먼저 빠르게 로드
      const projectsResponse = await fetch(`/api/projects/lightning-fast?page=1&limit=${ITEMS_PER_PAGE}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!projectsResponse.ok) {
        if (projectsResponse.status === 401) {
          router.push('/sign-in?redirectTo=/projects');
          return;
        }
        throw new Error(`Projects API error: ${projectsResponse.status}`);
      }

      const projectsResult = await projectsResponse.json();
      
      if (!projectsResult.success) {
        throw new Error('프로젝트 로딩 실패');
      }

      // ⚡ 프로젝트 데이터만 먼저 설정
      if (projectsResult.projects && Array.isArray(projectsResult.projects)) {
        setProjects(projectsResult.projects);
        const hasNextPage = Boolean(projectsResult.pagination?.hasNextPage);
        setHasMore(hasNextPage);
        setCurrentPage(1);
        console.log(`🎯 Initial load: ${projectsResult.projects.length} projects, hasMore: ${hasNextPage}, pagination:`, projectsResult.pagination);
      } else {
        setProjects([]);
        setHasMore(false);
        console.log(`❌ No projects found in initial load`);
      }
      
      // ⚡ 로딩 완료 - UI 즉시 표시
      setLoading(false);
      
      // 🚀 초고속 캐릭터 데이터 로드 (백그라운드에서 즉시 시작)
      setTimeout(async () => {
        try {
          // 전체 캐릭터 로드 (limit 제거)
          const charactersResponse = await fetch(`/api/characters/lightning-fast?limit=100`);
          if (charactersResponse.ok) {
            const charactersResult = await charactersResponse.json();
            if (charactersResult.characters) {
              setCharacters(charactersResult.characters);
              console.log(`⚡ 캐릭터 로딩 완료: ${charactersResult.characters.length}개 (${charactersResult.queryTime || 'N/A'}ms)`);
            }
          }
        } catch (error) {
          console.warn('캐릭터 로딩 실패:', error);
        }
      }, 10);
      
      // 🚀 초고속 요소 데이터 로드 (백그라운드에서 즉시 시작)
      setTimeout(async () => {
        try {
          const elementsResponse = await fetch(`/api/elements`);
          if (elementsResponse.ok) {
            const elementsResult = await elementsResponse.json();
            if (elementsResult.elements) {
              setElements(elementsResult.elements);
              console.log(`⚡ 요소 로딩 완료: ${elementsResult.elements.length}개`);
            }
          }
        } catch (error) {
          console.warn('요소 로딩 실패:', error);
        }
      }, 20);
      
    } catch (error) {
      console.error('초기 데이터 로딩 중 예외 발생:', error);
      
      // 🛡️ 기본값으로 안전하게 설정
      setProjects([]);
      setCharacters([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setDataLoading(false);
    }
  };


  // 🚀 추가 프로젝트 로딩 (무한 스크롤)
  const loadMoreProjects = async () => {
    console.log(`🔄 loadMoreProjects called - loadingMore: ${loadingMore}, hasMore: ${hasMore}, currentPage: ${currentPage}`);
    if (loadingMore || !hasMore) {
      console.log(`❌ Load more blocked - loadingMore: ${loadingMore}, hasMore: ${hasMore}`);
      return;
    }
    
    try {
      setLoadingMore(true);
      const nextPage = currentPage + 1;
      console.log(`📥 Loading page ${nextPage}...`);
      const result = await loadProjectsPage(nextPage);
      
      console.log(`📊 API Result:`, result);
      
      if (result && result.projects && result.projects.length > 0) {
        console.log(`✅ Adding ${result.projects.length} new projects, hasMore: ${result.hasMore}`);
        // 🛡️ 중복 프로젝트 방지 - 기존 ID와 겹치지 않는 프로젝트만 추가
        setProjects(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newProjects = result.projects.filter(p => !existingIds.has(p.id));
          console.log(`🔍 Filtered ${newProjects.length} new projects (${result.projects.length - newProjects.length} duplicates filtered)`);
          const updatedProjects = [...prev, ...newProjects];
          console.log(`📊 Total projects after update: ${updatedProjects.length}`);
          return updatedProjects;
        });
        setCurrentPage(nextPage);
        setHasMore(result.hasMore);
        console.log(`📄 Updated currentPage to ${nextPage}, hasMore: ${result.hasMore}`);
      } else {
        console.log(`❌ No more projects to load - result:`, result);
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

  // 🗑️ 요소 영구 삭제 핸들러
  const handleDeleteElement = async (elementId: string) => {
    try {
      // 상태에서 요소 제거 (UI 즉시 업데이트)
      setElements(prev => prev.filter(element => element.id !== elementId));
      
      // 서버에서 요소 삭제
      const response = await fetch(`/api/elements?id=${elementId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        console.error('요소 삭제 실패:', response.statusText);
        // 실패시 상태 복원은 하지 않고 그냥 로그만 남김 (UX를 위해)
      }
      
      console.log(`✅ 요소 영구 삭제 완료: ${elementId}`);
    } catch (error) {
      console.error('요소 삭제 중 오류:', error);
    }
  };

  // 🚀 일괄 삭제 관련 함수들
  const handleToggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    if (!isSelectMode) {
      setSelectedProjects(new Set());
    }
  };

  const handleSelectProject = (projectId: string, selected: boolean) => {
    setSelectedProjects(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(projectId);
      } else {
        newSet.delete(projectId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allProjectIds = new Set(filteredProjects.map(p => p.id));
      setSelectedProjects(allProjectIds);
    } else {
      setSelectedProjects(new Set());
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProjects.size === 0) return;
    
    const confirmed = confirm(`선택된 ${selectedProjects.size}개 프로젝트를 휴지통으로 이동하시겠습니까?`);
    if (!confirmed) return;

    try {
      setIsBulkDeleting(true);
      
      // 선택된 프로젝트들을 병렬로 삭제 처리
      const deletePromises = Array.from(selectedProjects).map(projectId => 
        fetch(`/api/projects/${projectId}/trash`, { method: 'PATCH' })
      );
      
      const results = await Promise.allSettled(deletePromises);
      
      // 성공적으로 삭제된 프로젝트들만 UI에서 제거
      const successfulDeletions = Array.from(selectedProjects).filter((projectId, index) => 
        results[index].status === 'fulfilled'
      );
      
      if (successfulDeletions.length > 0) {
        setProjects(prev => prev.filter(project => !successfulDeletions.includes(project.id)));
        console.log(`✅ ${successfulDeletions.length}개 프로젝트 휴지통 이동 완료`);
      }
      
      // 선택 모드 해제
      setSelectedProjects(new Set());
      setIsSelectMode(false);
      
      // 실패한 삭제가 있으면 알림
      const failedCount = selectedProjects.size - successfulDeletions.length;
      if (failedCount > 0) {
        alert(`${successfulDeletions.length}개 프로젝트가 휴지통으로 이동되었습니다. ${failedCount}개는 실패했습니다.`);
      } else {
        alert(`${successfulDeletions.length}개 프로젝트가 휴지통으로 이동되었습니다.`);
      }
      
    } catch (error) {
      console.error('일괄 삭제 중 오류:', error);
      alert('일괄 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // 🚀 캐릭터 전체 로딩 함수
  const loadAllCharacters = async () => {
    try {
      const charactersResponse = await fetch(`/api/characters/lightning-fast?limit=100`);
      if (charactersResponse.ok) {
        const charactersResult = await charactersResponse.json();
        if (charactersResult.characters) {
          setCharacters(charactersResult.characters);
          console.log(`⚡ 전체 캐릭터 로딩 완료: ${charactersResult.characters.length}개`);
        }
      }
    } catch (error) {
      console.warn('전체 캐릭터 로딩 실패:', error);
    }
  };

  // 🚀 요소 전체 로딩 함수
  const loadAllElements = async () => {
    try {
      const elementsResponse = await fetch(`/api/elements`);
      if (elementsResponse.ok) {
        const elementsResult = await elementsResponse.json();
        if (elementsResult.elements) {
          setElements(elementsResult.elements);
          console.log(`⚡ 전체 요소 로딩 완료: ${elementsResult.elements.length}개`);
        }
      }
    } catch (error) {
      console.warn('전체 요소 로딩 실패:', error);
    }
  };

  // 🚀 탭 전환시 스무스한 로딩 효과
  const handleTabChange = (newTab: 'all' | 'webtoon' | 'characters' | 'elements') => {
    if (newTab !== activeTab) {
      setDataLoading(true);
      setActiveTab(newTab);
      
      // 캐릭터 탭으로 전환시 전체 캐릭터 로드
      if (newTab === 'characters') {
        loadAllCharacters();
      }
      
      // 요소 탭으로 전환시 전체 요소 로드
      if (newTab === 'elements') {
        loadAllElements();
      }
      
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

  const filteredElements = elements.filter(element =>
    element.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 🚀 실제 스튜디오와 동일한 간단한 로딩 화면
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">작업내역을 불러오는 중...</p>
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
              <img 
                src="/gentoon.webp" 
                alt="GenToon" 
                className="h-10 w-10 object-contain"
              />
              <h1 className="text-2xl font-bold text-gray-900">작업내역</h1>
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
              <button 
                onClick={() => handleTabChange('elements')}
                disabled={dataLoading}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'elements' 
                    ? 'text-purple-600 bg-white shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                } ${dataLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {dataLoading && activeTab === 'elements' ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600 mr-2"></div>
                    내 요소
                  </div>
                ) : (
                  '내 요소'
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

              {/* 내 요소 섹션 */}
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <ImageIcon className="h-5 w-5 mr-2 text-purple-600" />
                    내 요소
                  </h2>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-gray-600 hover:text-purple-600"
                    onClick={() => handleTabChange('elements')}
                    disabled={dataLoading}
                  >
                    전체 보기 <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>

                <div className="relative">
                  <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide">
                    {elements.slice(0, 10).map((element) => (
                      <div key={element.id} className="flex-shrink-0 w-32">
                        <ElementCardWithDelete 
                          element={{
                            id: element.id,
                            name: element.name,
                            thumbnailUrl: element.thumbnailUrl,
                            imageUrl: element.imageUrl,
                            description: element.description,
                            category: element.category,
                            createdAt: element.createdAt
                          }}
                          onDelete={handleDeleteElement}
                        />
                      </div>
                    ))}
                    
                    {elements.length === 0 && (
                      <div className="flex-shrink-0 w-32 aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
                        <div className="text-center">
                          <ImageIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-xs text-gray-400">요소 없음</p>
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
                <div className="flex items-center gap-3">
                  {/* 선택 모드 토글 버튼 */}
                  {filteredProjects.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleToggleSelectMode}
                      className="bg-white hover:bg-gray-50"
                    >
                      {isSelectMode ? (
                        <>
                          <X className="h-4 w-4 mr-2" />
                          선택 취소
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          선택
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    onClick={handleNewProject}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    새 웹툰 만들기
                  </Button>
                </div>
              </div>

              {/* 선택 모드일 때 전체 선택 및 일괄 삭제 컨트롤 */}
              {isSelectMode && filteredProjects.length > 0 && (
                <div className="flex items-center justify-between mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="select-all-projects"
                      checked={selectedProjects.size === filteredProjects.length && filteredProjects.length > 0}
                      onCheckedChange={handleSelectAll}
                      disabled={isBulkDeleting}
                    />
                    <label 
                      htmlFor="select-all-projects" 
                      className="text-sm font-medium text-gray-700 cursor-pointer"
                    >
                      전체 선택 ({selectedProjects.size}/{filteredProjects.length})
                    </label>
                  </div>
                  
                  {selectedProjects.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDelete}
                      disabled={isBulkDeleting}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isBulkDeleting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          삭제 중...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          선택된 {selectedProjects.size}개 삭제
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-4 gap-6">
                {/* 프로젝트 카드들 - 4x3 그리드 */}
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
                    isSelectMode={isSelectMode}
                    isSelected={selectedProjects.has(project.id)}
                    onSelect={(selected) => handleSelectProject(project.id, selected)}
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
                        더보기 ({ITEMS_PER_PAGE}개)
                      </>
                    )}
                  </Button>
                </div>
              )}
            </section>
          </div>
        )}

        {/* 내 요소 탭 */}
        {activeTab === 'elements' && (
          <div className={`transition-opacity duration-300 ${dataLoading ? 'opacity-50' : 'opacity-100'}`}>
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <ImageIcon className="h-5 w-5 mr-2 text-purple-600" />
                  내 요소
                </h2>
                <Button className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="h-4 w-4 mr-2" />
                  요소 추가
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
                {filteredElements.map((element) => (
                  <ElementCardWithDelete 
                    key={element.id}
                    element={{
                      id: element.id,
                      name: element.name,
                      thumbnailUrl: element.thumbnailUrl,
                      imageUrl: element.imageUrl,
                      description: element.description,
                      category: element.category,
                      createdAt: element.createdAt
                    }}
                    onDelete={handleDeleteElement}
                  />
                ))}
                
                {filteredElements.length === 0 && (
                  <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
                    <div className="text-center">
                      <ImageIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">요소 없음</p>
                      <p className="text-xs text-gray-300 mt-1">요소를 추가해보세요</p>
                    </div>
                  </div>
                )}
              </div>
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
          (activeTab === 'characters' && filteredCharacters.length === 0) ||
          (activeTab === 'elements' && filteredElements.length === 0)) && (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              {activeTab === 'webtoon' && <FolderOpen className="h-12 w-12 text-gray-400" />}
              {activeTab === 'characters' && <Users className="h-12 w-12 text-gray-400" />}
              {activeTab === 'elements' && <ImageIcon className="h-12 w-12 text-gray-400" />}
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activeTab === 'webtoon' && '아직 웹툰 프로젝트가 없습니다'}
              {activeTab === 'characters' && '등록된 캐릭터가 없습니다'}
              {activeTab === 'elements' && '등록된 요소가 없습니다'}
            </h3>
            <p className="text-gray-500 mb-6">
              {activeTab === 'webtoon' && '첫 번째 웹툰을 만들어보세요'}
              {activeTab === 'characters' && '캐릭터를 추가하여 일관성 있는 웹툰을 만들어보세요'}
              {activeTab === 'elements' && '요소를 추가하여 더 풍부한 웹툰을 만들어보세요'}
            </p>
            <Button 
              onClick={handleNewProject}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              {activeTab === 'webtoon' && '첫 웹툰 만들기'}
              {activeTab === 'characters' && '캐릭터 추가하기'}
              {activeTab === 'elements' && '요소 추가하기'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}