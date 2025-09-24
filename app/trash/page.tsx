'use client';

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { 
  Trash2,
  RotateCcw,
  Clock,
  FolderOpen,
  Search,
  AlertCircle,
  ArrowLeft,
  Info,
  CheckCircle2,
  ImageIcon,
  Filter,
  SortDesc,
  Calendar,
  AlertTriangle,
  Archive,
  CheckSquare,
  Square,
  Loader2
} from "lucide-react";
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface DeletedProject {
  id: string;
  title: string;
  createdAt: string;
  deletedAt: string;
  thumbnail?: string;
  panelCount: number;
  daysUntilDeletion: number;
  data?: any;
  panels?: any[];
}

type SortType = 'recent' | 'oldest' | 'name' | 'expiring';
type FilterType = 'all' | 'expiring_soon' | 'has_images' | 'empty';

// 🚀 성능 최적화된 프로젝트 카드 컴포넌트
const ProjectCard = memo(({ 
  project, 
  isSelected, 
  onSelect, 
  onRestore, 
  onDelete, 
  isRestoring, 
  isDeleting 
}: {
  project: DeletedProject;
  isSelected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onRestore: (id: string, e?: React.MouseEvent) => void;
  onDelete: (id: string, e?: React.MouseEvent) => void;
  isRestoring: boolean;
  isDeleting: boolean;
}) => {
  const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelect(project.id, e.target.checked);
  }, [project.id, onSelect]);

  const handleRestore = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRestore(project.id, e);
  }, [project.id, onRestore]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(project.id, e);
  }, [project.id, onDelete]);

  const daysColor = useMemo(() => {
    if (project.daysUntilDeletion <= 7) return 'bg-red-500 text-white animate-pulse';
    if (project.daysUntilDeletion <= 14) return 'bg-orange-500 text-white';
    return 'bg-gray-700 text-white';
  }, [project.daysUntilDeletion]);

  const formattedDate = useMemo(() => 
    formatDistanceToNow(new Date(project.deletedAt), { 
      addSuffix: true, 
      locale: ko 
    }), [project.deletedAt]);

  return (
    <div className="relative group">
      <div className="aspect-[4/5] bg-white rounded-xl border border-gray-200 hover:border-red-300 hover:shadow-lg transition-all duration-200 cursor-pointer relative overflow-hidden">
        
        {/* 선택 체크박스 */}
        <div className="absolute top-3 left-3 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            className="h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* 프로젝트 썸네일 */}
        <div className="w-full h-[60%] bg-gradient-to-br from-gray-50 to-gray-100 rounded-t-xl overflow-hidden">
          {project.thumbnail ? (
            <img 
              src={project.thumbnail} 
              alt={project.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-purple-50 to-pink-50">
              <div className="text-center">
                <ImageIcon className="h-16 w-16 text-gray-300 mx-auto mb-3" />
                <span className="text-sm text-gray-500 font-medium">
                  {project.panelCount > 0 ? `${project.panelCount}개 패널` : '빈 프로젝트'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 삭제까지 남은 일수 */}
        <div className="absolute top-3 right-3 z-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full shadow-sm",
                daysColor
              )}>
                <Clock className="h-3 w-3" />
                {project.daysUntilDeletion}일
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{project.daysUntilDeletion}일 후 영구 삭제됩니다</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* 프로젝트 정보 */}
        <div className="absolute bottom-0 left-0 right-0 bg-white p-4 border-t border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-2 truncate">
            {project.title}
          </h3>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Trash2 className="h-3 w-3" />
              <span>{formattedDate}</span>
            </div>
            {project.panelCount > 0 && (
              <span className="text-purple-600 font-medium">
                {project.panelCount}개 패널
              </span>
            )}
          </div>
        </div>

        {/* 액션 버튼들 - 호버시 표시 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center rounded-xl">
          <div className="flex flex-col gap-2 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRestore}
              disabled={isRestoring || isDeleting}
              className="bg-white/95 hover:bg-white shadow-lg min-w-[100px]"
            >
              {isRestoring ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-1.5" />
              )}
              복원하기
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting || isRestoring}
              className="shadow-lg min-w-[100px]"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1.5" />
              )}
              영구 삭제
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

ProjectCard.displayName = 'ProjectCard';

// 🚀 성공 메시지 컴포넌트
const SuccessMessage = memo(({ message, onClose }: { message: string; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 shadow-lg">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <span className="text-green-800 font-medium">{message}</span>
      </div>
    </div>
  );
});

SuccessMessage.displayName = 'SuccessMessage';

export default function TrashPageOptimized() {
  const router = useRouter();
  const [deletedProjects, setDeletedProjects] = useState<DeletedProject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [sortType, setSortType] = useState<SortType>('recent');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // 🚀 최적화된 데이터 로딩
  const loadDeletedProjects = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/projects/trash?page=1&limit=50');
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        console.error('API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          result,
          url: response.url
        });
        throw new Error(result.error || result.details || 'Failed to load deleted projects');
      }

      const processedProjects = result.projects.map((project: any) => ({
        id: project.id,
        title: project.title,
        createdAt: project.createdAt,
        deletedAt: project.deletedAt,
        panelCount: project.panelCount,
        thumbnail: project.thumbnail,
        daysUntilDeletion: project.daysLeft,
        data: project,
        panels: []
      }));

      setDeletedProjects(processedProjects);
    } catch (error) {
      console.error('Error loading deleted projects:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      toast.error(`삭제된 프로젝트 조회 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeletedProjects();
  }, [loadDeletedProjects]);

  // 🚀 최적화된 필터링 및 정렬 (메모이제이션)
  const filteredProjects = useMemo(() => {
    return deletedProjects
      .filter(project => {
        if (!project.title.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        
        switch (filterType) {
          case 'expiring_soon':
            return project.daysUntilDeletion <= 7;
          case 'has_images':
            return !!project.thumbnail;
          case 'empty':
            return project.panelCount === 0;
          default:
            return true;
        }
      })
      .sort((a, b) => {
        switch (sortType) {
          case 'oldest':
            return new Date(a.deletedAt).getTime() - new Date(b.deletedAt).getTime();
          case 'name':
            return a.title.localeCompare(b.title);
          case 'expiring':
            return a.daysUntilDeletion - b.daysUntilDeletion;
          case 'recent':
          default:
            return new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime();
        }
      });
  }, [deletedProjects, searchQuery, filterType, sortType]);

  // 🚀 최적화된 선택 핸들러
  const handleSelectProject = useCallback((id: string, checked: boolean) => {
    setSelectedProjects(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedProjects.size === filteredProjects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(filteredProjects.map(p => p.id)));
    }
  }, [selectedProjects.size, filteredProjects]);

  // 🚀 최적화된 복원 핸들러
  const handleRestore = useCallback(async (projectId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setProcessingIds(prev => new Set(prev).add(projectId));
    
    try {
      const response = await fetch('/api/projects/delete', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      setDeletedProjects(prev => prev.filter(p => p.id !== projectId));
      setSelectedProjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });
      
      setSuccessMessage('프로젝트가 복원되었습니다!');
    } catch (error) {
      console.error('Error restoring project:', error);
      alert('복원 중 오류가 발생했습니다.');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });
    }
  }, []);

  // 🚀 최적화된 삭제 핸들러
  const handlePermanentDelete = useCallback(async (projectId: string, e?: React.MouseEvent, skipConfirm = false) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!skipConfirm && !confirm('정말 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }
    
    setProcessingIds(prev => new Set(prev).add(projectId));
    
    try {
      const response = await fetch('/api/projects/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, hardDelete: true }),
      });

      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      setDeletedProjects(prev => prev.filter(p => p.id !== projectId));
      setSelectedProjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });
      
      if (!skipConfirm) {
        setSuccessMessage('프로젝트가 영구 삭제되었습니다.');
      }
    } catch (error) {
      console.error('Error permanently deleting project:', error);
      if (!skipConfirm) {
        alert('삭제 중 오류가 발생했습니다.');
      }
      throw error;
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });
    }
  }, []);

  // 🚀 최적화된 일괄 작업
  const handleBulkRestore = useCallback(async () => {
    if (selectedProjects.size === 0) return;
    
    for (const projectId of selectedProjects) {
      await handleRestore(projectId);
    }
  }, [selectedProjects, handleRestore]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedProjects.size === 0) return;
    
    if (!confirm(`정말 ${selectedProjects.size}개의 프로젝트를 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    try {
      for (const projectId of selectedProjects) {
        try {
          await handlePermanentDelete(projectId, undefined, true);
          successCount++;
        } catch (error) {
          console.error(`Failed to delete project ${projectId}:`, error);
          errorCount++;
        }
      }
      
      setSelectedProjects(new Set());
      
      if (errorCount === 0) {
        setSuccessMessage(`${successCount}개 프로젝트가 영구 삭제되었습니다.`);
      } else {
        setSuccessMessage(`${successCount}개 삭제 완료, ${errorCount}개 실패`);
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
    }
  }, [selectedProjects, handlePermanentDelete]);

  const closeSuccessMessage = useCallback(() => {
    setSuccessMessage(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">휴지통을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50">
        
        {/* 성공 메시지 */}
        {successMessage && (
          <SuccessMessage message={successMessage} onClose={closeSuccessMessage} />
        )}

        {/* 헤더 */}
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/projects')}
                  className="hover:bg-purple-50"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  프로젝트로 돌아가기
                </Button>
                <div className="h-8 w-px bg-gray-300" />
                <div className="flex items-center gap-3">
                  <img 
                    src="/gentoon.webp" 
                    alt="GenToon" 
                    className="h-8 w-8 object-contain"
                  />
                  <div className="bg-gradient-to-br from-red-500 to-pink-500 p-2 rounded-lg">
                    <Trash2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">휴지통</h1>
                    <p className="text-xs text-gray-500">{filteredProjects.length}개 항목</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {selectedProjects.size > 0 && (
                  <>
                    <span className="text-sm text-gray-600">
                      {selectedProjects.size}개 선택됨
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkRestore}
                      disabled={processingIds.size > 0}
                      className="bg-green-50 border-green-300 hover:bg-green-100"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      복원
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkDelete}
                      disabled={processingIds.size > 0}
                      className="bg-red-50 border-red-300 hover:bg-red-100 text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      영구 삭제
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 안내 메시지 */}
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <Info className="h-5 w-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">휴지통 안내</h3>
                <p className="mt-1 text-sm text-yellow-700">
                  휴지통의 항목들은 30일 후 자동으로 영구 삭제됩니다. 
                  필요한 프로젝트는 그 전에 복원해주세요.
                </p>
              </div>
            </div>
          </div>

          {/* 검색 및 필터 바 */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="휴지통에서 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4"
              />
            </div>
            
            <div className="flex gap-2">
              {/* 필터 드롭다운 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Filter className="h-4 w-4" />
                    필터
                    {filterType !== 'all' && (
                      <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded text-xs">
                        1
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>필터 옵션</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setFilterType('all')}
                    className={filterType === 'all' ? 'bg-purple-50' : ''}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    모든 항목
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setFilterType('expiring_soon')}
                    className={filterType === 'expiring_soon' ? 'bg-purple-50' : ''}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2 text-orange-500" />
                    곧 삭제 예정 (7일 이내)
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setFilterType('has_images')}
                    className={filterType === 'has_images' ? 'bg-purple-50' : ''}
                  >
                    <ImageIcon className="h-4 w-4 mr-2 text-green-500" />
                    이미지 있음
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setFilterType('empty')}
                    className={filterType === 'empty' ? 'bg-purple-50' : ''}
                  >
                    <FolderOpen className="h-4 w-4 mr-2 text-gray-500" />
                    빈 프로젝트
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* 정렬 드롭다운 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <SortDesc className="h-4 w-4" />
                    정렬
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>정렬 기준</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setSortType('recent')}
                    className={sortType === 'recent' ? 'bg-purple-50' : ''}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    최근 삭제순
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setSortType('oldest')}
                    className={sortType === 'oldest' ? 'bg-purple-50' : ''}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    오래된 순
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setSortType('name')}
                    className={sortType === 'name' ? 'bg-purple-50' : ''}
                  >
                    <SortDesc className="h-4 w-4 mr-2" />
                    이름순
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setSortType('expiring')}
                    className={sortType === 'expiring' ? 'bg-purple-50' : ''}
                  >
                    <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
                    삭제 임박순
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* 전체 선택 체크박스 */}
              {filteredProjects.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="gap-2"
                >
                  {selectedProjects.size === filteredProjects.length ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  전체 선택
                </Button>
              )}
            </div>
          </div>

          {/* 프로젝트 그리드 */}
          {filteredProjects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isSelected={selectedProjects.has(project.id)}
                  onSelect={handleSelectProject}
                  onRestore={handleRestore}
                  onDelete={handlePermanentDelete}
                  isRestoring={processingIds.has(project.id)}
                  isDeleting={processingIds.has(project.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                <Trash2 className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                휴지통이 비어있습니다
              </h3>
              <p className="text-gray-500 mb-6">
                삭제된 프로젝트가 여기에 표시됩니다
              </p>
              <Button 
                onClick={() => router.push('/projects')}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                프로젝트로 돌아가기
              </Button>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}