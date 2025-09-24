'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Heart, Calendar, Building2, User, RefreshCw, Trash2, MoreVertical } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { cn } from '@/lib/utils';
import type { WebtoonProject, WebtoonResponse, WebtoonFilters } from '@/types/webtoon';

const CATEGORY_INFO = {
  instatoon: {
    name: '인스타툰',
    color: 'from-pink-500 to-purple-500',
    badge: 'bg-pink-100 text-pink-700'
  },
  webtoon: {
    name: '웹툰',
    color: 'from-purple-500 to-blue-500', 
    badge: 'bg-purple-100 text-purple-700'
  },
  branding: {
    name: '브랜딩',
    color: 'from-blue-500 to-indigo-500',
    badge: 'bg-blue-100 text-blue-700'
  }
};

const ADMIN_EMAIL = 'kimjh473947@gmail.com';

export default function WebtoonGallery() {
  const router = useRouter();
  const [projects, setProjects] = useState<WebtoonProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filters, setFilters] = useState<WebtoonFilters>({
    category: 'all',
    page: 1,
    limit: 12,
    sortBy: 'created_at',
    sortOrder: 'desc'
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 프로젝트 데이터 가져오기
  const fetchProjects = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      
      if (filters.category && filters.category !== 'all') {
        queryParams.set('category', filters.category);
      }
      if (filters.featured) {
        queryParams.set('featured', 'true');
      }
      if (filters.search) {
        queryParams.set('search', filters.search);
      }
      if (filters.client) {
        queryParams.set('client', filters.client);
      }
      queryParams.set('page', (filters.page || 1).toString());
      queryParams.set('limit', (filters.limit || 12).toString());
      queryParams.set('sortBy', filters.sortBy || 'created_at');
      queryParams.set('sortOrder', filters.sortOrder || 'desc');

      const response = await fetch(`/api/webtoon?${queryParams}`);
      const data: WebtoonResponse = await response.json();

      if (data.success) {
        setProjects(data.data);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      } else {
        console.error('Failed to fetch projects:', data.error);
        setProjects([]);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 관리자 권한 확인
    const checkAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.email === ADMIN_EMAIL) {
          setIsAdmin(true);
        }
      } catch (error) {
        console.log('Admin check failed:', error);
      }
    };

    checkAdmin();
    fetchProjects();
  }, [filters]);

  // 필터 업데이트 함수
  const updateFilters = (newFilters: Partial<WebtoonFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  // 페이지 변경
  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  // 프로젝트 삭제
  const handleDelete = async (projectId: string, e: React.MouseEvent) => {
    e.preventDefault(); // 카드 클릭 이벤트 방지
    e.stopPropagation();
    
    if (!confirm('정말로 이 작품을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('인증이 필요합니다.');
        return;
      }

      const response = await fetch(`/api/webtoon/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        // 목록에서 제거
        setProjects(prev => prev.filter(p => p.id !== projectId));
        alert('작품이 성공적으로 삭제되었습니다.');
      } else {
        throw new Error(result.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}만`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}천`;
    }
    return num.toString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-4 py-24">
          <div className="text-center text-white">
            <div className="flex items-center justify-between mb-8">
              <div className="flex-1"></div>
              <div className="flex-1">
                <h1 className="text-5xl font-bold mb-4">
                  ✨ GenToon Gallery
                </h1>
                <p className="text-xl text-purple-100 max-w-2xl mx-auto">
                  AI 기술로 제작한 고품질 웹툰과 인스타툰 작품들
                </p>
              </div>
              <div className="flex-1 flex justify-end">
                {isAdmin && (
                  <Button
                    onClick={() => router.push('/admin/upload')}
                    className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30 shadow-lg"
                    size="lg"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    새 작품 업로드
                  </Button>
                )}
              </div>
            </div>
            
          </div>
        </div>
        
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-48 translate-x-48"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full blur-3xl translate-y-48 -translate-x-48"></div>
      </div>

      {/* Projects Grid */}
      <div className="container mx-auto px-4 py-16">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">작품을 불러오는 중...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {projects.map((project, index) => {
              const categoryInfo = CATEGORY_INFO[project.category];
              
              return (
                <Card
                  key={project.id}
                  className={cn(
                    "group overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500",
                    "bg-white/80 backdrop-blur-sm",
                    "transform hover:scale-[1.02] hover:-translate-y-1",
                    "cursor-pointer"
                  )}
                  onClick={() => router.push(`/gallery/${project.id}`)}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-square overflow-hidden rounded-t-lg bg-white">
                    
                    {/* Actual image or placeholder */}
                    {project.thumbnail_url ? (
                      <Image
                        src={project.thumbnail_url}
                        alt={project.title}
                        fill
                        className="object-contain p-4"
                        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                        <div className="text-center p-2">
                          <div className="text-xl mb-1">🎨</div>
                          <p className="text-xs text-gray-600 font-medium line-clamp-2">
                            {project.title}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {/* Featured badge - 작게 표시 */}
                    {project.featured && (
                      <div className="absolute top-2 left-2 w-2 h-2 bg-yellow-400 rounded-full shadow-sm"></div>
                    )}

                    {/* Admin delete button */}
                    {isAdmin && (
                      <div className="absolute bottom-2 right-2 z-20">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 bg-red-500/80 hover:bg-red-600/90 text-white border-0 rounded-full shadow-lg z-30"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="z-50">
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600 cursor-pointer"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDelete(project.id, e);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              삭제
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className={cn(
                      "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent",
                      "opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                      "flex items-end p-3"
                    )}>
                      <div className="text-white">
                        <p className="text-xs mb-1 opacity-90">
                          자세히 보기
                        </p>
                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1">
                            <Heart className="h-3 w-3" />
                            {formatNumber(project.likes)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <CardContent className="p-2">
                    <div className="mb-1">
                      <h3 className="text-xs font-bold text-gray-900 mb-1 line-clamp-1 group-hover:text-purple-600 transition-colors">
                        {project.title}
                      </h3>
                      <p className="text-gray-600 text-xs line-clamp-1 leading-relaxed">
                        {project.client}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Heart className="h-3 w-3" />
                          <span>{formatNumber(project.likes)}</span>
                        </div>
                      </div>
                      
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {projects.length > 0 && pagination.totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-12">
            <Button
              variant="outline"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="bg-white/80 backdrop-blur-sm border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300 shadow-lg disabled:opacity-50"
            >
              이전
            </Button>
            
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const pageNum = pagination.page + i - 2;
                if (pageNum < 1 || pageNum > pagination.totalPages) return null;
                
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === pagination.page ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    className={cn(
                      "w-10 h-10 p-0",
                      pageNum === pagination.page 
                        ? "bg-purple-600 text-white" 
                        : "bg-white/80 backdrop-blur-sm border-purple-200 text-purple-700 hover:bg-purple-50"
                    )}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="bg-white/80 backdrop-blur-sm border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300 shadow-lg disabled:opacity-50"
            >
              다음
            </Button>
          </div>
        )}
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700 p-12 text-center text-white">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-4">
              GenToon과 함께 만들어보세요
            </h2>
            <p className="text-xl text-purple-100 mb-8 max-w-2xl mx-auto">
              여러분의 브랜드 스토리를 AI 웹툰으로 표현해보세요.<br />
              무료 홍보와 함께 고품질 콘텐츠를 제작해드립니다.
            </p>
            <Button 
              size="lg" 
              className="bg-white text-purple-600 hover:bg-gray-100 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 font-semibold"
            >
              프로젝트 문의하기
            </Button>
          </div>
          
          {/* Background decoration */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-xl"></div>
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
        </div>
      </div>
    </div>
  );
}