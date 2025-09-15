"use client";

import { memo, useState, useEffect, useMemo } from 'react';
import { BUBBLE_TEMPLATES } from './BubbleTemplates';

interface LazyBubbleTemplateRendererProps {
  templateId: string;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  className?: string;
  priority?: boolean; // 우선순위 템플릿은 즉시 로드
}

// Lazy loading을 위한 템플릿 캐시
const templateCache = new Map<string, string>();

// 큰 SVG 템플릿을 위한 지연 로딩 렌더러
export const LazyBubbleTemplateRenderer = memo(({
  templateId,
  fillColor = '#ffffff',
  strokeColor = '#333333',
  strokeWidth = 2,
  className = '',
  priority = false
}: LazyBubbleTemplateRendererProps) => {
  const [isLoaded, setIsLoaded] = useState(priority);
  const [isVisible, setIsVisible] = useState(false);
  
  // 템플릿 SVG 메모이제이션
  const svgContent = useMemo(() => {
    const template = BUBBLE_TEMPLATES.find(t => t.id === templateId);
    if (!template) return null;
    
    const cacheKey = `${templateId}-${fillColor}-${strokeColor}-${strokeWidth}`;
    
    if (templateCache.has(cacheKey)) {
      return templateCache.get(cacheKey);
    }
    
    const svg = template.getSvg(fillColor, strokeColor, strokeWidth);
    templateCache.set(cacheKey, svg);
    return svg;
  }, [templateId, fillColor, strokeColor, strokeWidth]);

  // Intersection Observer를 사용한 지연 로딩
  useEffect(() => {
    if (priority || isLoaded) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            // 약간의 지연 후 로딩하여 스크롤 성능 향상
            setTimeout(() => {
              setIsLoaded(true);
            }, 50);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // 뷰포트에 들어오기 전에 미리 로딩
        threshold: 0.1
      }
    );

    const element = document.querySelector(`[data-template-id="${templateId}"]`);
    if (element) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [templateId, priority, isLoaded]);

  if (!isLoaded) {
    return (
      <div 
        className={`bg-slate-100 animate-pulse flex items-center justify-center ${className}`}
        data-template-id={templateId}
      >
        <div className="text-xs text-slate-400">로딩...</div>
      </div>
    );
  }

  if (!svgContent) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <span className="text-gray-400 text-xs">템플릿 없음</span>
      </div>
    );
  }

  return (
    <div 
      className={className}
      data-template-id={templateId}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
});

LazyBubbleTemplateRenderer.displayName = 'LazyBubbleTemplateRenderer';