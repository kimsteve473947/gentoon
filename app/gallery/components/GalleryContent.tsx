"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, Heart, Star, Clock, User, Tag, Search, Filter, X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';

interface GallerySeries {
  id: string;
  title: string;
  description: string;
  author: string;
  tags: string[];
  thumbnail_url: string;
  cover_image_url: string;
  category: string;
  status: string;
  rating: number;
  view_count: number;
  like_count: number;
  is_featured: boolean;
  is_premium: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { id: 'all', name: '전체', emoji: '📚' },
  { id: 'romance', name: '로맨스', emoji: '💕' },
  { id: 'fantasy', name: '판타지', emoji: '🔮' },
  { id: 'action', name: '액션', emoji: '⚔️' },
  { id: 'comedy', name: '코미디', emoji: '😂' },
  { id: 'drama', name: '드라마', emoji: '🎭' },
];

export default function GalleryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [series, setSeries] = useState<GallerySeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || 'all');
  const [viewMode, setViewMode] = useState<'featured' | 'all'>(
    searchParams.get('featured') === 'true' ? 'featured' : 'all'
  );
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });

  const fetchSeries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        category: activeCategory,
        featured: viewMode === 'featured' ? 'true' : 'false',
        limit: '12',
        page: '1',
      });

      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }

      const response = await fetch(`/api/gallery/series?${params}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setSeries(data.series || []);
        setPagination(data.pagination || {});
      } else {
        console.error('Failed to fetch series:', data.error);
        setSeries([]);
      }
    } catch (error) {
      console.error('Error fetching series:', error);
      setSeries([]);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, viewMode, searchQuery]);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

  useEffect(() => {
    // URL 파라미터 업데이트
    const params = new URLSearchParams();
    if (activeCategory !== 'all') params.set('category', activeCategory);
    if (viewMode === 'featured') params.set('featured', 'true');
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    
    const newUrl = params.toString() ? `?${params}` : '';
    router.replace(`/gallery${newUrl}`, { scroll: false });
  }, [activeCategory, viewMode, searchQuery, router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSeries();
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const handleLike = async (seriesId: string, currentLikes: number) => {
    try {
      const response = await fetch(`/api/gallery/series/${seriesId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like' }),
      });

      if (response.ok) {
        const data = await response.json();
        setSeries(prev => 
          prev.map(s => 
            s.id === seriesId 
              ? { ...s, like_count: data.like_count }
              : s
          )
        );
      }
    } catch (error) {
      console.error('Failed to like series:', error);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              🎨 AI 웹툰 갤러리
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              AI가 그려낸 고품질 웹툰들을 만나보세요. 
              상상 속에서만 존재했던 이야기들이 생생하게 펼쳐집니다.
            </p>
          </div>

          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'featured' | 'all')} className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
              <TabsTrigger value="featured" className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                인기작품
              </TabsTrigger>
              <TabsTrigger value="all" className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                전체작품
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="웹툰 제목, 작가, 내용으로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 h-12 text-base"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>

          {/* Active Filters */}
          {(searchQuery || activeCategory !== 'all' || viewMode === 'featured') && (
            <div className="flex flex-wrap items-center gap-2 justify-center">
              <div className="flex items-center text-sm text-gray-600 mr-2">
                <Filter className="h-4 w-4 mr-1" />
                활성 필터:
              </div>
              {searchQuery && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  검색: {searchQuery}
                  <button onClick={clearSearch}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {activeCategory !== 'all' && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  카테고리: {CATEGORIES.find(c => c.id === activeCategory)?.name}
                  <button onClick={() => setActiveCategory('all')}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {viewMode === 'featured' && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  인기작만
                  <button onClick={() => setViewMode('all')}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 justify-center">
            {CATEGORIES.map((category) => (
              <Button
                key={category.id}
                variant={activeCategory === category.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  "transition-all duration-200",
                  activeCategory === category.id 
                    ? "bg-blue-600 hover:bg-blue-700" 
                    : "hover:bg-gray-100"
                )}
              >
                <span className="mr-1">{category.emoji}</span>
                {category.name}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Series Grid */}
      <div className="max-w-7xl mx-auto px-4 pb-12">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="aspect-[3/4] bg-gray-200 animate-pulse" />
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="h-6 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                    <div className="flex gap-2">
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-16" />
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-16" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : series.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-2">작품이 없습니다</h3>
            <p className="text-gray-600">다른 카테고리를 선택해보세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {series.map((item) => (
              <Link key={item.id} href={`/gallery/${item.id}`}>
                <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer group">
                  <div className="aspect-[3/4] relative overflow-hidden">
                    <Image
                      src={item.thumbnail_url || item.cover_image_url || `https://picsum.photos/400/533?random=${item.id}`}
                      alt={item.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      priority={false}
                    />
                    {item.is_featured && (
                      <Badge className="absolute top-2 left-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                        <Star className="h-3 w-3 mr-1" />
                        인기
                      </Badge>
                    )}
                    {item.status === 'completed' && (
                      <Badge variant="secondary" className="absolute top-2 right-2">
                        완결
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-bold text-lg mb-2 line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {item.description}
                    </p>
                    
                    <div className="flex items-center text-xs text-gray-500 mb-2">
                      <User className="h-3 w-3 mr-1" />
                      <span className="mr-3">{item.author}</span>
                      <Clock className="h-3 w-3 mr-1" />
                      <span>{item.status === 'ongoing' ? '연재중' : '완결'}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                      <div className="flex items-center">
                        <Eye className="h-3 w-3 mr-1" />
                        <span>{formatNumber(item.view_count)}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleLike(item.id, item.like_count);
                        }}
                        className="flex items-center hover:text-red-500 transition-colors"
                      >
                        <Heart className="h-3 w-3 mr-1" />
                        <span>{formatNumber(item.like_count)}</span>
                      </button>
                      <div className="flex items-center">
                        <Star className="h-3 w-3 mr-1 text-yellow-500" />
                        <span>{item.rating}/5</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {item.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {item.tags.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{item.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}