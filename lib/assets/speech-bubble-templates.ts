export interface SpeechBubbleTemplate {
  id: string;
  name: string;
  category: 'speech' | 'thought' | 'exclamation' | 'scream';
  svgPath: string;
  description: string;
}

export const speechBubbleTemplates: SpeechBubbleTemplate[] = [
  {
    id: 'speech-1',
    name: '기본 말풍선',
    category: 'speech',
    svgPath: '/assets/speech-bubbles/speech-bubble-1.svg',
    description: '기본적인 원형 말풍선'
  },
  {
    id: 'speech-2',
    name: '사각 말풍선',
    category: 'speech',
    svgPath: '/assets/speech-bubbles/speech-bubble-2.svg',
    description: '사각형 모양의 말풍선'
  },
  {
    id: 'speech-3',
    name: '타원 말풍선',
    category: 'speech',
    svgPath: '/assets/speech-bubbles/speech-bubble-3.svg',
    description: '타원형 말풍선'
  },
  {
    id: 'thought-1',
    name: '생각 말풍선',
    category: 'thought',
    svgPath: '/assets/speech-bubbles/thought-bubble-1.svg',
    description: '구름 모양의 생각 말풍선'
  },
  {
    id: 'exclamation-1',
    name: '감탄 말풍선',
    category: 'exclamation',
    svgPath: '/assets/speech-bubbles/exclamation-bubble-1.svg',
    description: '뾰족한 감탄 말풍선'
  },
  {
    id: 'scream-1',
    name: '외침 말풍선',
    category: 'scream',
    svgPath: '/assets/speech-bubbles/scream-bubble-1.svg',
    description: '삐쭉삐쭉한 외침 말풍선'
  }
];

export const speechBubbleCategories = {
  speech: '일반 대화',
  thought: '생각/독백',
  exclamation: '감탄/놀라움',
  scream: '외침/소리침'
} as const;