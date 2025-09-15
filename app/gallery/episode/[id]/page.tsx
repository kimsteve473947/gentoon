"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  ArrowRight, 
  Eye, 
  Heart, 
  Share2, 
  ChevronLeft, 
  ChevronRight,
  Home,
  User,
  Calendar 
} from 'lucide-react';
import Link from 'next/link';

interface Panel {
  type: string;
  imageUrl: string;
  order: number;
  text?: string;
}

interface GalleryEpisode {
  id: string;
  series_id: string;
  episode_number: number;
  title: string;
  description: string;
  thumbnail_url: string;
  panels: Panel[];
  view_count: number;
  like_count: number;
  published_at: string;
  created_at: string;
  updated_at: string;
  series: {
    id: string;
    title: string;
    author: string;
    category: string;
  };
}

export default function EpisodeViewerPage() {
  const params = useParams();
  const [episode, setEpisode] = useState<GalleryEpisode | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPanel, setCurrentPanel] = useState(0);
  const [viewMode, setViewMode] = useState<'scroll' | 'page'>('scroll');
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchEpisodeDetail(params.id as string);
    }
  }, [params.id]);

  const fetchEpisodeDetail = async (episodeId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/gallery/episodes/${episodeId}`);
      const data = await response.json();

      if (response.ok) {
        setEpisode(data);
      } else {
        console.error('Failed to fetch episode:', data.error);
      }
    } catch (error) {
      console.error('Error fetching episode:', error);
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

  const handlePrevPanel = () => {
    setCurrentPanel((prev) => Math.max(0, prev - 1));
  };

  const handleNextPanel = () => {
    if (episode) {
      setCurrentPanel((prev) => Math.min(episode.panels.length - 1, prev + 1));
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: episode?.title || '웹툰 에피소드',
        text: episode?.description || '',
        url: window.location.href,
      });
    } catch (error) {
      // 웹 공유 API가 지원되지 않는 경우 URL 복사
      navigator.clipboard.writeText(window.location.href);
      alert('링크가 복사되었습니다!');
    }
  };

  const handleLike = async () => {
    if (!episode) return;
    
    try {
      const action = isLiked ? 'unlike' : 'like';
      const response = await fetch(`/api/gallery/episodes/${episode.id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        const data = await response.json();
        setEpisode(prev => prev ? { ...prev, like_count: data.like_count } : null);
        setIsLiked(!isLiked);
      }
    } catch (error) {
      console.error('Failed to like episode:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>에피소드를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-6xl mb-4">😔</div>
          <h3 className="text-2xl font-semibold mb-2">에피소드를 찾을 수 없습니다</h3>
          <p className="text-gray-400 mb-4">요청하신 에피소드가 존재하지 않거나 삭제되었습니다.</p>
          <Link href="/gallery">
            <Button variant="outline">갤러리로 돌아가기</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/gallery/${episode.series.id}`}>
                <Button variant="ghost" size="sm" className="text-white">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  목록
                </Button>
              </Link>
              <div>
                <h1 className="font-bold text-lg truncate max-w-[200px] md:max-w-none">
                  {episode.title}
                </h1>
                <p className="text-sm text-gray-400">
                  {episode.series.title} • {episode.episode_number}화
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-4 text-sm text-gray-400 mr-4">
                <div className="flex items-center">
                  <Eye className="h-4 w-4 mr-1" />
                  {formatNumber(episode.view_count)}
                </div>
                <div className="flex items-center">
                  <Heart className="h-4 w-4 mr-1" />
                  {formatNumber(episode.like_count)}
                </div>
              </div>

              <Button variant="ghost" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4" />
              </Button>

              <div className="flex items-center border border-gray-700 rounded-lg">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('scroll')}
                  className={viewMode === 'scroll' ? 'bg-gray-700' : ''}
                >
                  스크롤
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('page')}
                  className={viewMode === 'page' ? 'bg-gray-700' : ''}
                >
                  페이지
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Episode Info */}
      <div className="max-w-4xl mx-auto px-4 py-6 border-b border-gray-800">
        <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
          <div className="flex items-center">
            <User className="h-4 w-4 mr-1" />
            {episode.series.author}
          </div>
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-1" />
            {formatDate(episode.published_at)}
          </div>
          <Badge variant="outline">
            {episode.series.category}
          </Badge>
        </div>
        <p className="text-gray-300 leading-relaxed">
          {episode.description}
        </p>
      </div>

      {/* Panels */}
      <div className="max-w-4xl mx-auto px-4 pb-12">
        {viewMode === 'scroll' ? (
          // Scroll Mode
          <div className="space-y-2">
            {episode.panels.map((panel, index) => (
              <div key={index} className="relative">
                <img
                  src={panel.imageUrl}
                  alt={`Panel ${index + 1}`}
                  className="w-full h-auto rounded-lg shadow-lg"
                  loading="lazy"
                />
                {panel.text && (
                  <div className="absolute bottom-4 left-4 right-4 bg-black/80 rounded-lg p-3">
                    <p className="text-white text-sm leading-relaxed">
                      {panel.text}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          // Page Mode
          <div className="relative">
            <div className="text-center mb-4">
              <span className="text-gray-400 text-sm">
                {currentPanel + 1} / {episode.panels.length}
              </span>
            </div>

            <div className="relative">
              <img
                src={episode.panels[currentPanel]?.imageUrl}
                alt={`Panel ${currentPanel + 1}`}
                className="w-full h-auto rounded-lg shadow-lg"
              />
              {episode.panels[currentPanel]?.text && (
                <div className="absolute bottom-4 left-4 right-4 bg-black/80 rounded-lg p-3">
                  <p className="text-white text-sm leading-relaxed">
                    {episode.panels[currentPanel].text}
                  </p>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPanel}
                disabled={currentPanel === 0}
                className="flex items-center"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                이전
              </Button>

              <div className="flex gap-1">
                {episode.panels.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPanel(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentPanel ? 'bg-white' : 'bg-gray-600'
                    }`}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPanel}
                disabled={currentPanel === episode.panels.length - 1}
                className="flex items-center"
              >
                다음
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm border-t border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/gallery">
              <Button variant="ghost" size="sm">
                <Home className="h-4 w-4 mr-2" />
                갤러리 홈
              </Button>
            </Link>

            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleLike}
                className={cn(
                  "transition-colors",
                  isLiked ? "text-red-500" : "text-white"
                )}
              >
                <Heart className={cn("h-4 w-4 mr-1", isLiked && "fill-current")} />
                {formatNumber(episode.like_count)}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}