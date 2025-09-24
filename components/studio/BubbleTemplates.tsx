"use client";

import { useState, useEffect } from 'react';

// 동적 말풍선 템플릿 타입 정의
interface DynamicBubbleTemplate {
  id: string;
  name: string;
  fileName: string;
  svgContent?: string;
}


// 파일명에서 표시명 생성하는 함수
const getDisplayNameFromFileName = (fileName: string): string => {
  return fileName
    .replace('.svg', '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};

// 동적으로 말풍선 목록을 생성하는 함수
const generateBubbleTemplates = (): DynamicBubbleTemplate[] => {
  const bubbleFiles = [
    'balloon-29346.svg',
    'balloon-34420.svg', 
    'balloon-35457.svg',
    'balloon-389128.svg',
    'bubble-154255.svg',
    'bubble-160851.svg',
    'bubble-296488.svg',
    'bubble-309556.svg',
    'cloud-295290.svg',
    'cloud-295290 (1).svg',
    'cloud-304979.svg',
    'speech-25912.svg',
    'speech-25915.svg',
    'speech-25916.svg',
    'speech-25917.svg',
    'speech-34422.svg',
    'speech-34425.svg',
    'speech-34427.svg',
    'speech-bubble-145971.svg',
    'speech-bubble-145974.svg',
    'speech-bubble-145977.svg',
    'speech-bubble-145978.svg',
    'speech-bubble-145979.svg',
    'speech-bubble-148171.svg',
    'think-145972.svg',
    'thinking-148170.svg'
  ];

  return bubbleFiles.map((fileName, index) => ({
    id: `bubble-${index + 1}`,
    name: getDisplayNameFromFileName(fileName),
    fileName
  }));
};

// 동적으로 생성된 말풍선 템플릿 목록
export const BUBBLE_TEMPLATES: DynamicBubbleTemplate[] = generateBubbleTemplates();

export const BUBBLE_CATEGORIES = [
  { id: 'all', name: '전체', emoji: '🎨' }
];

// SVG 콘텐츠를 로드하는 Hook
export const useBubbleTemplate = (template?: DynamicBubbleTemplate) => {
  const [svgContent, setSvgContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!template) {
      setSvgContent('');
      setLoading(false);
      return;
    }

    const loadSvgContent = async () => {
      if (template.svgContent) {
        setSvgContent(template.svgContent);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`/bubbles/${template.fileName}`);
        if (response.ok) {
          const content = await response.text();
          setSvgContent(content);
          // 템플릿 객체에 캐시
          template.svgContent = content;
        }
      } catch (error) {
        console.error(`Failed to load SVG: ${template.fileName}`, error);
      } finally {
        setLoading(false);
      }
    };

    loadSvgContent();
  }, [template]);

  return { svgContent, loading };
};

// SVG 콘텐츠에 색상 스타일을 적용하는 함수
export const applySvgStyles = (
  svgContent: string, 
  fillColor = 'white', 
  strokeColor = '#333', 
  strokeWidth = 2
): string => {
  if (!svgContent) return '';
  
  return svgContent
    .replace(/fill="[^"]*"/g, `fill="${fillColor}"`)
    .replace(/stroke="[^"]*"/g, `stroke="${strokeColor}"`)
    .replace(/stroke-width="[^"]*"/g, `stroke-width="${strokeWidth}"`)
    .replace(/preserveAspectRatio="[^"]*"/g, 'preserveAspectRatio="none"')
    .replace(/<svg/, `<svg preserveAspectRatio="none" style="width: 100%; height: 100%"`);
};