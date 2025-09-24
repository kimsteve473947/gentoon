"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Eye, Heart, Star, Calendar, User, Tag, PlayCircle } from 'lucide-react';
import Link from 'next/link';

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

interface GalleryEpisode {
  id: string;
  series_id: string;
  episode_number: number;
  title: string;
  description: string;
  thumbnail_url: string;
  panels: any[];
  view_count: number;
  like_count: number;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export default function SeriesDetailPage() {
  const params = useParams();
  const [series, setSeries] = useState<GallerySeries | null>(null);
  const [episodes, setEpisodes] = useState<GalleryEpisode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchSeriesDetail(params.id as string);
    }
  }, [params.id]);

  const fetchSeriesDetail = async (seriesId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/gallery/series/${seriesId}`);
      const data = await response.json();

      if (response.ok) {
        setSeries(data.series);
        setEpisodes(data.episodes || []);
      } else {
        console.error('Failed to fetch series:', data.error);
      }
    } catch (error) {
      console.error('Error fetching series:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-32 mb-8" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <div className="aspect-[3/4] bg-gray-200 rounded-lg mb-4" />
                <div className="space-y-2">
                  <div className="h-6 bg-gray-200 rounded" />
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                </div>
              </div>
              <div className="lg:col-span-2">
                <div className="space-y-4">
                  <div className="h-8 bg-gray-200 rounded w-3/4" />
                  <div className="h-20 bg-gray-200 rounded" />
                  <div className="grid grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-32 bg-gray-200 rounded" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😔</div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-2">작품을 찾을 수 없습니다</h3>
          <p className="text-gray-600 mb-4">요청하신 작품이 존재하지 않거나 삭제되었습니다.</p>
          <Link href="/gallery">
            <Button>갤러리로 돌아가기</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Link href="/gallery">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="h-4 w-4 mr-2" />
            갤러리로 돌아가기
          </Button>
        </Link>

        {/* Series Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-1">
            <div className="aspect-[3/4] relative overflow-hidden rounded-lg shadow-lg mb-4">
              <img
                src={series.cover_image_url || series.thumbnail_url || `https://picsum.photos/400/533?random=${series.id}`}
                alt={series.title}
                className="w-full h-full object-cover"
              />
              {series.is_featured && (
                <Badge className="absolute top-4 left-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                  <Star className="h-3 w-3 mr-1" />
                  인기작
                </Badge>
              )}
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="flex items-center justify-center text-blue-600 mb-1">
                    <Eye className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-semibold">{formatNumber(series.view_count)}</div>
                  <div className="text-xs text-gray-500">조회수</div>
                </div>
                <div>
                  <div className="flex items-center justify-center text-red-500 mb-1">
                    <Heart className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-semibold">{formatNumber(series.like_count)}</div>
                  <div className="text-xs text-gray-500">좋아요</div>
                </div>
                <div>
                  <div className="flex items-center justify-center text-yellow-500 mb-1">
                    <Star className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-semibold">{series.rating}/5</div>
                  <div className="text-xs text-gray-500">평점</div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <h1 className="text-3xl font-bold text-gray-900">{series.title}</h1>
                <Badge variant={series.status === 'completed' ? 'default' : 'secondary'}>
                  {series.status === 'completed' ? '완결' : '연재중'}
                </Badge>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-1" />
                  {series.author}
                </div>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  {formatDate(series.created_at)}
                </div>
                <div className="flex items-center">
                  <Tag className="h-4 w-4 mr-1" />
                  {series.category}
                </div>
              </div>

              <p className="text-gray-700 leading-relaxed mb-6">{series.description}</p>

              <div className="flex flex-wrap gap-2">
                {series.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Episodes */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              에피소드 ({episodes.length}화)
            </h2>
          </div>

          {episodes.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg">
              <div className="text-6xl mb-4">📖</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">아직 에피소드가 없습니다</h3>
              <p className="text-gray-600">곧 흥미진진한 에피소드들이 업데이트될 예정입니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {episodes.map((episode) => (
                <Link key={episode.id} href={`/gallery/episode/${episode.id}`}>
                  <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer group">
                    <div className="aspect-[16/9] relative overflow-hidden">
                      <img
                        src={episode.thumbnail_url || `https://picsum.photos/400/225?random=ep${episode.id}`}
                        alt={episode.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-300 flex items-center justify-center">
                        <PlayCircle className="h-12 w-12 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                      <Badge className="absolute top-2 left-2 bg-blue-600">
                        {episode.episode_number}화
                      </Badge>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-bold text-lg mb-2 line-clamp-1 group-hover:text-blue-600 transition-colors">
                        {episode.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {episode.description}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{formatDate(episode.published_at)}</span>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center">
                            <Eye className="h-3 w-3 mr-1" />
                            <span>{formatNumber(episode.view_count)}</span>
                          </div>
                          <div className="flex items-center">
                            <Heart className="h-3 w-3 mr-1" />
                            <span>{formatNumber(episode.like_count)}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}