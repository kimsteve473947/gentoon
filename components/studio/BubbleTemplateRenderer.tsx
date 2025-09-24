"use client";

import { memo, useMemo } from 'react';
import { BUBBLE_TEMPLATES, useBubbleTemplate, applySvgStyles } from './BubbleTemplates';

interface BubbleTemplateRendererProps {
  templateId: string;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  className?: string;
}

// 말풍선 SVG 렌더링을 최적화하기 위한 메모이제이션 컴포넌트
export const BubbleTemplateRenderer = memo(({
  templateId,
  fillColor = '#ffffff',
  strokeColor = '#333333',
  strokeWidth = 2,
  className = ''
}: BubbleTemplateRendererProps) => {
  
  // 템플릿 찾기
  const template = useMemo(() => 
    BUBBLE_TEMPLATES.find(t => t.id === templateId), 
    [templateId]
  );
  
  // SVG 콘텐츠 로드
  const { svgContent: rawSvgContent, loading } = useBubbleTemplate(template);
  
  // 스타일 적용된 SVG 콘텐츠
  const styledSvgContent = useMemo(() => {
    if (!rawSvgContent) return null;
    return applySvgStyles(rawSvgContent, fillColor, strokeColor, strokeWidth);
  }, [rawSvgContent, fillColor, strokeColor, strokeWidth]);
  
  if (loading) {
    return (
      <div className={`bg-slate-100 animate-pulse flex items-center justify-center ${className}`}>
        <div className="text-xs text-slate-400">로딩...</div>
      </div>
    );
  }
  
  if (!template || !styledSvgContent) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <span className="text-gray-400 text-xs">템플릿 없음</span>
      </div>
    );
  }

  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ 
        __html: styledSvgContent
      }}
    />
  );
});

BubbleTemplateRenderer.displayName = 'BubbleTemplateRenderer';