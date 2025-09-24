'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ArrowLeft, 
  Heart, 
  Share2, 
  Calendar, 
  Building2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WebtoonProject } from '@/types/webtoon';

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

interface WebtoonDetailPageProps {
  project: WebtoonProject;
}

export default function WebtoonDetailPage({ project }: WebtoonDetailPageProps) {
  const router = useRouter();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(project.likes);
  const categoryInfo = CATEGORY_INFO[project.category];

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

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: project.title,
          text: project.description,
          url: window.location.href,
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('링크가 클립보드에 복사되었습니다!');
    }
  };

  const handleLike = async () => {
    // 좋아요 토글 로직 (실제 구현 시 API 호출)
    setLiked(!liked);
    setLikes(prev => liked ? prev - 1 : prev + 1);
  };

  const nextImage = () => {
    setCurrentImageIndex(prev => 
      prev === project.images.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    setCurrentImageIndex(prev => 
      prev === 0 ? project.images.length - 1 : prev - 1
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm z-10 border-b">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/gallery')}
            className="text-purple-600 hover:text-purple-800"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            갤러리로 돌아가기
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* 이미지 섹션 */}
            <div className="space-y-6">
              {/* 메인 이미지 */}
              <Card className="overflow-hidden border-0 shadow-2xl">
                <div className="relative aspect-[3/4] bg-gray-100">
                  {project.images.length > 0 ? (
                    <>
                      <Image
                        src={project.images[currentImageIndex]}
                        alt={`${project.title} - ${currentImageIndex + 1}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        priority
                      />
                      
                      {/* Navigation arrows */}
                      {project.images.length > 1 && (
                        <>
                          <button
                            onClick={prevImage}
                            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          <button
                            onClick={nextImage}
                            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </>
                      )}
                      
                      {/* Image counter */}
                      {project.images.length > 1 && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                          {currentImageIndex + 1} / {project.images.length}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <div className="text-center">
                        <div className="text-4xl mb-2">🎨</div>
                        <p>이미지가 없습니다</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* 썸네일 갤러리 */}
              {project.images.length > 1 && (
                <div className="grid grid-cols-4 gap-3">
                  {project.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={cn(
                        "aspect-square relative overflow-hidden rounded-lg border-2 transition-all",
                        currentImageIndex === index 
                          ? "border-purple-500 ring-2 ring-purple-200" 
                          : "border-gray-200 hover:border-purple-300"
                      )}
                    >
                      <Image
                        src={image}
                        alt={`${project.title} thumbnail ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 25vw, 12.5vw"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 정보 섹션 */}
            <div className="space-y-8">
              {/* 제목 및 기본 정보 */}
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Badge className={cn("border-0", categoryInfo.badge)}>
                        {categoryInfo.name}
                      </Badge>
                      {project.featured && (
                        <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0">
                          ⭐ 추천작
                        </Badge>
                      )}
                    </div>
                    
                    <h1 className="text-3xl font-bold text-gray-900 mb-3">
                      {project.title}
                    </h1>
                    
                    <div className="flex items-center gap-6 text-gray-600 mb-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span className="font-medium text-gray-800">{project.client}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(project.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-gray-700 text-lg leading-relaxed">
                  {project.description}
                </p>
              </div>

              {/* 통계 및 액션 */}
              <div className="space-y-6">
                <div className="flex items-center justify-between py-4 border-y border-gray-200">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Heart className="h-5 w-5" />
                      <span className="font-medium">{formatNumber(likes)} 좋아요</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={handleLike}
                    variant={liked ? "default" : "outline"}
                    size="lg"
                    className={cn(
                      "flex-1",
                      liked 
                        ? "bg-red-500 hover:bg-red-600 text-white" 
                        : "border-red-200 text-red-600 hover:bg-red-50"
                    )}
                  >
                    <Heart className={cn("h-5 w-5 mr-2", liked && "fill-current")} />
                    {liked ? '좋아요 취소' : '좋아요'}
                  </Button>
                  
                  <Button
                    onClick={handleShare}
                    variant="outline"
                    size="lg"
                    className="flex-1 border-purple-200 text-purple-600 hover:bg-purple-50"
                  >
                    <Share2 className="h-5 w-5 mr-2" />
                    공유하기
                  </Button>
                </div>
              </div>

              {/* 태그 */}
              {project.tags && project.tags.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">태그</h3>
                  <div className="flex flex-wrap gap-2">
                    {project.tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-purple-600 border-purple-200">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <Card className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">
                <CardContent className="p-6 text-center">
                  <h3 className="text-xl font-bold mb-2">
                    비슷한 프로젝트가 필요하신가요?
                  </h3>
                  <p className="text-purple-100 mb-4">
                    GenToon과 함께 브랜드 스토리를 AI 웹툰으로 만들어보세요
                  </p>
                  <Button 
                    size="lg" 
                    className="bg-white text-purple-600 hover:bg-gray-100"
                    asChild
                  >
                    <Link href="/studio">
                      프로젝트 시작하기
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}