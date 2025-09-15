'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  fallback?: React.ReactNode;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
}

function LazyImage({
  src,
  alt,
  className,
  placeholder = 'data:image/svg+xml,%3csvg%20width="100%25"%20height="100%25"%20xmlns="http://www.w3.org/2000/svg"%3e%3crect%20width="100%25"%20height="100%25"%20fill="%23f3f4f6"/%3e%3c/svg%3e',
  fallback,
  width,
  height,
  style,
  onLoad,
  onError,
}: LazyImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const currentImg = imgRef.current;
    
    if (!currentImg) return;

    // Intersection Observer를 이용한 지연 로딩
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setIsInView(true);
          observerRef.current?.unobserve(currentImg);
        }
      },
      {
        threshold: 0.1, // 10% 보이면 로딩 시작
        rootMargin: '50px', // 50px 전에 미리 로딩
      }
    );

    observerRef.current.observe(currentImg);

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  // 에러가 발생했을 때 fallback 렌더링
  if (hasError && fallback) {
    return <div className={className}>{fallback}</div>;
  }

  return (
    <div className={cn('relative overflow-hidden', className)} style={style}>
      {/* 플레이스홀더 이미지 (항상 표시) */}
      <img
        ref={imgRef}
        src={placeholder}
        alt=""
        className={cn(
          'w-full h-full object-cover transition-opacity duration-300',
          isLoading ? 'opacity-100' : 'opacity-0'
        )}
        width={width}
        height={height}
        aria-hidden="true"
      />
      
      {/* 실제 이미지 (뷰포트에 들어왔을 때만 로딩) */}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
            isLoading ? 'opacity-0' : 'opacity-100'
          )}
          width={width}
          height={height}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
      
      {/* 로딩 상태 표시 */}
      {isLoading && isInView && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

export default LazyImage;