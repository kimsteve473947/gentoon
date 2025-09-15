"use client";

import { memo } from 'react';
import { BUBBLE_TEMPLATES } from './BubbleTemplates';

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
  const template = BUBBLE_TEMPLATES.find(t => t.id === templateId);
  
  if (!template) {
    return null;
  }

  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ 
        __html: template.getSvg(fillColor, strokeColor, strokeWidth)
      }}
    />
  );
});

BubbleTemplateRenderer.displayName = 'BubbleTemplateRenderer';