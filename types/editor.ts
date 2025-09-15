export interface Layer {
  id: string;
  type: 'background' | 'bubble' | 'text' | 'effect';
  visible: boolean;
  locked: boolean;
  opacity: number;
  zIndex: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
}

export interface BackgroundLayer extends Layer {
  type: 'background';
  imageUrl: string;
}

export interface BubbleLayer extends Layer {
  type: 'bubble';
  bubbleType: 'speech' | 'thought' | 'shout' | 'whisper' | 'narration';
  style: 'round' | 'cloud' | 'jagged' | 'rectangle';
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  tailPosition?: { x: number; y: number };
}

export interface TextLayer extends Layer {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  color: string;
  lineHeight: number;
  letterSpacing: number;
}

export interface EffectLayer extends Layer {
  type: 'effect';
  effectType: 'speed-lines' | 'focus-lines' | 'sparkle' | 'impact';
  color: string;
  intensity: number;
}

export type EditorLayer = BackgroundLayer | BubbleLayer | TextLayer | EffectLayer;

export type CanvasRatio = '4:5' | '1:1';

export interface CanvasSize {
  ratio: CanvasRatio;
  width: number;
  height: number;
  label: string;
}

export const CANVAS_SIZES: Record<CanvasRatio, CanvasSize> = {
  '4:5': {
    ratio: '4:5',
    width: 800,
    height: 1000,
    label: '인스타그램 세로형 (4:5)'
  },
  '1:1': {
    ratio: '1:1',
    width: 800,
    height: 800,
    label: '인스타그램 정사각형 (1:1)'
  }
};

export interface EditorState {
  layers: EditorLayer[];
  selectedLayerId: string | null;
  canvasRatio: CanvasRatio;
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  pan: { x: number; y: number };
  isPlaying: boolean;
  history: EditorLayer[][];
  historyIndex: number;
}

export interface BubbleTemplate {
  id: string;
  name: string;
  type: BubbleLayer['bubbleType'];
  style: BubbleLayer['style'];
  preview: string;
  defaultSize: { width: number; height: number };
}

export interface EditorTool {
  id: string;
  name: string;
  icon: string;
  type: 'select' | 'bubble' | 'text' | 'effect' | 'hand';
  cursor?: string;
}