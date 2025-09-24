export interface CanvasElement {
  id: string;
  type: 'text' | 'bubble';
  content?: string; // 텍스트만 사용, 말풍선은 content 없음
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number; // 텍스트만 사용
  color?: string; // 텍스트만 사용
  bubbleStyle?: 'speech' | 'thought' | 'shout' | 'whisper';
  templateId?: string; // 말풍선 템플릿 ID
  fillColor?: string; // 말풍선 배경색
  strokeColor?: string; // 말풍선 테두리색
  strokeWidth?: number; // 말풍선 테두리 두께
  isHiddenWhileDragging?: boolean; // 드래그 중 캔버스 외부에서 숨김 처리
}

export interface WebtoonCut {
  id: string;
  prompt: string;
  imageUrl?: string;
  generationId?: string; // generation 테이블 참조 ID
  elements: CanvasElement[];
  isGenerating?: boolean;
}