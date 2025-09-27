"use client";

import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

interface OptimizedCanvasImageProps {
  src: string;
  alt: string;
  cutId: string;
  generationId?: string;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
}

export function OptimizedCanvasImage({ 
  src, 
  alt, 
  cutId, 
  generationId,
  className = "",
  style = {},
  onLoad,
  onError 
}: OptimizedCanvasImageProps) {
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [currentSrc, setCurrentSrc] = useState<string>(src);
  const [previousSrc, setPreviousSrc] = useState<string | null>(null);

  // 새로운 이미지 프리로딩
  const preloadImage = useCallback((imageSrc: string) => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        console.log(`✅ 이미지 프리로드 완료: ${cutId}`);
        resolve();
      };
      img.onerror = () => {
        console.error(`❌ 이미지 프리로드 실패: ${cutId}`);
        reject(new Error('Image preload failed'));
      };
      img.src = imageSrc;
    });
  }, [cutId]);

  // src 변경 감지 및 프리로딩 처리
  useEffect(() => {
    if (src !== currentSrc) {
      console.log(`🔄 새로운 이미지 감지: ${cutId}`);
      
      // 이전 이미지 보존
      setPreviousSrc(currentSrc);
      setImageState('loading');

      // 새로운 이미지 프리로딩
      preloadImage(src)
        .then(() => {
          setCurrentSrc(src);
          setImageState('loaded');
          setPreviousSrc(null); // 이전 이미지 제거
          onLoad?.();
        })
        .catch(() => {
          setImageState('error');
          onError?.();
        });
    }
  }, [src, currentSrc, cutId, preloadImage, onLoad, onError]);

  // 초기 로딩
  useEffect(() => {
    if (imageState === 'loading' && currentSrc === src) {
      preloadImage(src)
        .then(() => {
          setImageState('loaded');
          onLoad?.();
        })
        .catch(() => {
          setImageState('error');
          onError?.();
        });
    }
  }, [src, currentSrc, imageState, preloadImage, onLoad, onError]);

  // 캐시 버스터가 포함된 최종 URL
  const finalSrc = currentSrc + `${currentSrc.includes('?') ? '&' : '?'}gen=${generationId || Date.now()}`;

  return (
    <div className="relative w-full h-full">
      {/* 이전 이미지 (페이드 아웃용) */}
      {previousSrc && imageState === 'loading' && (
        <img
          src={previousSrc}
          alt={alt}
          className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${className}`}
          style={{
            ...style,
            opacity: 0.7,
            zIndex: 1
          }}
          draggable={false}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
        />
      )}

      {/* 로딩 인디케이터 */}
      {imageState === 'loading' && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-slate-100"
          style={{ zIndex: 2 }}
        >
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            <span className="text-sm text-slate-500">이미지 로딩 중...</span>
          </div>
        </div>
      )}

      {/* 메인 이미지 */}
      {imageState === 'loaded' && (
        <img
          key={`${cutId}-${generationId || 'no-gen'}`}
          src={finalSrc}
          alt={alt}
          className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${className}`}
          style={{
            ...style,
            opacity: 1,
            zIndex: 3
          }}
          draggable={false}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
        />
      )}

      {/* 에러 상태 */}
      {imageState === 'error' && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-slate-100"
          style={{ zIndex: 2 }}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="text-red-500 text-2xl">⚠️</div>
            <span className="text-sm text-slate-500">이미지 로딩 실패</span>
          </div>
        </div>
      )}
    </div>
  );
}