"use client";

// 저작권 프리 말풍선 SVG 템플릿들
// 템플릿 타입 정의
interface BubbleTemplate {
  id: string;
  name: string;
  category: 'speech' | 'thought' | 'shout' | 'whisper';
  getSvg: (fillColor?: string, strokeColor?: string, strokeWidth?: number) => string;
}

export const BUBBLE_TEMPLATES: BubbleTemplate[] = [
  {
    id: 'speech-basic',
    name: '기본 말풍선',
    category: 'speech',
    getSvg: (fillColor = 'white', strokeColor = '#333', strokeWidth = 2) => `
      <svg viewBox="0 0 200 120" className="w-full h-full">
        <path
          d="M20 20 Q20 20 20 20 L180 20 Q180 20 180 40 L180 80 Q180 100 160 100 L60 100 L40 110 L50 100 L40 100 Q20 100 20 80 L20 40 Q20 20 20 20 Z"
          fill="${fillColor}"
          stroke="${strokeColor}"
          stroke-width="${strokeWidth}"
        />
      </svg>
    `
  },
  {
    id: 'speech-round',
    name: '둥근 말풍선',
    category: 'speech',
    getSvg: (fillColor = 'white', strokeColor = '#333', strokeWidth = 2) => `
      <svg viewBox="0 0 200 120" className="w-full h-full">
        <path
          d="M40 30 Q20 30 20 50 L20 70 Q20 90 40 90 L50 90 L35 105 L60 90 L160 90 Q180 90 180 70 L180 50 Q180 30 160 30 Z"
          fill="${fillColor}"
          stroke="${strokeColor}"
          stroke-width="${strokeWidth}"
        />
      </svg>
    `
  },
  {
    id: 'speech-oval',
    name: '타원 말풍선',
    category: 'speech',
    getSvg: (fillColor = 'white', strokeColor = '#333', strokeWidth = 2) => `
      <svg viewBox="0 0 200 120" className="w-full h-full">
        <ellipse cx="100" cy="45" rx="70" ry="30" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
        <path d="M50 70 L40 90 L65 75 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
      </svg>
    `
  },
  {
    id: 'speech-rectangle',
    name: '사각 말풍선',
    category: 'speech',
    getSvg: (fillColor = 'white', strokeColor = '#333', strokeWidth = 2) => `
      <svg viewBox="0 0 200 120" className="w-full h-full">
        <rect x="30" y="25" width="140" height="60" rx="5" ry="5" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
        <path d="M70 85 L85 100 L100 85 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
      </svg>
    `
  },
  {
    id: 'thought-cloud',
    name: '생각 구름',
    category: 'thought',
    getSvg: (fillColor = 'white', strokeColor = '#333', strokeWidth = 2) => `
      <svg viewBox="0 0 200 120" className="w-full h-full">
        <ellipse cx="100" cy="40" rx="60" ry="25" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
        <circle cx="70" cy="75" r="8" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
        <circle cx="55" cy="90" r="5" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
        <circle cx="45" cy="100" r="3" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
      </svg>
    `
  },
  {
    id: 'thought-cloud2',
    name: '구름 생각2',
    category: 'thought',
    getSvg: (fillColor = 'white', strokeColor = '#333', strokeWidth = 2) => `
      <svg viewBox="0 0 200 120" className="w-full h-full">
        <path d="M60 30 Q40 20 50 40 Q30 30 40 50 Q20 40 35 60 Q30 70 50 65 Q40 80 60 75 Q50 90 70 85 Q60 100 80 95 Q70 110 90 105 Q80 120 100 115 Q120 120 110 105 Q130 110 120 95 Q140 100 130 85 Q150 90 140 75 Q160 80 150 65 Q170 70 160 60 Q180 50 160 50 Q170 40 150 45 Q160 30 140 35 Q150 20 130 25 Q140 10 120 15 Q130 5 110 10 Q120 0 100 5 Q80 0 90 10 Q70 5 80 15 Q60 10 70 25 Q50 20 60 30 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
        <circle cx="85" cy="85" r="6" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
        <circle cx="70" cy="95" r="4" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
        <circle cx="60" cy="105" r="2" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
      </svg>
    `
  },
  {
    id: 'shout-burst',
    name: '외침 폭발',
    category: 'shout',
    getSvg: (fillColor = 'white', strokeColor = '#333', strokeWidth = 2) => `
      <svg viewBox="0 0 200 120" className="w-full h-full">
        <path d="M100 10 L110 35 L135 25 L115 50 L140 60 L115 70 L135 95 L110 85 L100 110 L90 85 L65 95 L85 70 L60 60 L85 50 L65 25 L90 35 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
        <path d="M80 100 L70 115 L90 110 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
      </svg>
    `
  },
  {
    id: 'shout-spiky',
    name: '가시 외침',
    category: 'shout',
    getSvg: (fillColor = 'white', strokeColor = '#333', strokeWidth = 2) => `
      <svg viewBox="0 0 200 120" className="w-full h-full">
        <path d="M50 30 L60 20 L70 35 L85 25 L90 40 L105 30 L110 45 L125 35 L130 50 L145 40 L150 55 L135 60 L150 70 L130 75 L145 85 L125 90 L135 100 L110 95 L120 105 L105 100 L95 110 L90 95 L75 105 L70 90 L55 100 L50 85 L35 95 L40 80 L25 85 L35 70 L20 75 L30 60 L15 65 L25 50 L20 45 L35 40 L25 30 L40 35 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
        <path d="M65 95 L55 110 L75 105 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
      </svg>
    `
  },
  {
    id: 'whisper-small',
    name: '속삭임',
    category: 'whisper',
    getSvg: (fillColor = 'white', strokeColor = '#333', strokeWidth = 2) => `
      <svg viewBox="0 0 200 120" className="w-full h-full">
        <ellipse cx="100" cy="50" rx="60" ry="25" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-dasharray="5,3"/>
        <circle cx="80" cy="85" r="3" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
        <circle cx="70" cy="95" r="2" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
      </svg>
    `
  },
  {
    id: 'whisper-dots',
    name: '점선 속삭임',
    category: 'whisper',
    getSvg: (fillColor = 'white', strokeColor = '#333', strokeWidth = 2) => `
      <svg viewBox="0 0 200 120" className="w-full h-full">
        <rect x="40" y="30" width="120" height="50" rx="15" ry="15" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-dasharray="8,4"/>
        <circle cx="70" cy="90" r="3" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
        <circle cx="60" cy="100" r="2" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
        <circle cx="50" cy="108" r="1" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
      </svg>
    `
  },
  {
    id: 'speech-heart',
    name: '하트 말풍선',
    category: 'speech',
    getSvg: (fillColor = 'white', strokeColor = '#333', strokeWidth = 2) => `
      <svg viewBox="0 0 200 120" className="w-full h-full">
        <path d="M100 90 C80 70 50 50 50 30 Q50 15 65 15 Q80 15 100 30 Q120 15 135 15 Q150 15 150 30 C150 50 120 70 100 90 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
        <path d="M90 90 L85 105 L105 95 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
      </svg>
    `
  },
  {
    id: 'speech-jagged',
    name: '들쭉날쭉 말풍선',
    category: 'speech',
    getSvg: (fillColor = 'white', strokeColor = '#333', strokeWidth = 2) => `
      <svg viewBox="0 0 200 120" className="w-full h-full">
        <path d="M30 40 L35 35 L45 45 L50 35 L60 50 L70 40 L80 55 L90 45 L100 60 L110 50 L120 65 L130 55 L140 70 L150 60 L160 75 L170 65 L170 80 L165 85 L155 75 L150 85 L140 70 L130 80 L120 65 L110 75 L100 60 L90 70 L80 55 L70 65 L60 50 L50 60 L45 45 L40 55 L30 40 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
        <path d="M80 75 L70 95 L90 85 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
      </svg>
    `
  }
];

export const BUBBLE_CATEGORIES = [
  { id: 'all', name: '전체', emoji: '🎨' },
  { id: 'speech', name: '일반 말풍선', emoji: '💬' },
  { id: 'thought', name: '생각 구름', emoji: '💭' },
  { id: 'shout', name: '외침', emoji: '💥' },
  { id: 'whisper', name: '속삭임', emoji: '🔉' }
];