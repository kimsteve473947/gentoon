import { BubbleTemplate } from '@/types/editor';

export const BUBBLE_TEMPLATES: BubbleTemplate[] = [
  // 일반 대화
  {
    id: 'speech-round',
    name: '일반 대화',
    type: 'speech',
    style: 'round',
    preview: '💬',
    defaultSize: { width: 200, height: 100 }
  },
  {
    id: 'speech-rect',
    name: '각진 대화',
    type: 'speech',
    style: 'rectangle',
    preview: '🗨️',
    defaultSize: { width: 200, height: 100 }
  },
  
  // 생각
  {
    id: 'thought-cloud',
    name: '생각 구름',
    type: 'thought',
    style: 'cloud',
    preview: '💭',
    defaultSize: { width: 200, height: 100 }
  },
  {
    id: 'thought-round',
    name: '생각 동글',
    type: 'thought',
    style: 'round',
    preview: '🤔',
    defaultSize: { width: 180, height: 90 }
  },
  
  // 외침/강조
  {
    id: 'shout-jagged',
    name: '외침',
    type: 'shout',
    style: 'jagged',
    preview: '💢',
    defaultSize: { width: 200, height: 120 }
  },
  {
    id: 'shout-explosion',
    name: '폭발',
    type: 'shout',
    style: 'jagged',
    preview: '💥',
    defaultSize: { width: 220, height: 140 }
  },
  
  // 속삭임
  {
    id: 'whisper-dashed',
    name: '속삭임',
    type: 'whisper',
    style: 'round',
    preview: '🤫',
    defaultSize: { width: 160, height: 80 }
  },
  
  // 나레이션
  {
    id: 'narration-rect',
    name: '나레이션',
    type: 'narration',
    style: 'rectangle',
    preview: '📝',
    defaultSize: { width: 300, height: 80 }
  },
  {
    id: 'narration-top',
    name: '상단 나레이션',
    type: 'narration',
    style: 'rectangle',
    preview: '📋',
    defaultSize: { width: 400, height: 60 }
  }
];

// 말풍선 스타일별 SVG 경로 생성 함수
export function getBubblePath(style: string, width: number, height: number): string {
  switch (style) {
    case 'round':
      return `
        M ${width * 0.1},${height * 0.5}
        C ${width * 0.1},${height * 0.2} ${width * 0.2},${height * 0.1} ${width * 0.5},${height * 0.1}
        L ${width * 0.5},${height * 0.1}
        C ${width * 0.8},${height * 0.1} ${width * 0.9},${height * 0.2} ${width * 0.9},${height * 0.5}
        C ${width * 0.9},${height * 0.8} ${width * 0.8},${height * 0.9} ${width * 0.5},${height * 0.9}
        C ${width * 0.2},${height * 0.9} ${width * 0.1},${height * 0.8} ${width * 0.1},${height * 0.5}
        Z
      `;
      
    case 'cloud':
      return `
        M ${width * 0.2},${height * 0.5}
        C ${width * 0.1},${height * 0.2} ${width * 0.3},${height * 0.1} ${width * 0.5},${height * 0.2}
        C ${width * 0.6},${height * 0.05} ${width * 0.8},${height * 0.05} ${width * 0.85},${height * 0.25}
        C ${width * 0.95},${height * 0.3} ${width * 0.95},${height * 0.5} ${width * 0.85},${height * 0.6}
        C ${width * 0.9},${height * 0.8} ${width * 0.7},${height * 0.9} ${width * 0.5},${height * 0.85}
        C ${width * 0.3},${height * 0.9} ${width * 0.15},${height * 0.8} ${width * 0.2},${height * 0.5}
        Z
      `;
      
    case 'jagged':
      return `
        M ${width * 0.05},${height * 0.3}
        L ${width * 0.15},${height * 0.05}
        L ${width * 0.25},${height * 0.25}
        L ${width * 0.35},${height * 0.02}
        L ${width * 0.45},${height * 0.2}
        L ${width * 0.55},${height * 0.03}
        L ${width * 0.65},${height * 0.22}
        L ${width * 0.75},${height * 0.04}
        L ${width * 0.85},${height * 0.25}
        L ${width * 0.95},${height * 0.35}
        L ${width * 0.92},${height * 0.45}
        L ${width * 0.98},${height * 0.55}
        L ${width * 0.93},${height * 0.65}
        L ${width * 0.96},${height * 0.75}
        L ${width * 0.85},${height * 0.85}
        L ${width * 0.75},${height * 0.95}
        L ${width * 0.65},${height * 0.88}
        L ${width * 0.55},${height * 0.97}
        L ${width * 0.45},${height * 0.87}
        L ${width * 0.35},${height * 0.96}
        L ${width * 0.25},${height * 0.86}
        L ${width * 0.15},${height * 0.94}
        L ${width * 0.05},${height * 0.75}
        L ${width * 0.08},${height * 0.65}
        L ${width * 0.02},${height * 0.55}
        L ${width * 0.07},${height * 0.45}
        Z
      `;
      
    case 'rectangle':
    default:
      return `
        M ${width * 0.05},${height * 0.1}
        L ${width * 0.95},${height * 0.1}
        L ${width * 0.95},${height * 0.9}
        L ${width * 0.05},${height * 0.9}
        Z
      `;
  }
}

// 말풍선 꼬리 경로 생성 함수
export function getBubbleTailPath(
  bubbleType: string,
  width: number,
  height: number,
  tailX: number,
  tailY: number
): string {
  const centerX = width / 2;
  const centerY = height / 2;
  
  switch (bubbleType) {
    case 'speech':
      // 일반 대화 꼬리 (삼각형)
      return `
        M ${centerX - 15},${height - 2}
        L ${tailX},${tailY}
        L ${centerX + 15},${height - 2}
        Z
      `;
      
    case 'shout':
      // 외침 꼬리 (뾰족한 삼각형)
      return `
        M ${centerX - 10},${height}
        L ${tailX},${tailY}
        L ${centerX + 10},${height}
        Z
      `;
      
    case 'whisper':
      // 속삭임 꼬리 (점선 효과)
      return `
        M ${centerX},${height}
        L ${tailX},${tailY}
      `;
      
    default:
      return '';
  }
}

// 프리셋 색상 팔레트
export const BUBBLE_COLORS = {
  white: { background: '#FFFFFF', border: '#000000' },
  yellow: { background: '#FFF9C4', border: '#F57C00' },
  pink: { background: '#FCE4EC', border: '#C2185B' },
  blue: { background: '#E3F2FD', border: '#1976D2' },
  green: { background: '#E8F5E9', border: '#388E3C' },
  purple: { background: '#F3E5F5', border: '#7B1FA2' },
  gray: { background: '#F5F5F5', border: '#424242' },
  black: { background: '#000000', border: '#FFFFFF' }
};

// 효과 프리셋
export const BUBBLE_EFFECTS = {
  none: { name: '없음', className: '' },
  shadow: { name: '그림자', className: 'drop-shadow-lg' },
  glow: { name: '빛나기', className: 'shadow-glow' },
  shake: { name: '흔들림', className: 'animate-shake' },
  pulse: { name: '맥박', className: 'animate-pulse' }
};