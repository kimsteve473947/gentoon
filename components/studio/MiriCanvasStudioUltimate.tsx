"use client";

import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { MentionTextArea } from "./MentionTextArea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Square, 
  RectangleVertical,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Share2,
  Undo,
  Redo,
  Plus,
  Trash2,
  MessageSquare,
  Type,
  User,
  UserPlus,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Move,
  X,
  Palette,
  ChevronUp,
  ChevronDown,
  Copy,
  MoreHorizontal,
  RotateCcw,
  RotateCw,
  Edit3,
  Save,
  Check,
  Zap,
  Lock,
  Upload,
  Bold,
  Italic,
  Underline,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Heart,
  ChevronDown,
  ArrowUpDown,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BUBBLE_TEMPLATES } from './BubbleTemplates';
import { BubbleTemplateRenderer } from './BubbleTemplateRenderer';
import { OptimizedImage } from './OptimizedImage';
import { OptimizedCanvasImage } from './OptimizedCanvasImage';
import { VirtualizedTemplateList } from './VirtualizedTemplateList';
import { CharacterAndElementSelector } from './CharacterAndElementSelector';
import { AddCharacterModal } from './AddCharacterModal';
import { AIScriptGenerator } from './AIScriptGenerator';
import { useDebounce } from '@/hooks/useDebounce';
import { useHistory, useBatchHistory } from '@/hooks/useHistory';
import { enhancePromptWithElements, getElementImageUrls } from '@/lib/ai/element-manager';
import { calculateRotatedResize } from './RotationAwareResize';
import { createBrowserClient } from '@supabase/ssr';
import { FontSelector } from '@/components/studio/FontSelector';
import { STUDIO_FONTS, NOONNU_FONTS } from '@/lib/fonts/noonnu-fonts';
import { FontVariant } from '@/hooks/useFonts';

// Google Fonts CSS 로드용
const GOOGLE_FONTS_CSS = [
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&display=swap'
].join('|');

// 캔버스 크기 정의 (최적화된 치수)
const CANVAS_SIZES = {
  '4:5': { width: 320, height: 398, actualWidth: 896, actualHeight: 1115, label: '4:5' },
  '1:1': { width: 320, height: 320, actualWidth: 1024, actualHeight: 1024, label: '1:1' }
};

type CanvasRatio = '4:5' | '1:1';

// 줌 레벨 정의 - 매우 세밀한 2-3% 단위
const ZOOM_LEVELS = [
  25, 28, 31, 34, 37, 40, 43, 46, 49, 52, 55, 58, 61, 64, 67, 70,
  73, 76, 79, 82, 85, 88, 91, 94, 97, 100, 103, 106, 109, 112, 
  115, 118, 121, 124, 127, 130, 133, 136, 139, 142, 145, 148, 
  151, 154, 157, 160, 163, 166, 169, 172, 175, 178, 181, 184, 
  187, 190, 193, 196, 200
];

interface CanvasElement {
  id: string;
  type: 'text' | 'bubble' | 'image';
  content?: string; // 텍스트만 사용, 말풍선은 content 없음
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number; // 텍스트만 사용
  fontFamily?: string; // 텍스트만 사용
  fontWeight?: number; // 텍스트 글꼴 두께 (100-900)
  color?: string; // 텍스트만 사용
  bubbleStyle?: 'speech' | 'thought' | 'shout' | 'whisper';
  templateId?: string; // 말풍선 템플릿 ID
  fillColor?: string; // 말풍선 배경색
  strokeColor?: string; // 말풍선 테두리색
  strokeWidth?: number; // 말풍선 테두리 두께
  isHiddenWhileDragging?: boolean; // 드래그 중 캔버스 외부에서 숨김 처리
  rotation?: number; // 회전 각도 (도 단위)
  imageUrl?: string; // 이미지 URL
  imageName?: string; // 이미지 파일명
  groupId?: string; // 그룹 ID - 같은 그룹의 요소들은 함께 움직임
  isGrouped?: boolean; // 그룹화 여부
}

// 멀티 선택을 위한 선택 영역 인터페이스
interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  isActive: boolean;
}

interface WebtoonCut {
  id: string;
  prompt: string;
  imageUrl?: string;
  generationId?: string; // generation 테이블 참조 ID
  elements: CanvasElement[];
  // 🚫 isGenerating 제거 - 별도 상태로 관리
}

// 히스토리 상태 타입
interface StudioHistoryState {
  cuts: WebtoonCut[];
  selectedCutId: string;
  selectedElementId: string | null;
  selectedElementIds: string[]; // 멀티 선택을 위한 배열
  canvasRatio: CanvasRatio;
}

interface MiriCanvasStudioUltimateProps {
  projectId?: string;
  initialData?: any;
  onSave?: (panels: any[], title?: string) => Promise<void>;
}

export function MiriCanvasStudioUltimate({ projectId, initialData, onSave }: MiriCanvasStudioUltimateProps) {
  const [zoom, setZoom] = useState<number>(100);
  const [panelsLoaded, setPanelsLoaded] = useState(false);
  
  // Supabase 클라이언트
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  // 초기 상태 준비
  const getInitialState = (): StudioHistoryState => {
    // localStorage 정리 (용량 초과 방지)
    try {
      localStorage.removeItem('instatoon_generated_images');
      localStorage.removeItem('instatoon_projects');
      localStorage.removeItem('instatoon_characters');
    } catch (e) {
    }
    
    // 기본값만 반환 (패널 데이터는 useEffect에서 로드)
    return {
      cuts: [
        { id: '1', prompt: '', elements: [] },
        { id: '2', prompt: '', elements: [] }
      ],
      selectedCutId: '1',
      selectedElementId: null,
      selectedElementIds: [],
      canvasRatio: '4:5' as CanvasRatio
    };
  };
  
  // 히스토리 관리 (키보드 단축키는 나중에 동적으로 제어)
  const {
    state: historyState,
    setState: pushHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    set: updateStateWithoutHistory,
    setStateDebounced: pushHistoryDebounced
  } = useBatchHistory<StudioHistoryState>(getInitialState(), { 
    limit: 30
  });
  
  // 히스토리 상태에서 각 값 추출
  const { cuts: historyCuts, selectedCutId, selectedElementId, selectedElementIds, canvasRatio } = historyState;

  
  // 🎯 드래그 데이터 (useRef로 안정적 관리)
  const dragDataRef = useRef<{
    elementPosition: {
      elementId: string;
      x: number;
      y: number;
      cutId: string;
    } | null;
    startState: WebtoonCut[] | null;
    isCommitted: boolean;
  }>({
    elementPosition: null,
    startState: null,
    isCommitted: false
  });
  
  // 🎯 드래그 중 임시 위치 상태 (렌더링용)
  const [dragElementPosition, setDragElementPosition] = useState<{
    elementId: string;
    x: number;
    y: number;
    cutId: string;
  } | null>(null);
  const [dragStartState, setDragStartState] = useState<WebtoonCut[] | null>(null);
  
  // 드래그 및 리사이즈 상태 - cuts 변수보다 먼저 선언
  const [isDraggingElement, setIsDraggingElement] = useState(false);
  const [draggedElement, setDraggedElement] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  
  // 회전 상태
  const [isRotating, setIsRotating] = useState(false);
  const [rotationStartAngle, setRotationStartAngle] = useState(0);
  
  // UI 상태
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [expandedFonts, setExpandedFonts] = useState<Set<string>>(new Set());
  const [favoriteFonts, setFavoriteFonts] = useState<Set<string>>(new Set());

  // 폰트 변경 핸들러 (새로운 FontSelector용)
  const handleFontChange = useCallback((fontFamily: string, fontWeight: number) => {
    if (selectedElementId) {
      updateElementProperty(selectedElementId, {
        fontFamily,
        fontWeight: fontWeight.toString(), // Konva는 문자열로 받아야 함
        fontStyle: fontWeight >= 700 ? 'bold' : 'normal'
      });
    }
  }, [selectedElementId]);
  
  // 멘션용 캐릭터와 요소 데이터
  const [mentionCharacters, setMentionCharacters] = useState<any[]>([]);
  const [mentionElements, setMentionElements] = useState<any[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  
  // 업로드된 이미지 상태
  const [uploadedImages, setUploadedImages] = useState<Array<{
    id: string;
    name: string;
    url: string;
    type: string;
  }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  
  // 오른쪽 패널 탭 상태
  const [rightPanelTab, setRightPanelTab] = useState<'single' | 'batch'>('single');
  
  // 정렬 상태 (2열 그리드 유지)
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest');
  
  // 삭제 확인 다이얼로그 상태
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, imageId: string, imageName: string}>({
    isOpen: false,
    imageId: '',
    imageName: ''
  });
  
  // 배치 생성 상태
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [pendingScript, setPendingScript] = useState<ScriptPanel[]>([]);
  
  // AI 대본 상태 관리 (탭 이동시에도 유지)
  const [aiGeneratedScript, setAiGeneratedScript] = useState<ScriptPanel[]>([]);
  const [aiEditedScript, setAiEditedScript] = useState<ScriptPanel[]>([]);
  
  
  // 멀티 선택을 위한 상태
  const [selectionBox, setSelectionBox] = useState<SelectionBox>({ 
    startX: 0, startY: 0, endX: 0, endY: 0, isActive: false 
  });
  const [isSelecting, setIsSelecting] = useState(false);
  const [clipboard, setClipboard] = useState<CanvasElement[]>([]);
  
  // 스마트 가이드라인을 위한 상태
  const [alignmentGuides, setAlignmentGuides] = useState<{
    horizontal: number[];
    vertical: number[];
    showGuides: boolean;
  }>({ horizontal: [], vertical: [], showGuides: false });
  
  // 드래그 중 자연스러운 패널 전환을 위한 상태 (UI 없이 내부적으로만 사용)
  const [dragOverCutId, setDragOverCutId] = useState<string | null>(null);
  
  // 캔버스 ref 관리
  const canvasRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  // 🎯 실제 사용할 cuts (항상 원본 데이터 사용)
  const cuts = historyCuts;

  // 🎨 웹폰트 동적 로드 (Google Fonts + Noonnu Fonts)
  useEffect(() => {
    const loadedFonts = new Set<string>();
    
    // Google Fonts 로드
    if (!loadedFonts.has('google-fonts')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = GOOGLE_FONTS_CSS;
      document.head.appendChild(link);
      loadedFonts.add('google-fonts');
    }
    
    // Noonnu Fonts CSS 로드
    NOONNU_FONTS.forEach(font => {
      if (!loadedFonts.has(font.id)) {
        const style = document.createElement('style');
        style.textContent = font.cssCode;
        document.head.appendChild(style);
        loadedFonts.add(font.id);
      }
    });

    // 폰트 로딩 완료를 위한 대기
    return () => {
      // cleanup은 필요 없음 (폰트는 페이지 전체에서 사용 가능해야 함)
    };
  }, []);

  // 🎯 외부 클릭 시 폰트 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showFontDropdown) {
        const target = event.target as Element;
        if (!target.closest('[data-font-dropdown]')) {
          setShowFontDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFontDropdown]);

  // 💗 찜한 폰트 localStorage에서 로드
  useEffect(() => {
    const savedFavorites = localStorage.getItem('gentoon-favorite-fonts');
    if (savedFavorites) {
      try {
        const favorites = JSON.parse(savedFavorites);
        setFavoriteFonts(new Set(favorites));
      } catch (error) {
        console.error('찜한 폰트 로드 실패:', error);
      }
    }
  }, []);

  // 💗 찜한 폰트 localStorage에 저장
  const toggleFavoriteFont = useCallback((fontId: string) => {
    setFavoriteFonts(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(fontId)) {
        newFavorites.delete(fontId);
      } else {
        newFavorites.add(fontId);
      }
      
      // localStorage에 저장
      localStorage.setItem('gentoon-favorite-fonts', JSON.stringify([...newFavorites]));
      return newFavorites;
    });
  }, []);

  // 🔽 폰트 확장/축소 토글
  const toggleFontExpanded = useCallback((fontId: string) => {
    setExpandedFonts(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(fontId)) {
        newExpanded.delete(fontId);
      } else {
        newExpanded.add(fontId);
      }
      return newExpanded;
    });
  }, []);

  // ✏️ 인라인 텍스트 편집 함수들
  const startTextEditing = useCallback((elementId: string, currentText: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    setEditingTextId(elementId);
    setEditingText(currentText || '');
  }, []);

  // 범용 요소 속성 업데이트 함수
  const updateElementProperty = useCallback((elementId: string, properties: Partial<CanvasElement>) => {
    pushHistory(prev => ({
      ...prev,
      cuts: prev.cuts.map(cut => {
        const hasElement = cut.elements.some(el => el.id === elementId);
        if (!hasElement) return cut;
        
        return {
          ...cut,
          elements: cut.elements.map(el => 
            el.id === elementId ? { ...el, ...properties } : el
          )
        };
      })
    }));
  }, [pushHistory]);

  // 색상 변경 시 디바운싱을 적용한 업데이트 함수
  const updateElementPropertyDebounced = useCallback((elementId: string, properties: Partial<CanvasElement>) => {
    // 즉시 UI 업데이트 (히스토리에는 추가하지 않음)
    updateStateWithoutHistory(prev => ({
      ...prev,
      cuts: prev.cuts.map(cut => {
        const hasElement = cut.elements.some(el => el.id === elementId);
        if (!hasElement) return cut;
        
        return {
          ...cut,
          elements: cut.elements.map(el => 
            el.id === elementId ? { ...el, ...properties } : el
          )
        };
      })
    }));

    // 디바운싱된 히스토리 추가
    pushHistoryDebounced(prev => ({
      ...prev,
      cuts: prev.cuts.map(cut => {
        const hasElement = cut.elements.some(el => el.id === elementId);
        if (!hasElement) return cut;
        
        return {
          ...cut,
          elements: cut.elements.map(el => 
            el.id === elementId ? { ...el, ...properties } : el
          )
        };
      })
    }));
  }, [updateStateWithoutHistory, pushHistoryDebounced]);

  const finishTextEditing = useCallback(() => {
    if (editingTextId && editingText !== null) {
      updateElementProperty(editingTextId, { content: editingText });
    }
    setEditingTextId(null);
    setEditingText('');
  }, [editingTextId, editingText, updateElementProperty]);

  const cancelTextEditing = useCallback(() => {
    setEditingTextId(null);
    setEditingText('');
  }, []);

  // ⌨️ 키보드 이벤트 처리 (인라인 편집용)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (editingTextId) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          finishTextEditing();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          cancelTextEditing();
        }
        // Shift+Enter는 새 줄 추가 (기본 동작 허용)
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingTextId, finishTextEditing, cancelTextEditing]);

  // 🎯 미리캔버스 스타일: 스마트 패널 이동 드래그 시스템
  // 🎯 드래그 중 임시 위치 업데이트 함수 (실제 데이터 변경 없음)
  const updateDragPosition = useCallback((
    elementId: string, 
    targetX: number, 
    targetY: number, 
    targetCutId: string
  ) => {
    console.log('🎯 updateDragPosition 호출:', { elementId, targetX, targetY, targetCutId });
    
    // 드래그 중 임시 위치만 업데이트 (부드러운 시각적 피드백)
    setDragElementPosition({
      elementId,
      x: targetX,
      y: targetY,
      cutId: targetCutId
    });
  }, []);

  // 🎯 드래그 완료 시 실제 데이터 변경 함수
  const commitDragChanges = useCallback((
    elementId: string, 
    targetX: number, 
    targetY: number, 
    targetCutId: string,
    originalCutId: string
  ) => {
    console.log('🎯 commitDragChanges 호출:', { elementId, targetX, targetY, targetCutId, originalCutId });
    
    // 패널 선택 변경
    if (targetCutId !== selectedCutId) {
      console.log('🚀 패널 간 이동 완료:', { from: selectedCutId, to: targetCutId });
    }

    // 실제 요소 이동 처리
    const sourceElement = cuts.find(cut => 
      cut.elements.some(el => el.id === elementId)
    )?.elements.find(el => el.id === elementId);

    if (!sourceElement) return;

    // 🔗 그룹화된 요소인 경우, 같은 그룹의 모든 요소들을 함께 이동
    const sourceCut = cuts.find(cut => cut.elements.some(el => el.id === elementId));
    let elementsToMove = [sourceElement];
    
    if (sourceElement.isGrouped && sourceElement.groupId && sourceCut) {
      // 같은 그룹의 모든 요소들 찾기
      elementsToMove = sourceCut.elements.filter(el => el.groupId === sourceElement.groupId);
      
      // 드래그된 요소와 다른 요소들 간의 상대적 거리 계산
      const deltaX = targetX - sourceElement.x;
      const deltaY = targetY - sourceElement.y;
      
      console.log(`🔗 그룹 드래그: ${elementsToMove.length}개 요소를 함께 이동합니다.`);
    }

    if (targetCutId !== originalCutId) {
      // 🚀 패널 간 이동 (실제 데이터 변경) - 그룹 지원
      const elementsToMoveIds = elementsToMove.map(el => el.id);
      const deltaX = targetX - sourceElement.x;
      const deltaY = targetY - sourceElement.y;
      
      const newCuts = cuts.map(cut => {
        if (cut.elements.some(el => elementsToMoveIds.includes(el.id))) {
          // 원본 패널에서 그룹 전체 제거
          return {
            ...cut,
            elements: cut.elements.filter(el => !elementsToMoveIds.includes(el.id))
          };
        } else if (cut.id === targetCutId) {
          // 목표 패널에 그룹 전체 추가
          const movedElements = elementsToMove.map(el => ({
            ...el,
            x: el.id === elementId ? targetX : el.x + deltaX,
            y: el.id === elementId ? targetY : el.y + deltaY
          }));
          
          return {
            ...cut,
            elements: [...cut.elements, ...movedElements]
          };
        }
        return cut;
      });

      pushHistory(prev => ({
        ...prev,
        cuts: newCuts,
        selectedCutId: targetCutId
      }));
    } else {
      // 🎯 동일 패널 내 이동 - 그룹 지원
      const deltaX = targetX - sourceElement.x;
      const deltaY = targetY - sourceElement.y;
      const elementsToMoveIds = elementsToMove.map(el => el.id);
      
      const newCuts = cuts.map(cut => {
        if (cut.id === targetCutId) {
          return {
            ...cut,
            elements: cut.elements.map(el => {
              if (elementsToMoveIds.includes(el.id)) {
                return {
                  ...el,
                  x: el.id === elementId ? targetX : el.x + deltaX,
                  y: el.id === elementId ? targetY : el.y + deltaY
                };
              }
              return el;
            })
          };
        }
        return cut;
      });

      pushHistory(prev => ({
        ...prev,
        cuts: newCuts
      }));
    }
  }, [cuts, selectedCutId, pushHistory]);

  // 🎯 요소 렌더링 위치 계산 (드래그 중 실시간 위치 반영)
  const getElementRenderPosition = useCallback((element: CanvasElement, cutId: string) => {
    // 🎯 미리캔버스 스타일: 드래그 중인 요소는 해당 패널에서만 드래그 위치 표시
    if (isDraggingElement && dragElementPosition && element.id === dragElementPosition.elementId) {
      // 드래그 중인 요소가 현재 패널에 속하는 경우에만 드래그 위치 표시
      if (cutId === dragElementPosition.cutId) {
        return {
          x: dragElementPosition.x,
          y: dragElementPosition.y
        };
      }
      // 다른 패널에서는 숨김 (화면 밖으로 이동)
      return {
        x: -9999,
        y: -9999
      };
    }
    
    // 일반 요소는 원래 위치
    return {
      x: element.x,
      y: element.y
    };
  }, [isDraggingElement, dragElementPosition]);
  
  
  // 📝 히스토리 업데이트 헬퍼 함수 (작업스페이스 편집만 기록) - 성능 최적화
  const updateHistory = useCallback((updates: Partial<StudioHistoryState>, clearTempCuts: boolean = true) => {
    // 불필요한 히스토리 저장 방지
    if (Object.keys(updates).length === 0) return;
    
    // 드래그/리사이즈 중에는 히스토리 기록 안 함 (성능 최적화)
    if (isDraggingElement || isResizing) {
      return;
    }
    
    pushHistory(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
    // 임시 상태는 dragElementPosition으로 관리 (tempCuts 제거됨)
  }, [pushHistory, isDraggingElement, isResizing]);

  // 📝 상태 업데이트 (히스토리에 기록하지 않음)
  const updateStateOnly = (updates: Partial<StudioHistoryState>) => {
    updateStateWithoutHistory(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  };
  
  // 드래그/리사이즈 완료 시 히스토리 커밋하는 함수 - 성능 최적화
  const commitHistoryChange = useCallback((newCuts: WebtoonCut[]) => {
    // 🔄 드래그 시작 상태와 비교하여 실제 변경사항이 있는지 확인
    const compareBase = dragStartState || historyCuts;
    const hasChanged = JSON.stringify(newCuts) !== JSON.stringify(compareBase);
    if (!hasChanged) return;
    
    updateHistory({ cuts: newCuts }, true);
  }, [dragStartState, historyCuts, updateHistory]);

  // 🎯 setCuts 함수 - 드래그 중에는 실제 데이터 변경 방지
  const setCuts = useCallback((newCuts: WebtoonCut[] | ((prev: WebtoonCut[]) => WebtoonCut[])) => {
    const updated = typeof newCuts === 'function' ? newCuts(historyCuts) : newCuts;
    
    // 🚫 드래그 중에는 실제 데이터 변경 금지 (중요!)
    if (isDraggingElement) {
      console.warn('🚫 드래그 중에는 setCuts 호출이 무시됩니다');
      return;
    }
    
    // 즉시 히스토리 커밋
    updateHistory({ cuts: updated }, true);
  }, [historyCuts, isDraggingElement, updateHistory]);
  
  
  // 선택 상태 변경 (히스토리에 기록하지 않음)
  const setSelectedCutId = (id: string) => {
    updateStateWithoutHistory(prev => ({ ...prev, selectedCutId: id }));
  };
  
  const setSelectedElementId = (id: string | null) => {
    updateStateWithoutHistory(prev => ({ ...prev, selectedElementId: id }));
  };
  
  // 멀티 선택 상태 변경
  const setSelectedElementIds = (ids: string[]) => {
    updateStateWithoutHistory(prev => ({ ...prev, selectedElementIds: ids }));
  };
  
  // 캔버스 비율 변경 (이것은 히스토리에 기록)
  const setCanvasRatio = (ratio: CanvasRatio) => {
    updateHistory({ canvasRatio: ratio });
  };
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'bubble' | 'text' | 'ai-character' | 'upload'>('bubble');
  const [bubbleText, setBubbleText] = useState('');
  const [textContent, setTextContent] = useState('');
  
  // 🔥 이미지 생성 중 상태 (프로젝트별로 격리된 상태)
  const [generatingCutIds, setGeneratingCutIds] = useState<Set<string>>(new Set());
  
  // 🔄 실시간 패널 상태 동기화를 위한 폴링
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  
  
  // AI 캐릭터 생성 관련 상태
  const [characterDescription, setCharacterDescription] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [generatedCharacterUrl, setGeneratedCharacterUrl] = useState<string | null>(null);
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);
  const [isAddingCharacterToDB, setIsAddingCharacterToDB] = useState(false);
  
  
  // 🎯 드래그 상태 초기화 헬퍼
  const resetDragState = useCallback(() => {
    // useRef 데이터 초기화
    dragDataRef.current = {
      elementPosition: null,
      startState: null,
      isCommitted: false
    };
    
    // React 상태 초기화
    setDragElementPosition(null);
    setDragStartState(null);
    setIsDraggingElement(false);
    setDraggedElement(null);
    setIsResizing(false);
    setResizeHandle(null);
    setDragOverCutId(null);
    setAlignmentGuides({ horizontal: [], vertical: [], showGuides: false });
  }, []);

  // 드래그 취소 (원래 상태로 복원)
  const cancelDrag = useCallback(() => {
    if (dragStartState) {
      updateStateWithoutHistory(prev => ({ ...prev, cuts: dragStartState }));
    }
    resetDragState();
  }, [dragStartState, updateStateWithoutHistory, resetDragState]);

  // 🎯 드래그 커밋 (useRef 기반 안정적 처리)
  const commitDrag = useCallback(() => {
    const dragData = dragDataRef.current;
    
    // 🚫 중복 호출 방지
    if (dragData.isCommitted || !dragData.elementPosition || !dragData.startState) {
      return;
    }
    
    // 🔒 커밋 플래그 설정 (중복 방지)
    dragData.isCommitted = true;
    
    const { elementPosition, startState } = dragData;
    let finalCuts = [...historyCuts];
    
    // 🎯 원본 요소 찾기
    const originalCut = startState.find(cut => 
      cut.elements.some(el => el.id === elementPosition.elementId)
    );
    const originalElement = originalCut?.elements.find(el => el.id === elementPosition.elementId);
    
    if (originalElement && originalCut) {
      if (elementPosition.cutId !== originalCut.id) {
        // 패널 간 이동
        finalCuts = finalCuts.map(cut => {
          if (cut.id === originalCut.id) {
            return {
              ...cut,
              elements: cut.elements.filter(el => el.id !== elementPosition.elementId)
            };
          } else if (cut.id === elementPosition.cutId) {
            const alreadyExists = cut.elements.some(el => el.id === elementPosition.elementId);
            if (!alreadyExists) {
              return {
                ...cut,
                elements: [...cut.elements, {
                  ...originalElement,
                  x: elementPosition.x,
                  y: elementPosition.y
                }]
              };
            }
          }
          return cut;
        });
      } else {
        // 동일 캔버스 내 이동
        finalCuts = finalCuts.map(cut => {
          if (cut.id === elementPosition.cutId) {
            return {
              ...cut,
              elements: cut.elements.map(el => 
                el.id === elementPosition.elementId
                  ? { ...el, x: elementPosition.x, y: elementPosition.y }
                  : el
              )
            };
          }
          return cut;
        });
      }
      
      // 히스토리 업데이트
      commitHistoryChange(finalCuts);
      
      // 🎯 패널 간 이동이 완료된 경우에만 캔버스 선택 변경 (부드러운 UX)
      if (elementPosition.cutId !== originalCut.id) {
        setSelectedCutId(elementPosition.cutId);
      }
    }
    
    // 상태 초기화
    resetDragState();
  }, [historyCuts, commitHistoryChange, resetDragState]);

  // 키보드 단축키 처리 (ESC, Undo/Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC로 드래그/리사이즈 취소
      if (e.key === 'Escape' && (isDraggingElement || isResizing)) {
        cancelDrag();
        return;
      }
      
      // 🚫 드래그/리사이즈 중에는 undo/redo 비활성화
      if (isDraggingElement || isResizing) {
        return;
      }
      
      // Ctrl+Z or Cmd+Z (Undo)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl+Y or Cmd+Shift+Z (Redo)
      else if ((e.ctrlKey && e.key === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        redo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDraggingElement, isResizing, cancelDrag, undo, redo]);

  // 🚫 위험한 useEffect 제거: historyCuts 변경 시 드래그 상태를 강제 초기화하면 
  // commitDrag에서 데이터가 사라져서 위치가 되돌아가는 문제 발생

  const [isDraggingBubble, setIsDraggingBubble] = useState(false);
  const [draggedBubbleId, setDraggedBubbleId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // 수정 모달 상태
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCutId, setEditingCutId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  
  // 저장 유도 모달
  const [savePromptModalOpen, setSavePromptModalOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  
  // 저장 성공 알림
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  
  // 토큰 업그레이드 모달
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  
  // 캐릭터 상태
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [characters, setCharacters] = useState<any[]>([]); // 전체 캐릭터 정보
  const [selectedElements, setSelectedElements] = useState<any[]>([]);
  
  // 🎭 패널별 캐릭터 매핑 상태 (AI 대본 기반)
  const [panelCharacterMap, setPanelCharacterMap] = useState<Map<number, string[]>>(new Map());
  
  // ✨ 요소 상태는 위에서 이미 선언됨
  
  // 🎭 캐릭터 이름으로 ID 찾기 함수
  const findCharacterIdByName = useCallback((characterName: string, availableCharacters: any[]): string | null => {
    if (!characterName || !availableCharacters.length) {
      console.log('🔍 findCharacterIdByName: 빈 입력값 또는 캐릭터 없음');
      return null;
    }
    
    const normalizedName = characterName.trim().toLowerCase();
    console.log(`🔍 캐릭터 검색: "${characterName}" → "${normalizedName}"`);
    console.log('🔍 사용 가능한 캐릭터 목록:', availableCharacters.map(char => ({ id: char.id, name: char.name })));
    
    // 1. 정확한 이름 매치
    let match = availableCharacters.find(char => 
      char.name?.toLowerCase() === normalizedName
    );
    
    if (match) {
      console.log(`✅ 정확한 매치 발견: "${characterName}" → ${match.id} (${match.name})`);
      return match.id;
    }
    
    // 2. 부분 매치 (포함 관계)
    match = availableCharacters.find(char => 
      char.name?.toLowerCase().includes(normalizedName) ||
      normalizedName.includes(char.name?.toLowerCase())
    );
    
    if (match) {
      console.log(`✅ 부분 매치 발견: "${characterName}" → ${match.id} (${match.name})`);
      return match.id;
    }
    
    // 3. 한글 조사 제거 후 매치
    const nameWithoutParticles = normalizedName
      .replace(/[이가는을를과와에게에서]$/g, '') // 조사 제거
      .replace(/[님씨아야]$/g, ''); // 호칭 제거
    
    console.log(`🔍 조사 제거 후 검색: "${normalizedName}" → "${nameWithoutParticles}"`);
    
    match = availableCharacters.find(char => 
      char.name?.toLowerCase() === nameWithoutParticles ||
      char.name?.toLowerCase().includes(nameWithoutParticles)
    );
    
    if (match) {
      console.log(`✅ 조사 제거 후 매치 발견: "${characterName}" → ${match.id} (${match.name})`);
      return match.id;
    }
    
    console.warn(`⚠️ 캐릭터 "${characterName}"을 찾을 수 없음`);
    return null;
  }, []);
  
  // 🎯 AI 대본 기반 패널별 캐릭터 자동 매핑
  const mapPanelCharacters = useCallback((scriptPanels: any[], availableCharacters: any[]) => {
    console.log('🔄 AI 대본 기반 캐릭터 매핑 시작:', { scriptPanels, availableCharacters });
    
    const newPanelCharacterMap = new Map<number, string[]>();
    
    scriptPanels.forEach((panel, index) => {
      const panelOrder = index; // 0-indexed
      const characterNames = panel.characters || [];
      const mappedCharacterIds: string[] = [];
      
      console.log(`📋 Panel ${panelOrder + 1}: 스크립트 캐릭터 [${characterNames.join(', ')}]`);
      
      characterNames.forEach((characterName: string) => {
        const characterId = findCharacterIdByName(characterName, availableCharacters);
        if (characterId) {
          mappedCharacterIds.push(characterId);
          console.log(`✅ "${characterName}" → ${characterId}`);
        } else {
          console.warn(`⚠️ 캐릭터 "${characterName}"을 찾을 수 없음`);
        }
      });
      
      newPanelCharacterMap.set(panelOrder, mappedCharacterIds);
      console.log(`🎭 Panel ${panelOrder + 1} 최종 매핑:`, mappedCharacterIds);
    });
    
    setPanelCharacterMap(newPanelCharacterMap);
    console.log('✅ 패널별 캐릭터 매핑 완료:', newPanelCharacterMap);
    
    return newPanelCharacterMap;
  }, [findCharacterIdByName]);
  
  // 🔄 현재 패널 변경시 해당 패널의 캐릭터로 자동 선택
  const updateCharactersForCurrentPanel = useCallback((currentPanelIndex: number) => {
    const panelCharacters = panelCharacterMap.get(currentPanelIndex);
    
    if (panelCharacters && panelCharacters.length > 0) {
      console.log(`🎯 Panel ${currentPanelIndex + 1}로 전환: 캐릭터 자동 선택 [${panelCharacters.length}개]`);
      setSelectedCharacters(panelCharacters);
    } else {
      console.log(`📋 Panel ${currentPanelIndex + 1}: 매핑된 캐릭터 없음, 기존 선택 유지`);
      // 매핑된 캐릭터가 없으면 기존 선택 유지 (수동 선택 상황)
    }
  }, [panelCharacterMap]);
  
  // 🎪 현재 활성 패널 변경 감지하여 캐릭터 자동 선택
  useEffect(() => {
    if (panelCharacterMap.size > 0) {
      const currentCutIndex = cuts.findIndex(cut => cut.id === selectedCutId);
      if (currentCutIndex !== -1) {
        updateCharactersForCurrentPanel(currentCutIndex);
      }
    }
  }, [selectedCutId, panelCharacterMap, updateCharactersForCurrentPanel, cuts]);
  
  // 🎭 캐릭터 데이터 로딩
  useEffect(() => {
    const loadCharacters = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: charactersData } = await supabase
            .from('character')
            .select('id, name, description, thumbnailUrl, squareRatioUrl, portraitRatioUrl')
            .eq('userId', user.id);
          
          if (charactersData) {
            setCharacters(charactersData);
            console.log('🎭 캐릭터 데이터 로딩 완료:', charactersData.length, '개');
          }
        }
      } catch (error) {
        console.error('❌ 캐릭터 로딩 실패:', error);
      }
    };

    loadCharacters();
  }, [supabase]);

  // 디버깅용 로그
  useEffect(() => {
  }, [selectedCharacters]);

  // AI 대본 생성 완료 시 처리 함수
  const handleScriptGenerated = useCallback((panels: ScriptPanel[]) => {
    console.log('🎬 handleScriptGenerated 호출됨!');
    console.log('🎬 AI 대본 생성 완료, 캐릭터 자동 매핑 시작:', panels);
    
    // 기존 컷들을 새 대본으로 교체
    const newCuts: WebtoonCut[] = panels.map((panel, index) => ({
      id: String(index + 1),
      prompt: panel.prompt,
      elements: [],
      imageUrl: undefined,
      generationId: undefined
      // 🚫 isGenerating 제거 - 별도 상태로 관리
    }));

    updateHistory({ 
      cuts: newCuts,
      selectedCutId: newCuts.length > 0 ? newCuts[0].id : '1'
    });
    
    // 🎭 AI 대본 기반 캐릭터 자동 매핑 실행
    const loadCharactersAndMap = async () => {
      try {
        console.log('📚 캐릭터 데이터 로딩 중...');
        const response = await fetch('/api/uploads');
        const uploadData = await response.json();
        
        if (uploadData.success) {
          const availableCharacters = uploadData.uploads || [];
          console.log('✅ 사용 가능한 캐릭터:', availableCharacters.length, '개');
          console.log('🔍 Panels data for mapping:', panels);
          
          // 패널별 캐릭터 매핑 실행
          const characterMap = mapPanelCharacters(panels, availableCharacters);
          
          console.log('🗺️ Generated character map:', characterMap);
          
          // 약간의 지연 후 첫 번째 패널의 캐릭터로 초기 선택 설정
          setTimeout(() => {
            if (characterMap.size > 0) {
              const firstPanelCharacters = characterMap.get(0);
              if (firstPanelCharacters && firstPanelCharacters.length > 0) {
                console.log('🎯 첫 번째 패널 캐릭터로 초기 선택:', firstPanelCharacters);
                setSelectedCharacters(firstPanelCharacters);
              }
            }
          }, 100); // 100ms 지연으로 상태 업데이트 순서 보장
          
        } else {
          console.warn('⚠️ 캐릭터 데이터 로딩 실패:', uploadData.error);
        }
      } catch (error) {
        console.error('❌ 캐릭터 매핑 중 오류:', error);
      }
    };
    
    // 비동기로 캐릭터 매핑 실행
    loadCharactersAndMap();

    setHasUnsavedChanges(true);
  }, [updateHistory, mapPanelCharacters]);

  const [addCharacterModalOpen, setAddCharacterModalOpen] = useState(false);
  const [characterRefreshKey, setCharacterRefreshKey] = useState(0);
  

  // 업로드된 파일 목록 로딩
  useEffect(() => {
    loadUploadedFiles();
  }, []);

  // 정렬된 업로드 이미지 목록
  const sortedUploadedImages = useMemo(() => {
    const sorted = [...uploadedImages];
    
    switch (sortOrder) {
      case 'newest':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA; // 최신순
        });
      case 'oldest':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateA - dateB; // 오래된순
        });
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name)); // 이름순
      default:
        return sorted;
    }
  }, [uploadedImages, sortOrder]);

  
  // 디바운스된 색상 업데이트를 위한 상태
  const [pendingColorUpdates, setPendingColorUpdates] = useState<{
    [key: string]: {
      fillColor?: string;
      strokeColor?: string;
      strokeWidth?: number;
    }
  }>({});
  
  const debouncedColorUpdates = useDebounce(pendingColorUpdates, 150);

  // 색상 업데이트 적용
  useEffect(() => {
    Object.entries(debouncedColorUpdates).forEach(([elementId, updates]) => {
      if (Object.keys(updates).length > 0) {
        setCuts(cuts => cuts.map(cut => ({
          ...cut,
          elements: cut.elements.map(el => 
            el.id === elementId 
              ? { ...el, ...updates }
              : el
          )
        })));
      }
    });
    setPendingColorUpdates({});
  }, [debouncedColorUpdates]);

  // UUID 검증 함수
  const isValidUUID = (uuid: string) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
  };

  // 패널 데이터 로드
  useEffect(() => {
    const loadPanelsFromDatabase = async () => {
      if (!projectId || panelsLoaded) return;
      
      // UUID 형식이 아닌 경우 오류 방지
      if (!isValidUUID(projectId)) {
        console.warn('⚠️ Invalid UUID format for projectId:', projectId);
        setPanelsLoaded(true);
        return;
      }
      
      try {
        
        const { data: panels, error } = await supabase
          .from('panel')
          .select('*')
          .eq('projectId', projectId)
          .order('order', { ascending: true });

        if (error) {
          console.error('❌ 패널 로드 실패:', error);
          return;
        }

        if (panels && panels.length > 0) {
          
          const loadedCuts = panels.map((panel: any) => ({
            id: panel.order.toString(),
            prompt: panel.prompt || '',
            imageUrl: panel.imageUrl,
            generationId: panel.generationId,
            elements: panel.editData?.elements || []
          }));

          // 첫 번째 패널의 설정 복원
          const firstPanel = panels[0];
          if (firstPanel?.editData) {
            if (firstPanel.editData.canvasRatio) {
              updateStateWithoutHistory(prev => ({ 
                ...prev, 
                cuts: loadedCuts,
                canvasRatio: firstPanel.editData.canvasRatio 
              }));
            } else {
              updateStateWithoutHistory(prev => ({ ...prev, cuts: loadedCuts }));
            }
            
            if (firstPanel.editData.selectedCharacters) {
              setSelectedCharacters(firstPanel.editData.selectedCharacters);
            }
          } else {
            updateStateWithoutHistory(prev => ({ ...prev, cuts: loadedCuts }));
          }
        } else {
        }
        
        setPanelsLoaded(true);
      } catch (error) {
        console.error('❌ 패널 로드 오류:', error);
        setPanelsLoaded(true); // 오류가 발생해도 로딩 상태를 완료로 설정
      }
    };

    loadPanelsFromDatabase();
  }, [projectId, supabase, panelsLoaded, updateStateWithoutHistory]);

  // 🔄 실시간 패널 데이터 동기화 (다른 사용자/세션의 변경사항 반영)
  useEffect(() => {
    // 항상 useEffect가 실행되도록 조건을 내부로 이동
    const syncPanelData = async () => {
      // 조건 체크를 함수 내부로 이동
      if (!projectId || !panelsLoaded || !isValidUUID(projectId)) return;

      try {
        const { data: panels, error } = await supabase
          .from('panel')
          .select('*')
          .eq('projectId', projectId)
          .order('order', { ascending: true });

        if (error || !panels) return;

        // 현재 로컬 상태와 DB 상태 비교
        const dbCuts = panels.map((panel: any) => ({
          id: panel.order.toString(),
          prompt: panel.prompt || '',
          imageUrl: panel.imageUrl,
          generationId: panel.generationId,
          elements: panel.editData?.elements || []
        }));

        // 이미지 URL이 다른 패널들만 업데이트 (다른 사용자가 생성한 이미지)
        const hasImageChanges = dbCuts.some((dbCut, index) => {
          const localCut = cuts[index];
          return localCut && dbCut.imageUrl !== localCut.imageUrl && dbCut.imageUrl;
        });

        if (hasImageChanges) {
          console.log('🔄 다른 세션에서 생성된 이미지 동기화');
          pushHistory(prev => ({
            ...prev,
            cuts: prev.cuts.map((localCut, index) => {
              const dbCut = dbCuts[index];
              if (dbCut && dbCut.imageUrl && dbCut.imageUrl !== localCut.imageUrl) {
                return { ...localCut, imageUrl: dbCut.imageUrl, generationId: dbCut.generationId };
              }
              return localCut;
            })
          }));
        }

      } catch (error) {
        console.error('❌ 패널 동기화 실패:', error);
      }
    };

    // 5초마다 동기화 체크
    const syncInterval = setInterval(syncPanelData, 5000);
    
    return () => clearInterval(syncInterval);
  }, [projectId, panelsLoaded, supabase, cuts, setCuts]);

  // cuts 변경 감지 (변경사항 추적) - 제거
  // 이미 updateHistory 함수에서 setHasUnsavedChanges(true)를 호출하므로 중복 제거

  // 자동 저장 (디바운스 적용) - 드래그/리사이즈 중이 아닐 때만 저장
  const debouncedCuts = useDebounce(cuts, 3000); // 3초 디바운스 (썸네일 생성을 위해 빠른 저장)
  
  useEffect(() => {
    // 패널이 로드되지 않았거나 드래그/리사이즈 중이면 자동 저장 건너뛰기
    if (!panelsLoaded || isDraggingElement || isResizing) return;
    
    if (debouncedCuts && hasUnsavedChanges && onSave) {
      autoSaveProject().then(() => {
        setHasUnsavedChanges(false);
      }).catch((error) => {
      });
    }
  }, [debouncedCuts, hasUnsavedChanges, onSave, isDraggingElement, isResizing, panelsLoaded]);

  // 페이지 이탈 시 자동 저장 처리
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && projectId) {
        // 작업이 있고 저장되지 않은 경우 자동 저장
        autoSaveProject();
        const message = '작업한 내용이 저장되지 않았습니다. 정말 나가시겠습니까?';
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    const handleUnload = () => {
      if (hasUnsavedChanges && projectId && navigator.sendBeacon) {
        // 작업 저장 (새로운 API 형식으로)
        const panelsData = cuts.map((cut, index) => ({
          id: cut.id,
          prompt: cut.prompt,
          imageUrl: cut.imageUrl,
          generationId: cut.generationId,
          editData: {
            elements: cut.elements,
            canvasRatio: canvasRatio,
            selectedCharacters: selectedCharacters
          },
          // 새로운 API 필드들
          elements: cut.elements,
          content: '', 
          settings: {},
          metadata: { canvasRatio, selectedCharacters }
        }));
        
        const saveData = {
          projectId,
          projectName: initialData?.title || '무제 프로젝트',
          panels: panelsData
        };
        const saveBlob = new Blob([JSON.stringify(saveData)], { type: 'text/plain' });
        navigator.sendBeacon('/api/studio/save-project', saveBlob);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, [hasUnsavedChanges, cuts, canvasRatio, selectedCharacters, projectId, initialData]);

  
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  // Ctrl+마우스휠 줌 기능 - 작업공간에서만 동작
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // 작업공간 영역 체크
      if (!canvasAreaRef.current?.contains(e.target as Node)) {
        return;
      }

      // Ctrl 키가 눌려있는지 확인 (Mac에서는 metaKey도 체크)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); // 브라우저 기본 줌 방지
        
        // 휠 방향에 따라 줌 조절 - 더 부드러운 단계
        const delta = e.deltaY > 0 ? -1 : 1;
        const currentIndex = ZOOM_LEVELS.indexOf(zoom);
        let newIndex;
        
        if (currentIndex !== -1) {
          // 정확한 줌 레벨에 있는 경우
          newIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, currentIndex + delta));
        } else {
          // 중간값인 경우 가장 가까운 레벨 찾기
          const closestIndex = ZOOM_LEVELS.reduce((prev, curr, index) => 
            Math.abs(curr - zoom) < Math.abs(ZOOM_LEVELS[prev] - zoom) ? index : prev, 0
          );
          newIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, closestIndex + delta));
        }
        
        setZoom(ZOOM_LEVELS[newIndex]);
      }
    };

    // 전역 이벤트로 등록
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, [zoom]);

  // 멘션용 캐릭터와 요소 데이터 로드
  useEffect(() => {
    const loadMentionData = async () => {
      try {
        // 캐릭터 데이터 로드
        const charactersResponse = await fetch('/api/characters/lightning-fast?limit=100');
        const charactersResult = await charactersResponse.json();
        
        if (charactersResult.success) {
          const characters = (charactersResult.characters || []).map((char: any) => ({
            id: char.id,
            name: char.name || `캐릭터${char.id}`,
            type: 'character' as const,
            imageUrl: char.thumbnailUrl || '',
            thumbnailUrl: char.thumbnailUrl || '',
            description: char.description || ''
          }));
          
          console.log('🔧 Loaded characters for mention:', characters.length);
          setMentionCharacters(characters);
        }

        // 요소 데이터 로드
        const elementsResponse = await fetch('/api/elements');
        const elementsResult = await elementsResponse.json();
        
        if (elementsResult.success) {
          const elements = (elementsResult.elements || []).map((elem: any) => ({
            id: elem.id,
            name: elem.name || `요소${elem.id}`,
            type: 'element' as const,
            imageUrl: elem.imageUrl || '',
            thumbnailUrl: elem.thumbnailUrl || elem.imageUrl || '',
            description: elem.description || ''
          }));
          
          console.log('🔧 Loaded elements for mention:', elements.length);
          setMentionElements(elements);
        }
      } catch (error) {
        console.error('Failed to load mention data:', error);
      }
    };

    loadMentionData();
  }, []);

  // 줌 관련 함수
  const handleZoomChange = (value: number[]) => {
    setZoom(value[0]);
  };

  const handleZoomIn = () => {
    // 더 세밀한 단계로 확대
    const currentIndex = ZOOM_LEVELS.indexOf(zoom);
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      setZoom(ZOOM_LEVELS[currentIndex + 1]);
    } else {
      // 정확한 레벨에 없는 경우 다음 큰 값으로
      const nextLevel = ZOOM_LEVELS.find(level => level > zoom);
      if (nextLevel) setZoom(nextLevel);
    }
  };

  const handleZoomOut = () => {
    // 더 세밀한 단계로 축소
    const currentIndex = ZOOM_LEVELS.indexOf(zoom);
    if (currentIndex > 0) {
      setZoom(ZOOM_LEVELS[currentIndex - 1]);
    } else {
      // 정확한 레벨에 없는 경우 이전 작은 값으로
      const prevLevel = ZOOM_LEVELS.slice().reverse().find(level => level < zoom);
      if (prevLevel) setZoom(prevLevel);
    }
  };

  const handleFitToScreen = () => {
    setZoom(100);
  };

  // 컷 관련 함수
  const addCut = () => {
    const newCut: WebtoonCut = {
      id: Date.now().toString(),
      prompt: '',
      elements: []
    };
    pushHistory(prev => ({
      ...prev,
      cuts: [...prev.cuts, newCut],
      selectedCutId: newCut.id
    }));
    
    // 새 컷 추가 후 약간의 딸레이를 두고 스크롤 (렌더링 완료 대기)
    setTimeout(() => {
      scrollToCanvas(newCut.id);
    }, 100);
  };

  const deleteCut = (cutId: string) => {
    if (cuts.length <= 1) return; // 최소 1개 컷은 유지
    
    const updatedCuts = cuts.filter(cut => cut.id !== cutId);
    
    pushHistory(prev => ({
      ...prev,
      cuts: updatedCuts,
      selectedCutId: selectedCutId === cutId ? (updatedCuts[0]?.id || '') : prev.selectedCutId,
      selectedElementId: null
    }));
  };

  const scrollToCanvas = (cutId: string) => {
    // 약간의 지연을 두어 DOM 업데이트 완료 후 스크롤
    setTimeout(() => {
      const canvasElement = canvasRefs.current[cutId];
      const containerElement = canvasAreaRef.current;
      
      if (canvasElement && containerElement) {
        // 컨테이너와 캔버스의 크기 정보
        const containerHeight = containerElement.clientHeight;
        const canvasHeight = canvasElement.offsetHeight;
        
        // 캔버스의 getBoundingClientRect를 사용하여 정확한 위치 계산
        const containerRect = containerElement.getBoundingClientRect();
        const canvasRect = canvasElement.getBoundingClientRect();
        
        // 현재 스크롤 위치
        const currentScrollTop = containerElement.scrollTop;
        
        // 캔버스의 현재 위치 (컨테이너 기준)
        const canvasTopRelativeToContainer = canvasRect.top - containerRect.top;
        
        // 캔버스를 컨테이너 중앙에 위치시키기 위한 목표 위치
        const idealCanvasTop = (containerHeight - canvasHeight) / 2;
        
        // 필요한 스크롤 거리 계산
        const scrollAdjustment = canvasTopRelativeToContainer - idealCanvasTop;
        const targetScrollTop = currentScrollTop + scrollAdjustment;
        
        containerElement.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth'
        });
      }
    }, 50);
  };

  const moveCutUp = (cutId: string) => {
    const currentIndex = cuts.findIndex(cut => cut.id === cutId);
    if (currentIndex <= 0) return; // 이미 맨 위에 있음
    
    const newCuts = [...cuts];
    [newCuts[currentIndex], newCuts[currentIndex - 1]] = [newCuts[currentIndex - 1], newCuts[currentIndex]];
    pushHistory(prev => ({
      ...prev,
      cuts: newCuts
    }));
    
    // 순서 변경 후 스크롤 위치 조정
    setTimeout(() => scrollToCanvas(cutId), 100);
  };

  const moveCutDown = (cutId: string) => {
    const currentIndex = cuts.findIndex(cut => cut.id === cutId);
    if (currentIndex >= cuts.length - 1) return; // 이미 맨 아래에 있음
    
    const newCuts = [...cuts];
    [newCuts[currentIndex], newCuts[currentIndex + 1]] = [newCuts[currentIndex + 1], newCuts[currentIndex]];
    pushHistory(prev => ({
      ...prev,
      cuts: newCuts
    }));
    
    // 순서 변경 후 스크롤 위치 조정
    setTimeout(() => scrollToCanvas(cutId), 100);
  };

  // 🚫 프롬프트 텍스트 변경은 히스토리에 기록하지 않음 (타이핑할 때마다 불필요한 기록)
  const updateCutPrompt = useCallback((cutId: string, prompt: string) => {
    
    // 드래그 상태 초기화 (프롬프트 변경 시 드래그 상태 아님)
    setDragElementPosition(null);
    
    // 🚫 프롬프트는 UI 상태이므로 히스토리에 기록하지 않음
    updateStateOnly({
      cuts: historyCuts.map(cut => 
        cut.id === cutId ? { ...cut, prompt } : cut
      )
    });
  }, [historyCuts]);

  // 요소가 속한 캔버스를 찾고 자동 이동하는 함수
  const findElementCutAndSelect = useCallback((elementId: string) => {
    // 모든 캔버스에서 해당 elementId를 가진 요소 찾기
    for (const cut of cuts) {
      const hasElement = cut.elements.some(element => element.id === elementId);
      if (hasElement) {
        // 해당 캔버스가 현재 선택된 캔버스가 아니라면 자동 이동
        if (selectedCutId !== cut.id) {
          pushHistory(prev => ({
            ...prev,
            selectedCutId: cut.id
          }));
          // 캔버스로 스크롤 이동
          scrollToCanvas(cut.id);
        }
        // 요소 선택
        pushHistory(prev => ({
          ...prev,
          selectedElementId: elementId
        }));
        return;
      }
    }
    console.warn(`⚠️ 요소 ${elementId}를 어떤 캔버스에서도 찾을 수 없습니다.`);
  }, [cuts, selectedCutId, pushHistory, scrollToCanvas]);

  // 멀티 선택 관련 함수
  const toggleElementSelection = useCallback((elementId: string, isShiftHeld: boolean) => {
    // 🔗 클릭된 요소가 그룹화된 요소인지 확인하고 그룹 전체 선택
    const currentCut = cuts.find(cut => cut.id === selectedCutId);
    if (currentCut) {
      const clickedElement = currentCut.elements.find(el => el.id === elementId);
      
      // 그룹화된 요소를 클릭했고 Shift 키를 누르지 않았다면 그룹 전체 선택
      if (clickedElement && clickedElement.isGrouped && clickedElement.groupId && !isShiftHeld) {
        const groupElements = currentCut.elements.filter(el => el.groupId === clickedElement.groupId);
        if (groupElements.length > 0) {
          const groupElementIds = groupElements.map(el => el.id);
          
          pushHistory(prev => ({
            ...prev,
            selectedElementIds: groupElementIds,
            selectedElementId: groupElementIds[0]
          }));
          
          console.log(`✅ 그룹 ${clickedElement.groupId}의 ${groupElementIds.length}개 요소를 선택했습니다.`);
        }
        return;
      }
    }

    // 🎯 요소 타입에 따라 적절한 탭으로 자동 전환
    const findElementType = () => {
      for (const cut of cuts) {
        const element = cut.elements.find(el => el.id === elementId);
        if (element) {
          return element.type;
        }
      }
      return null;
    };

    const elementType = findElementType();
    
    // 요소 타입에 따라 탭 자동 전환
    if (elementType && !isShiftHeld) {
      if (elementType === 'bubble') {
        setActiveTab('bubble');
      } else if (elementType === 'text') {
        setActiveTab('text');
      }
    }

    if (isShiftHeld) {
      // Shift 키가 눌린 경우: 멀티 선택 모드
      if (selectedElementIds.includes(elementId)) {
        // 이미 선택된 요소면 선택 해제
        pushHistory(prev => ({
          ...prev,
          selectedElementIds: selectedElementIds.filter(id => id !== elementId),
          selectedElementId: selectedElementId === elementId ? null : selectedElementId
        }));
      } else {
        // 새로운 요소 추가
        pushHistory(prev => ({
          ...prev,
          selectedElementIds: [...selectedElementIds, elementId],
          selectedElementId: elementId
        }));
      }
    } else {
      // 단일 선택 모드
      pushHistory(prev => ({
        ...prev,
        selectedElementIds: [elementId],
        selectedElementId: elementId
      }));
    }
  }, [selectedElementIds, selectedElementId, pushHistory, cuts, setActiveTab, selectedCutId]);



  // 선택 영역 내의 요소들 찾기
  const getElementsInSelectionBox = useCallback((box: SelectionBox, cutId: string) => {
    const cut = cuts.find(c => c.id === cutId);
    if (!cut) return [];

    const selectedElements: string[] = [];
    
    const minX = Math.min(box.startX, box.endX);
    const maxX = Math.max(box.startX, box.endX);
    const minY = Math.min(box.startY, box.endY);
    const maxY = Math.max(box.startY, box.endY);
    
    // 선택 박스가 너무 작으면 선택하지 않음 (실수 방지) - 극도로 민감하게 조정
    if (Math.abs(maxX - minX) < 2 || Math.abs(maxY - minY) < 2) {
      return [];
    }
    
    cut.elements.forEach(element => {
      // 🎯 극도로 민감한 선택: 조금이라도 겹치면 선택
      const elementLeft = element.x;
      const elementRight = element.x + element.width;
      const elementTop = element.y;
      const elementBottom = element.y + element.height;
      
      // 🔥 초민감 겹침 감지: 드래그 박스와 요소가 0.001px라도 겹치면 선택
      // 조건: 두 사각형이 완전히 분리되지 않았다면 겹치는 것으로 간주
      const isCompletelyOutside = (
        elementRight <= minX ||   // 요소가 선택박스 왼쪽에 완전히 있음
        elementLeft >= maxX ||    // 요소가 선택박스 오른쪽에 완전히 있음
        elementBottom <= minY ||  // 요소가 선택박스 위쪽에 완전히 있음
        elementTop >= maxY        // 요소가 선택박스 아래쪽에 완전히 있음
      );
      
      // 완전히 분리되지 않았다면 = 겹친다 = 선택!
      if (!isCompletelyOutside) {
        selectedElements.push(element.id);
        console.log(`📦 드래그 선택: ${element.type} 요소 (${element.id}) 선택됨 - 위치: ${element.x},${element.y} 크기: ${element.width}x${element.height}`);
      }
    });
    
    console.log('🎯 선택 박스:', { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY });
    console.log('🎯 찾은 요소들:', selectedElements.length, '개 선택됨:', selectedElements);
    
    return selectedElements;
  }, [cuts]);

  // 🎯 선택된 요소들 정렬 함수
  const alignElements = useCallback((alignment: 'left' | 'center' | 'right') => {
    if (selectedElementIds.length < 2) return;
    
    const currentCut = cuts.find(cut => cut.id === selectedCutId);
    if (!currentCut) return;
    
    const selectedElements = currentCut.elements.filter(el => selectedElementIds.includes(el.id));
    if (selectedElements.length < 2) return;
    
    // 기준 좌표 계산
    const minX = Math.min(...selectedElements.map(el => el.x));
    const maxX = Math.max(...selectedElements.map(el => el.x + el.width));
    const centerX = (minX + maxX) / 2;
    
    let targetX: number;
    switch (alignment) {
      case 'left':
        targetX = minX;
        break;
      case 'right':
        targetX = maxX;
        break;
      case 'center':
      default:
        targetX = centerX;
        break;
    }
    
    // 요소들 정렬
    pushHistory(prev => ({
      ...prev,
      cuts: prev.cuts.map(cut => ({
        ...cut,
        elements: cut.elements.map(el => {
          if (!selectedElementIds.includes(el.id)) return el;
          
          let newX: number;
          switch (alignment) {
            case 'left':
              newX = targetX;
              break;
            case 'right':
              newX = targetX - el.width;
              break;
            case 'center':
            default:
              newX = targetX - el.width / 2;
              break;
          }
          
          return { ...el, x: newX };
        })
      }))
    }));
    
    console.log(`✅ ${selectedElements.length}개 요소를 ${alignment} 정렬했습니다.`);
  }, [selectedElementIds, cuts, selectedCutId, pushHistory]);

  // 🔗 그룹화 기능
  const groupSelectedElements = useCallback(() => {
    if (selectedElementIds.length < 2) {
      console.log('⚠️ 그룹화하려면 최소 2개 이상의 요소를 선택해야 합니다.');
      return;
    }

    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    pushHistory(prev => ({
      ...prev,
      cuts: prev.cuts.map(cut => {
        if (cut.id !== selectedCutId) return cut;
        
        return {
          ...cut,
          elements: cut.elements.map(element => {
            if (selectedElementIds.includes(element.id)) {
              return {
                ...element,
                groupId,
                isGrouped: true
              };
            }
            return element;
          })
        };
      }),
      selectedElementIds: [], // 그룹화 후 선택 해제
      selectedElementId: null
    }));
    
    console.log(`✅ ${selectedElementIds.length}개 요소를 그룹화했습니다. (그룹 ID: ${groupId})`);
  }, [selectedElementIds, selectedCutId, pushHistory]);

  // 🔓 그룹 해제 기능
  const ungroupSelectedElements = useCallback(() => {
    const currentCut = cuts.find(cut => cut.id === selectedCutId);
    if (!currentCut) return;

    // 선택된 요소들 중 그룹화된 요소 찾기
    const selectedElements = currentCut.elements.filter(el => 
      selectedElementIds.includes(el.id) || el.id === selectedElementId
    );
    
    const groupedElements = selectedElements.filter(el => el.isGrouped && el.groupId);
    if (groupedElements.length === 0) {
      console.log('⚠️ 선택된 요소 중 그룹화된 요소가 없습니다.');
      return;
    }

    // 그룹 ID들 수집
    const groupIds = [...new Set(groupedElements.map(el => el.groupId).filter(Boolean))];
    
    pushHistory(prev => ({
      ...prev,
      cuts: prev.cuts.map(cut => {
        if (cut.id !== selectedCutId) return cut;
        
        return {
          ...cut,
          elements: cut.elements.map(element => {
            if (groupIds.includes(element.groupId || '')) {
              return {
                ...element,
                groupId: undefined,
                isGrouped: false
              };
            }
            return element;
          })
        };
      }),
      selectedElementIds: [], // 그룹 해제 후 선택 해제
      selectedElementId: null
    }));
    
    console.log(`✅ ${groupIds.length}개 그룹을 해제했습니다.`);
  }, [cuts, selectedCutId, selectedElementIds, selectedElementId, pushHistory]);

  // 그룹 전체 선택 기능
  const selectGroupElements = useCallback((groupId: string) => {
    const currentCut = cuts.find(cut => cut.id === selectedCutId);
    if (!currentCut || !groupId) return;

    const groupElements = currentCut.elements.filter(el => el.groupId === groupId);
    if (groupElements.length === 0) return;

    const groupElementIds = groupElements.map(el => el.id);
    
    pushHistory(prev => ({
      ...prev,
      selectedElementIds: groupElementIds,
      selectedElementId: groupElementIds[0]
    }));
    
    console.log(`✅ 그룹 ${groupId}의 ${groupElementIds.length}개 요소를 선택했습니다.`);
  }, [cuts, selectedCutId, pushHistory]);

  // 복사 기능
  const copySelectedElements = useCallback(() => {
    const currentCut = cuts.find(cut => cut.id === selectedCutId);
    if (!currentCut) return;

    const elementsToCopy = currentCut.elements.filter(el => 
      selectedElementIds.includes(el.id) || el.id === selectedElementId
    );
    
    if (elementsToCopy.length > 0) {
      setClipboard([...elementsToCopy]);
    }
  }, [cuts, selectedCutId, selectedElementIds, selectedElementId]);

  // 붙여넣기 기능
  const pasteElements = useCallback(() => {
    if (clipboard.length === 0) return;

    const newElements = clipboard.map(element => ({
      ...element,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      x: element.x + 20, // 약간 오프셋
      y: element.y + 20
    }));

    const newElementIds = newElements.map(el => el.id);
    
    pushHistory(prev => ({
      ...prev,
      cuts: prev.cuts.map(cut => 
        cut.id === selectedCutId 
          ? { ...cut, elements: [...cut.elements, ...newElements] }
          : cut
      ),
      selectedElementIds: newElementIds,
      selectedElementId: newElementIds[0]
    }));
    
  }, [clipboard, selectedCutId, pushHistory]);

  // 키보드 이벤트 처리 (복사, 붙여넣기, 삭제)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 텍스트 입력 요소에서는 무시
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl/Cmd + C: 복사
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        copySelectedElements();
      }
      
      // Ctrl/Cmd + V: 붙여넣기
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        pasteElements();
      }
      
      // Ctrl/Cmd + A: 전체 선택
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const currentCut = cuts.find(cut => cut.id === selectedCutId);
        if (currentCut && currentCut.elements.length > 0) {
          const allElementIds = currentCut.elements.map(el => el.id);
          pushHistory(prev => ({
            ...prev,
            selectedElementIds: allElementIds,
            selectedElementId: allElementIds[0]
          }));
          console.log(`✅ ${allElementIds.length}개 요소를 모두 선택했습니다.`);
        }
      }
      
      // Delete/Backspace: 선택된 요소 삭제 (다중 선택 지원)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey && !editingTextId) {
        e.preventDefault();
        const elementsToDelete = selectedElementIds.length > 0 ? selectedElementIds : 
          (selectedElementId ? [selectedElementId] : []);
        
        if (elementsToDelete.length > 0) {
          console.log(`🗑️ ${elementsToDelete.length}개 요소를 삭제합니다:`, elementsToDelete);
          
          pushHistory(prev => ({
            ...prev,
            cuts: prev.cuts.map(cut => ({
              ...cut,
              elements: cut.elements.filter(el => !elementsToDelete.includes(el.id))
            })),
            selectedElementIds: [],
            selectedElementId: null
          }));
          
          console.log(`✅ ${elementsToDelete.length}개 요소가 삭제되었습니다.`);
        }
      }
      
      // Ctrl/Cmd + A: 전체 선택
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const currentCut = cuts.find(cut => cut.id === selectedCutId);
        if (currentCut) {
          const allElementIds = currentCut.elements.map(el => el.id);
          setSelectedElementIds(allElementIds);
          if (allElementIds.length > 0) {
            setSelectedElementId(allElementIds[0]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copySelectedElements, pasteElements, selectedElementIds, selectedElementId, cuts, selectedCutId]);

  // 스마트 정렬 가이드라인 계산
  const calculateAlignmentGuides = useCallback((draggedElementId: string, draggedX: number, draggedY: number, draggedWidth: number, draggedHeight: number) => {
    const currentCut = cuts.find(cut => cut.id === selectedCutId);
    if (!currentCut) return { horizontal: [], vertical: [], snappedX: draggedX, snappedY: draggedY };

    const SNAP_THRESHOLD = 8; // 8px 스냅 임계값
    const guides = { horizontal: [] as number[], vertical: [] as number[] };
    let snappedX = draggedX;
    let snappedY = draggedY;

    // 드래그 중인 요소의 주요 위치들
    const draggedCenterX = draggedX + draggedWidth / 2;
    const draggedCenterY = draggedY + draggedHeight / 2;
    const draggedRight = draggedX + draggedWidth;
    const draggedBottom = draggedY + draggedHeight;

    // 다른 요소들과 비교
    currentCut.elements.forEach(element => {
      if (element.id === draggedElementId) return;

      const elementCenterX = element.x + element.width / 2;
      const elementCenterY = element.y + element.height / 2;
      const elementRight = element.x + element.width;
      const elementBottom = element.y + element.height;

      // 수직 정렬 체크 (X축)
      // 좌측 정렬
      if (Math.abs(draggedX - element.x) < SNAP_THRESHOLD) {
        snappedX = element.x;
        guides.vertical.push(element.x);
      }
      // 우측 정렬
      if (Math.abs(draggedRight - elementRight) < SNAP_THRESHOLD) {
        snappedX = elementRight - draggedWidth;
        guides.vertical.push(elementRight);
      }
      // 중앙 정렬
      if (Math.abs(draggedCenterX - elementCenterX) < SNAP_THRESHOLD) {
        snappedX = elementCenterX - draggedWidth / 2;
        guides.vertical.push(elementCenterX);
      }

      // 수평 정렬 체크 (Y축)
      // 상단 정렬
      if (Math.abs(draggedY - element.y) < SNAP_THRESHOLD) {
        snappedY = element.y;
        guides.horizontal.push(element.y);
      }
      // 하단 정렬
      if (Math.abs(draggedBottom - elementBottom) < SNAP_THRESHOLD) {
        snappedY = elementBottom - draggedHeight;
        guides.horizontal.push(elementBottom);
      }
      // 중앙 정렬
      if (Math.abs(draggedCenterY - elementCenterY) < SNAP_THRESHOLD) {
        snappedY = elementCenterY - draggedHeight / 2;
        guides.horizontal.push(elementCenterY);
      }
    });

    // 캔버스 경계와의 정렬도 체크
    const canvasWidth = CANVAS_SIZES[canvasRatio].width;
    const canvasHeight = CANVAS_SIZES[canvasRatio].height;
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;

    // 캔버스 중앙 정렬
    if (Math.abs(draggedCenterX - canvasCenterX) < SNAP_THRESHOLD) {
      snappedX = canvasCenterX - draggedWidth / 2;
      guides.vertical.push(canvasCenterX);
    }
    if (Math.abs(draggedCenterY - canvasCenterY) < SNAP_THRESHOLD) {
      snappedY = canvasCenterY - draggedHeight / 2;
      guides.horizontal.push(canvasCenterY);
    }

    return { horizontal: guides.horizontal, vertical: guides.vertical, snappedX, snappedY };
  }, [cuts, selectedCutId, canvasRatio]);

  // 캐릭터 관련 함수
  const handleCharacterToggle = (characterId: string) => {
    setSelectedCharacters(prev => {
      const newSelection = prev.includes(characterId)
        ? prev.filter(id => id !== characterId)
        : [...prev, characterId];
      
      
      return newSelection;
    });
  };

  const handleAddCharacter = () => {
    setAddCharacterModalOpen(true);
  };

  // ✨ 요소 관련 함수 (새로 추가) - 이미지 기반
  const handleElementsChange = (elements: any[]) => {
    setSelectedElements(elements);
    console.log('✨ 요소 이미지 변경:', elements.length, '개');
  };

  const handleCharacterAdded = () => {
    // 캐릭터 목록 새로고침
    setCharacterRefreshKey(prev => prev + 1);
  };


  // AI 대본 적용 함수
  interface ScriptPanel {
    order: number;
    prompt: string;
    characters: string[]; // AI 생성 캐릭터 이름들 (참고용)
    elements: string[]; // AI 생성 요소 이름들 (참고용)
    characterIds?: string[]; // 🚀 실제 DB 캐릭터 ID들
    elementIds?: string[]; // 🚀 실제 DB 요소 ID들
  }

  // 패널에 적용하기 (기존 방식 + 캐릭터/요소 자동 선택)
  const handleApplyToCanvas = useCallback(async (panels: ScriptPanel[]) => {
    console.log('📋 패널에 적용하기:', panels);
    console.log('🔍 현재 선택된 컷 ID:', selectedCutId);
    
    try {
      // 대본을 캔버스에 적용하지 않고 캐릭터/요소만 자동 선택
      console.log('📋 패널 적용: 캐릭터/요소 자동 선택만 수행');
      
      // 현재 선택된 컷의 캐릭터와 요소를 자동 선택
      const currentCutIndex = parseInt(selectedCutId) - 1;
      const currentPanel = panels[currentCutIndex];
      
      if (currentPanel) {
        console.log('🎯 현재 컷의 자동 선택 시작:', {
          cutIndex: currentCutIndex,
          characters: currentPanel.characters,
          elements: currentPanel.elements
        });
        
        // 사용자의 캐릭터와 요소 정보 조회
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const [charactersResult, elementsResult] = await Promise.all([
            supabase
              .from('character')
              .select('id, name, description, thumbnailUrl, squareRatioUrl, portraitRatioUrl')
              .eq('userId', user.id),
            supabase
              .from('element')
              .select('id, name, description, category, thumbnailUrl')
              .eq('userId', user.id)
          ]);

          const userCharacters = charactersResult.data || [];
          const userElements = elementsResult.data || [];

          // 대본의 캐릭터 이름으로 ID 찾기
          const matchedCharacterIds = currentPanel.characters
            .map(charName => {
              const character = userCharacters.find(c => 
                c.name === charName || 
                c.name.includes(charName) || 
                charName.includes(c.name)
              );
              return character?.id;
            })
            .filter(Boolean);

          // 대본의 요소 이름으로 요소 객체 찾기  
          const matchedElements = currentPanel.elements
            .map(elementName => {
              // 요소 이름에서 설명 부분 제거 (예: "마법 지팡이 (강력한 마법 무기)" -> "마법 지팡이")
              const cleanElementName = elementName.split(' (')[0];
              const element = userElements.find(e => 
                e.name === cleanElementName || 
                e.name.includes(cleanElementName) || 
                cleanElementName.includes(e.name)
              );
              
              if (element) {
                return {
                  id: element.id,
                  name: element.name,
                  description: element.description,
                  category: element.category,
                  thumbnailUrl: element.thumbnailUrl,
                  isSelected: true
                };
              }
              return null;
            })
            .filter(Boolean);

          console.log('🔍 매칭 결과:', {
            matchedCharacterIds,
            matchedElements: matchedElements.map(e => e?.name)
          });

          // 캐릭터 자동 선택
          if (matchedCharacterIds.length > 0) {
            setSelectedCharacters(matchedCharacterIds);
            console.log('✅ 캐릭터 자동 선택 완료:', matchedCharacterIds);
          }

          // 요소 자동 선택
          if (matchedElements.length > 0) {
            setSelectedElements(matchedElements);
            console.log('✅ 요소 자동 선택 완료:', matchedElements.map(e => e?.name));
          }
        }
      }
      
    } catch (error) {
      console.error('❌ 패널 적용 중 오류:', error);
      // 에러가 발생해도 대본은 적용되도록 함
    }
  }, [selectedCutId, handleScriptGenerated, supabase]);

  // 한꺼번에 생성하기 (배치 생성)
  const handleBatchGeneration = useCallback(async (panels: ScriptPanel[]) => {
    console.log('🚀 배치 생성 시작 (개별 API 호출 방식):', panels);
    console.log('📋 현재 상태:', {
      selectedCharacters,
      selectedElements: selectedElements.length,
      canvasRatio,
      projectId: projectId
    });
    
    if (!panels || panels.length === 0) {
      alert('생성할 패널이 없습니다.');
      return;
    }
    
    try {
      setIsBatchGenerating(true);
      setBatchProgress({ current: 0, total: panels.length });
      setPendingScript(panels);

      // 대본을 캔버스에 자동 적용하지 않음 - 사용자가 직접 선택하도록 변경
      console.log('🚀 배치 생성: 기존 패널 유지, 자동 적용 비활성화');

      // 필요한 패널 수만큼 패널이 있는지 확인하고 부족하면 추가
      const neededPanels = panels.length;
      const currentPanels = cuts.length;
      
      // 🧹 배치 생성용 작업 배열 생성 (state 비동기 업데이트 문제 해결)
      let workingCuts = [...cuts];
      
      if (currentPanels < neededPanels) {
        console.log(`📋 패널 부족: 필요 ${neededPanels}개, 현재 ${currentPanels}개 - ${neededPanels - currentPanels}개 추가`);
        
        for (let i = currentPanels; i < neededPanels; i++) {
          const newCut: Cut = {
            id: String(Date.now() + i),
            width: canvasRatio === '1:1' ? 400 : canvasRatio === '16:9' ? 600 : 320,
            height: canvasRatio === '1:1' ? 400 : canvasRatio === '16:9' ? 337.5 : 400,
            backgroundColor: '#ffffff',
            elements: [],
            imageUrl: null,
            generationId: null,
            aspectRatio: canvasRatio
          };
          workingCuts.push(newCut);
        }
        
        setCuts(workingCuts); // 비동기 state 업데이트
        console.log(`✅ ${neededPanels - currentPanels}개 패널 추가 완료`);
      }

      console.log('🔥 배치 생성: 개별 패널 생성 시작');
      console.log('🗂️ 작업 배열:', workingCuts.map(c => ({ id: c.id, index: workingCuts.indexOf(c) })));
      
      // 🚀 나노바나나MCP 방식: 첫 패널 생성 → 연속 편집
      let previousImageUrl: string | null = null;
      
      // 🎯 슬롯 추적 시스템: 각 패널에서 사용된 요소들 기록
      let previousPanelSlots = {
        characterIds: [] as string[],
        elementIds: [] as string[]
      };
      
      console.log('🎯 슬롯 추적 시스템 초기화');
      
      for (let i = 0; i < panels.length; i++) {
        const panel = panels[i];
        
        // 🔍 패널 ID 가져오기 (작업 배열에서 가져오기)
        const cutId = workingCuts[i]?.id || String(Date.now() + i);
        
        console.log(`🔍 패널 ${i + 1} ID 확인:`, {
          index: i,
          cutId: cutId,
          fromWorkingArray: !!workingCuts[i],
          workingArrayLength: workingCuts.length
        });
        
        console.log(`⚡ 배치 생성: ${i + 1}/${panels.length} 패널 생성 중...`);
        console.log(`🎯 패널 ${i + 1} 세부 정보:`, {
          패널순서: i + 1,
          총패널수: panels.length,
          패널ID: cutId,
          프롬프트: panel.prompt?.substring(0, 100) + '...',
          이전이미지URL: previousImageUrl ? previousImageUrl.substring(0, 50) + '...' : '없음',
          편집모드: i > 0 ? '✅ nanobananaMCP' : '❌ 새로생성'
        });
        setBatchProgress({ current: i, total: panels.length });
        
        try {
          // 🔥 로딩 상태 설정
          setGeneratingCutIds(prev => new Set([...prev, cutId]));
          
          // 🎭 1단계: 현재 패널에 필요한 캐릭터 결정
          const currentPanelCharacterIds = panel.characterIds?.length > 0 
            ? panel.characterIds // AI 대본에서 매핑된 캐릭터
            : selectedCharacters.slice(0, 2); // 매핑이 없으면 최대 2명
          
          // 🖼️ 2단계: 현재 패널에 필요한 요소 결정 (개선된 스마트 매핑)
          let currentPanelElementIds: string[] = [];
          
          // 2-1. AI 대본에서 명시적으로 지정된 요소 우선 사용
          if (panel.elements && panel.elements.length > 0) {
            console.log(`🎯 패널 ${i + 1} AI 대본 요소 발견:`, panel.elements);
            currentPanelElementIds = selectedElements
              .filter(element => panel.elements!.includes(element.name))
              .map(e => e.id);
          }
          
          // 2-2. AI 대본 요소가 없으면 프롬프트 기반 스마트 매칭
          if (currentPanelElementIds.length === 0) {
            const prompt = panel.prompt.toLowerCase();
            const smartMatchedElements = selectedElements.filter(element => {
              const elementName = element.name.toLowerCase();
              const elementDesc = element.description?.toLowerCase() || '';
              
              // 더 정확한 매칭 로직
              const nameMatch = prompt.includes(elementName);
              const descMatch = elementDesc && prompt.includes(elementDesc);
              
              // 키워드 기반 연관성 체크
              const keywords = elementName.split(/\s+/);
              const keywordMatch = keywords.some(keyword => 
                keyword.length > 2 && prompt.includes(keyword)
              );
              
              return nameMatch || descMatch || keywordMatch;
            });
            
            currentPanelElementIds = smartMatchedElements.map(e => e.id);
            console.log(`🔍 패널 ${i + 1} 프롬프트 매칭 요소:`, smartMatchedElements.map(e => e.name));
          }
          
          // 2-3. 여전히 없으면 적절한 fallback 적용
          if (currentPanelElementIds.length === 0) {
            if (i === 0) {
              // 첫 패널: 최대 2개만 (3개 제한 고려)
              currentPanelElementIds = selectedElements.slice(0, 2).map(e => e.id);
              console.log(`🎯 패널 1 fallback: 첫 2개 요소 사용`);
            } else {
              // 나머지 패널: 1개만 (이전 이미지 + 새요소 1개)
              currentPanelElementIds = selectedElements.slice(0, 1).map(e => e.id);
              console.log(`🎯 패널 ${i + 1} fallback: 첫 1개 요소 사용`);
            }
          }
          
          console.log(`🎯 패널 ${i + 1} 필요한 슬롯:`, {
            현재_캐릭터: currentPanelCharacterIds,
            현재_요소: currentPanelElementIds,
            이전_캐릭터: previousPanelSlots.characterIds,
            이전_요소: previousPanelSlots.elementIds
          });
          
          // 🧠 3단계: 스마트 슬롯 최적화 (Gemini 3개 제한 준수)
          let optimizedCharacterIds: string[] = [];
          let optimizedElementIds: string[] = [];
          
          if (i === 0) {
            // 첫 번째 패널: 최대 3개까지 자유롭게
            optimizedCharacterIds = currentPanelCharacterIds.slice(0, 2);
            optimizedElementIds = currentPanelElementIds.slice(0, 3 - optimizedCharacterIds.length);
            
            console.log(`🆕 패널 1 (신규): 캐릭터 ${optimizedCharacterIds.length}개 + 요소 ${optimizedElementIds.length}개 = 총 ${optimizedCharacterIds.length + optimizedElementIds.length}개`);
          } else {
            // 2패널부터: 이전 패널과 비교해서 새로운 것만 추가
            const newCharacters = currentPanelCharacterIds.filter(id => !previousPanelSlots.characterIds.includes(id));
            const newElements = currentPanelElementIds.filter(id => !previousPanelSlots.elementIds.includes(id));
            
            console.log(`🔍 패널 ${i + 1} 차이 분석:`, {
              새로운_캐릭터: newCharacters,
              새로운_요소: newElements,
              사용가능_슬롯: 2 // 이전 이미지(1) + 새로운 것들(2) = 총 3개
            });
            
            // 우선순위: 새로운 요소 > 새로운 캐릭터
            const availableSlots = 2;
            optimizedElementIds = newElements.slice(0, availableSlots);
            const remainingSlots = availableSlots - optimizedElementIds.length;
            optimizedCharacterIds = newCharacters.slice(0, remainingSlots);
            
            console.log(`🎯 패널 ${i + 1} 최적화 결과: 이전이미지(1) + 새요소(${optimizedElementIds.length}) + 새캐릭터(${optimizedCharacterIds.length}) = 총 ${1 + optimizedElementIds.length + optimizedCharacterIds.length}개`);
          }
          
          // 요소 URL 변환
          const optimizedElements = selectedElements.filter(e => optimizedElementIds.includes(e.id));
          const elementImageUrls = getElementImageUrls(optimizedElements);
          
          console.log(`🖼️ 패널 ${i + 1} 최종 전송 데이터:`, {
            캐릭터ID: optimizedCharacterIds,
            요소ID: optimizedElementIds,
            요소이름: optimizedElements.map(e => e.name),
            전송될_이미지수: i === 0 ? optimizedCharacterIds.length + optimizedElementIds.length : 1 + optimizedCharacterIds.length + optimizedElementIds.length
          });
          
          // ✨ 최적화된 요소들을 프롬프트에 통합
          const enhancedPrompt = enhancePromptWithElements({
            selectedElements: optimizedElements,
            userPrompt: panel.prompt
          });
          
          let response;
          
          if (i === 0) {
            // 🎯 첫 번째 패널: 새로 생성 (nanobananaMCP 시작점)
            const requestData = {
              prompt: enhancedPrompt,
              aspectRatio: canvasRatio,
              style: 'webtoon',
              characterIds: optimizedCharacterIds,
              elementImageUrls: elementImageUrls,
              projectId: projectId,
              panelId: cutId
            };
            
            console.log('🆕 nanobananaMCP 시작: 첫 번째 패널 - 새로 생성');
            console.log('📤 첫 번째 패널 요청:', {
              mode: 'new_generation',
              cutId,
              prompt: requestData.prompt?.substring(0, 100) + '...',
              characterIds: optimizedCharacterIds.length,
              elementUrls: elementImageUrls.length,
              totalImages: optimizedCharacterIds.length + elementImageUrls.length
            });
            
            response = await fetch('/api/ai/generate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestData),
            });
          } else {
            // 🎯 두 번째 패널부터: nanobananaMCP edit 방식
            if (!previousImageUrl) {
              console.error(`❌ 패널 ${i + 1}: previousImageUrl이 없습니다! nanobananaMCP 실패`);
              throw new Error(`패널 ${i + 1}: 이전 이미지가 없어 nanobananaMCP를 진행할 수 없습니다.`);
            }
            
            const requestData = {
              prompt: enhancedPrompt,
              aspectRatio: canvasRatio,
              style: 'webtoon',
              characterIds: optimizedCharacterIds,
              elementImageUrls: elementImageUrls,
              projectId: projectId,
              panelId: cutId,
              referenceImage: previousImageUrl, // 🚀 nanobananaMCP 핵심: 이전 이미지 참조
              editMode: true // 🚀 편집 모드 활성화
            };
            
            console.log(`🍌 nanobananaMCP 편집: ${i + 1}번째 패널 (이전 이미지 기반)`);
            console.log('📤 nanobananaMCP 편집 요청:', {
              mode: 'editImageNanoBananaMCP',
              cutId,
              prompt: requestData.prompt?.substring(0, 100) + '...',
              previousImage: previousImageUrl?.substring(0, 50) + '...',
              characterIds: optimizedCharacterIds.length,
              elementUrls: elementImageUrls.length,
              totalImages: 1 + optimizedCharacterIds.length + elementImageUrls.length // 이전이미지 + 새로운것들
            });
            
            response = await fetch('/api/ai/generate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestData),
            });
          }

          if (!response.ok) {
            let errorData;
            let errorMessage = `HTTP ${response.status}`;
            
            try {
              errorData = await response.json();
              errorMessage = errorData?.error || errorData?.message || errorMessage;
            } catch (parseError) {
              console.warn('응답 JSON 파싱 실패:', parseError);
              errorMessage = `HTTP ${response.status} - 응답 파싱 실패`;
            }
            
            console.error('❌ 개별 패널 생성 실패:', {
              status: response.status,
              statusText: response.statusText,
              errorData,
              errorMessage
            });
            
            // 🚨 토큰 부족 에러 처리 (402 Payment Required)
            if (response.status === 402) {
              console.log('💳 토큰 부족 감지 - 업그레이드 모달 표시');
              setUpgradeModalOpen(true);
              setGeneratingCutIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(cutId);
                return newSet;
              });
              continue; // 다음 패널로 계속
            }
            
            // 다른 에러 처리 또는 예외 발생
            console.error(`❌ 패널 ${cutId} 생성 실패:`, errorMessage);
            setGeneratingCutIds(prev => {
              const newSet = new Set(prev);
              newSet.delete(cutId);
              return newSet;
            });
            continue; // 다음 패널로 계속
          }

          const result = await response.json();
          console.log(`🎉 개별 패널 ${cutId} 생성 완료:`, result);
          
          // 🔍 이미지 중복 방지를 위한 상세 검증
          console.log(`🔍 패널 ${i + 1} 결과 검증:`, {
            패널순서: i + 1,
            패널ID: cutId,
            성공여부: result.success,
            이미지URL: result.data?.imageUrl ? result.data.imageUrl.substring(0, 80) + '...' : '❌ 없음',
            생성ID: result.data?.generationId || '❌ 없음',
            토큰사용: result.data?.tokensUsed || 0,
            고유성체크: {
              이전이미지와_다름: previousImageUrl ? result.data?.imageUrl !== previousImageUrl : '첫패널',
              URL끝자리: result.data?.imageUrl ? result.data.imageUrl.slice(-20) : '없음'
            }
          });
          
          if (result.success && result.data?.imageUrl) {
            // 🚀 작업 배열도 즉시 업데이트 (다음 패널을 위해)
            workingCuts = workingCuts.map(c => 
              c.id === cutId 
                ? { 
                    ...c, 
                    imageUrl: result.data.imageUrl, 
                    generationId: result.data.generationId
                  }
                : c
            );
            
            // 🚀 히스토리 상태도 업데이트 (UI 동기화)
            pushHistory(prev => ({
              ...prev,
              cuts: workingCuts // 작업 배열을 그대로 사용
            }));
            
            console.log(`✅ 패널 ${cutId} 이미지 업데이트 완료:`, {
              cutId,
              imageUrl: result.data.imageUrl.substring(0, 50) + '...',
              generationId: result.data.generationId,
              workingArrayUpdated: true
            });
            
            // 변경사항 있음 표시
            setHasUnsavedChanges(true);
            
            // 🚀 나노바나나MCP: 다음 패널을 위해 현재 이미지를 즉시 설정 (state 업데이트 기다리지 않고)
            previousImageUrl = result.data.imageUrl;
            console.log(`🔗 패널 ${i + 1} → ${i + 2} 연결 (즉시): ${previousImageUrl.substring(0, 50)}...`);
            
            // 🎯 슬롯 추적 업데이트: 현재 패널에서 사용된 모든 요소 기록
            previousPanelSlots = {
              characterIds: currentPanelCharacterIds, // 현재 패널에 필요했던 모든 캐릭터
              elementIds: currentPanelElementIds // 현재 패널에 필요했던 모든 요소
            };
            
            console.log(`🎯 패널 ${i + 1} 슬롯 업데이트:`, {
              다음패널용_캐릭터슬롯: previousPanelSlots.characterIds,
              다음패널용_요소슬롯: previousPanelSlots.elementIds,
              이전이미지: previousImageUrl ? '✅ 설정됨' : '❌ 없음'
            });
            
            // 🗾️ 데이터베이스 업데이트 (개발/프로덕션 모두)
            if (projectId && isValidUUID(projectId)) {
              try {
                // 현재 패널의 실제 order 값 찾기 (작업 배열에서)
                const currentCut = workingCuts.find(c => c.id === cutId);
                const panelOrder = currentCut ? workingCuts.indexOf(currentCut) + 1 : i + 1;
                
                console.log(`🔍 패널 ${cutId} 업데이트 시도:`, { 
                  projectId, 
                  cutId,
                  panelOrder,
                  realOrder: workingCuts.findIndex(c => c.id === cutId) + 1,
                  imageUrl: result.data.imageUrl?.substring(0, 50) + '...',
                  workingCutsLength: workingCuts.length
                });
                
                // 🔄 UPSERT 방식으로 패널 생성/업데이트 (중복 키 오류 방지)
                const { data: upsertResult, error: upsertError } = await supabase
                  .from('panel')
                  .upsert({
                    projectId: projectId,
                    order: panelOrder,
                    prompt: panel.prompt || '', // 현재 패널의 프롬프트 사용
                    imageUrl: result.data.imageUrl,
                    updatedAt: new Date().toISOString()
                  }, {
                    onConflict: 'projectId,order',
                    ignoreDuplicates: false
                  })
                  .select('id, projectId, "order", imageUrl');
                
                if (upsertError) {
                  console.error(`❌ 패널 ${cutId} UPSERT 실패:`, {
                    error: upsertError,
                    message: upsertError.message,
                    code: upsertError.code,
                    details: upsertError.details,
                    projectId,
                    panelOrder
                  });
                } else {
                  console.log(`✅ 패널 ${cutId} UPSERT 성공:`, upsertResult?.[0]);
                }
              } catch (dbError) {
                console.error(`❌ 패널 ${cutId} DB 오류:`, dbError);
              }
            }
          } else {
            console.error(`❌ 패널 ${cutId} 생성 실패 - 지원되지 않는 응답 형식`);
          }
          
          // 🔥 로딩 상태 해제
          setGeneratingCutIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(cutId);
            return newSet;
          });
          
          // 배치 진행률 업데이트
          setBatchProgress({ current: i + 1, total: panels.length });
          
        } catch (panelError) {
          console.error(`❌ 패널 ${cutId} 생성 오류:`, panelError);
          
          // 로딩 상태 해제
          setGeneratingCutIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(cutId);
            return newSet;
          });
          
          // 다음 패널로 계속
          continue;
        }
        
        // 각 패널 간 짧은 대기 (API 레이트 리미트 방지)
        if (i < panels.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log('✅ 배치 생성 완료!');
      
    } catch (error) {
      console.error('❌ 배치 생성 오류:', error);
      alert(error instanceof Error ? error.message : '배치 생성 중 오류가 발생했습니다');
    } finally {
      // 모든 로딩 상태 해제
      setGeneratingCutIds(new Set());
      setIsBatchGenerating(false);
      setBatchProgress({ current: 0, total: 0 });
      setPendingScript([]);
      setHasUnsavedChanges(true); // 변경사항 있음 표시
    }
  }, [canvasRatio, pushHistory, handleScriptGenerated, selectedCharacters, selectedElements, projectId]);


  // AI 이미지 생성 함수
  const generateImage = async (cutId: string) => {
    const cut = cuts.find(c => c.id === cutId);
    if (!cut || !cut.prompt.trim()) return;
    
    // 이미 생성 중이면 중복 요청 방지
    if (generatingCutIds.has(cutId)) {
      return;
    }


    // 🔥 이미지 생성 중 상태 설정 (히스토리와 별도 관리)
    console.log('🔥 이미지 생성 시작:', cutId);
    setGeneratingCutIds(prev => new Set([...prev, cutId]));

    try {
      // ✨ 요소가 선택되었다면 프롬프트에 통합 (새로 추가)
      const enhancedPrompt = enhancePromptWithElements({
        selectedElements,
        userPrompt: cut.prompt
      });
      
      // ✨ 요소 이미지가 있는 경우 FormData 사용, 없으면 JSON 사용
      const elementImageUrls = getElementImageUrls(selectedElements);
      let requestBody;
      let headers: HeadersInit = {};
      
      if (elementImageUrls.length > 0) {
        // JSON으로 URL과 함께 전송 (저장된 이미지)
        requestBody = JSON.stringify({
          prompt: enhancedPrompt,
          aspectRatio: canvasRatio,
          style: 'webtoon',
          characterIds: selectedCharacters?.length > 0 ? selectedCharacters : [],
          elementImageUrls: elementImageUrls, // ✨ 저장된 이미지 URL들
          projectId: projectId,
          panelId: cutId
        });
        headers['Content-Type'] = 'application/json';
      } else {
        // 기존 JSON 방식
        requestBody = JSON.stringify({
          prompt: enhancedPrompt,
          aspectRatio: canvasRatio,
          style: 'webtoon',
          characterIds: selectedCharacters?.length > 0 ? selectedCharacters : [],
          projectId: projectId,
          panelId: cutId
        });
        headers['Content-Type'] = 'application/json';
      }
      
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers,
        body: requestBody
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        
        // 🚨 토큰 부족 에러 처리 (402 Payment Required)
        if (response.status === 402) {
          console.log('💳 토큰 부족 감지 - 업그레이드 모달 표시');
          setUpgradeModalOpen(true);
          return; // 에러로 던지지 않고 모달만 표시
        }
        
        // 🚨 스토리지 부족 에러 처리 (507 Storage Full)
        if (response.status === 507 || errorData.error?.includes('저장 공간이 부족') || errorData.error?.includes('스토리지')) {
          console.log('💾 스토리지 부족 감지 - 업그레이드 모달 표시');
          setUpgradeModalOpen(true);
          return; // 에러로 던지지 않고 모달만 표시
        }
        
        // 🚨 콘텐츠 정책 위반 에러 처리 (400 Bad Request)
        if (response.status === 400 && (
          errorData.error?.includes('이용정책에 맞지 않은') ||
          errorData.error?.includes('건전한 콘텐츠') ||
          errorData.error?.includes('저작권 침해')
        )) {
          console.log('🚫 콘텐츠 정책 위반 감지');
          setToast({
            id: Date.now().toString(),
            title: "콘텐츠 정책 위반",
            description: errorData.error,
            type: "error"
          });
          return; // 에러로 던지지 않고 토스트만 표시
        }
        
        throw new Error(errorData.error || 'Failed to generate image');
      }

      const result = await response.json();
      
      // ✅ 이미지 생성 완료 - 즉시 DB 저장 및 로컬 상태 업데이트
      console.log('💾 이미지 생성 완료 - DB 즉시 저장:', cutId);
      
      // 1️⃣ 먼저 데이터베이스에 즉시 저장 (프로젝트별 격리)
      if (projectId && isValidUUID(projectId) && process.env.NODE_ENV !== 'development') {
        // 실제 프로덕션에서만 DB 저장
        try {
          const { error: updateError } = await supabase
            .from('panel')
            .update({
              imageUrl: result.data?.imageUrl,
              generationId: result.data?.generationId,
              updatedAt: new Date().toISOString()
            })
            .eq('projectId', projectId)
            .eq('"order"', parseInt(cutId));

          if (updateError) {
            console.error('❌ DB 업데이트 실패:', {
              error: updateError,
              projectId,
              cutId,
              parsedCutId: parseInt(cutId),
              imageUrl: result.data?.imageUrl?.substring(0, 50) + '...',
              generationId: result.data?.generationId
            });
          } else {
            console.log('✅ DB 저장 성공:', {
              cutId,
              projectId,
              imageUrl: result.data?.imageUrl?.substring(0, 50) + '...'
            });
          }
        } catch (dbError) {
          console.error('❌ DB 저장 오류:', dbError);
        }
      } else {
        console.log('🔧 개발 모드: DB 저장 우회 - 로컬 상태만 업데이트');
      }

      // 2️⃣ 히스토리 상태 업데이트 (정확한 상태 동기화)
      pushHistory(prev => ({
        ...prev,
        cuts: prev.cuts.map(c => 
          c.id === cutId 
            ? { 
                ...c, 
                imageUrl: result.data?.imageUrl, 
                generationId: result.data?.generationId
              }
            : c
        )
      }));
      
      // 변경사항 있음 표시
      setHasUnsavedChanges(true);
      
      // 🔥 생성 완료 후 생성 중 상태 해제
      console.log('✅ 이미지 생성 완료:', cutId);
      setGeneratingCutIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(cutId);
        return newSet;
      });
      
      // 드래그 상태 강제 초기화 (이미지 생성 후 캔버스 비활성화 방지)
      resetDragState();
      
      // 이미지는 Supabase generation 테이블에 자동으로 저장됨
      
      // 🚀 이미지 생성 후 즉시 프로젝트 저장 (썸네일 업데이트)
      setTimeout(() => {
        if (hasUnsavedChanges && !isSaving) {
          autoSaveProject().catch(error => {
          });
        }
      }, 500); // 0.5초 후 저장 (UI 업데이트 완료 후)
    } catch (error) {
      console.error('Image generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : '이미지 생성 실패';
      alert(`이미지 생성 오류: ${errorMessage}`);
      
      // 🔥 생성 실패 후 생성 중 상태 해제 (히스토리는 변경하지 않음)
      console.log('❌ 이미지 생성 실패:', cutId);
      setGeneratingCutIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(cutId);
        return newSet;
      });
      
      // 에러 시에도 드래그 상태 초기화
      resetDragState();
    }
  };

  // 이미지 수정 함수
  const editImage = async (cutId: string, editPrompt: string) => {
    const cut = cuts.find(c => c.id === cutId);
    if (!cut || !cut.imageUrl || !editPrompt.trim()) return;

    // 🔥 이미지 수정 중 상태 설정 (히스토리와 별도 관리)
    console.log('🔥 이미지 수정 시작:', cutId);
    setGeneratingCutIds(prev => new Set([...prev, cutId]));

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: editPrompt,
          aspectRatio: canvasRatio,
          style: 'webtoon',
          characterIds: selectedCharacters,
          referenceImage: cut.imageUrl, // 기존 이미지를 참조로 사용
          editMode: true, // 편집 모드 플래그
          projectId: projectId, // 프로젝트 ID 추가
          panelId: cutId // 패널 ID 추가
        })
      });

      if (!response.ok) {
        throw new Error('Failed to edit image');
      }

      const result = await response.json();
      
      // ✅ 이미지 수정 완료 - 즉시 DB 저장 및 로컬 상태 업데이트
      console.log('💾 이미지 수정 완료 - DB 즉시 저장:', cutId);
      
      // 1️⃣ 먼저 데이터베이스에 즉시 저장 (프로젝트별 격리)
      if (projectId && isValidUUID(projectId)) {
        try {
          // 업데이트 데이터 준비 및 검증
          const parsedOrder = parseInt(cutId);
          const updateData = {
            imageUrl: result.data?.imageUrl,
            generationId: result.data?.generationId,
            updatedAt: new Date().toISOString()
          };
          
          console.log('🔍 Panel 업데이트 시도:', {
            projectId,
            cutId,
            parsedOrder,
            isValidOrder: !isNaN(parsedOrder),
            hasImageUrl: !!updateData.imageUrl,
            hasGenerationId: !!updateData.generationId
          });

          const { data: updatedData, error: updateError } = await supabase
            .from('panel')
            .update(updateData)
            .eq('projectId', projectId)
            .eq('"order"', parsedOrder)
            .select('id, order, projectId, imageUrl');

          if (updateError) {
            console.error('❌ DB 수정 실패:', {
              updateError,
              message: updateError.message,
              code: updateError.code,
              details: updateError.details,
              hint: updateError.hint,
              projectId,
              cutId,
              parsedOrder
            });
          } else {
            const rowCount = updatedData?.length || 0;
            console.log('✅ DB 수정 성공:', {
              cutId,
              projectId,
              updatedRowCount: rowCount,
              updatedData: updatedData?.[0]
            });
            
            if (rowCount === 0) {
              console.warn('⚠️ 경고: 업데이트 성공했지만 영향받은 행이 없음 (패널이 존재하지 않을 수 있음)');
            }
          }
        } catch (dbError) {
          console.error('❌ DB 수정 저장 오류:', dbError);
        }
      }

      // 2️⃣ 히스토리 상태 업데이트 (정확한 상태 동기화)
      pushHistory(prev => ({
        ...prev,
        cuts: prev.cuts.map(c => 
          c.id === cutId 
            ? { ...c, imageUrl: result.data?.imageUrl }
            : c
        )
      }));
      
      // 🔥 수정 완료 후 생성 중 상태 해제
      console.log('✅ 이미지 수정 완료:', cutId);
      setGeneratingCutIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(cutId);
        return newSet;
      });
      
      // 변경사항 있음 표시
      setHasUnsavedChanges(true);
      
      // 드래그 상태 강제 초기화 (이미지 수정 후 캔버스 비활성화 방지)
      resetDragState();
    } catch (error) {
      console.error('Image edit failed:', error);
      alert(error instanceof Error ? error.message : "이미지 수정 중 오류가 발생했습니다.");
      
      // 🔥 생성 실패 후 생성 중 상태 해제 (히스토리는 변경하지 않음)
      console.log('❌ 이미지 수정 실패:', cutId);
      setGeneratingCutIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(cutId);
        return newSet;
      });
      
      // 에러 시에도 드래그 상태 초기화
      resetDragState();
    }
  };

  // 수정 모달 핸들러
  const handleEditImage = (cutId: string) => {
    const cut = cuts.find(c => c.id === cutId);
    if (!cut?.imageUrl) return;
    
    setEditingCutId(cutId);
    setEditPrompt("");
    setEditModalOpen(true);
  };

  // 수정 실행
  const handleEditSubmit = async () => {
    if (!editingCutId || !editPrompt.trim()) return;
    
    setEditModalOpen(false);
    await editImage(editingCutId, editPrompt);
    setEditingCutId(null);
    setEditPrompt("");
  };

  // 프로젝트 저장 함수 (간소화)
  const handleSaveProject = async () => {
    if (!onSave) return;
    
    setIsSaving(true);
    try {
      const panelsData = cuts.map((cut, index) => ({
        id: cut.id,
        prompt: cut.prompt,
        imageUrl: cut.imageUrl, // 클라이언트 표시용으로는 유지
        generationId: cut.generationId, // DB 참조용 generationId 추가
        editData: {
          elements: cut.elements,
          canvasRatio: canvasRatio,
          selectedCharacters: selectedCharacters
        }
      }));
      
      await onSave(panelsData, initialData?.title);
      setHasUnsavedChanges(false); // 저장 후 변경사항 플래그 리셋
      
      // 성공 알림 표시
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
    } catch (error) {
      console.error('저장 실패:', error);
      alert('프로젝트 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 저장 유도 함수
  const promptSaveBeforeLeaving = () => {
    const hasUserActivity = cuts.some(cut => {
      const hasPrompt = cut.prompt && cut.prompt.trim().length > 0;
      const hasImage = cut.generationId || cut.imageUrl;
      const hasElements = cut.elements && cut.elements.length > 0;
      return hasPrompt || hasImage || hasElements;
    });

    if (hasUnsavedChanges && hasUserActivity) {
      setSavePromptModalOpen(true);
      return true; // 네비게이션 중단
    }
    return false; // 네비게이션 허용
  };

  // 자동 저장 함수 (새로운 save-project API 사용)
  const autoSaveProject = async () => {
    if (!projectId || !hasUnsavedChanges || isSaving) {
      return;
    }
    
    setIsSaving(true);
    
    try {
      const panelsData = cuts.map((cut, index) => ({
        id: cut.id,
        prompt: cut.prompt,
        imageUrl: cut.imageUrl,
        generationId: cut.generationId,
        editData: {
          elements: cut.elements,
          canvasRatio: canvasRatio,
          selectedCharacters: selectedCharacters
        },
        // 새로운 API에서 요구하는 필드들
        elements: cut.elements,
        content: '', // 빈 콘텐츠
        settings: {},
        metadata: { canvasRatio, selectedCharacters }
      }));
      
      
      const response = await fetch('/api/studio/save-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          projectName: initialData?.title || '무제 프로젝트',
          panels: panelsData
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Save failed');
      }
      
      setHasUnsavedChanges(false);
      
      // 기존 onSave도 호출 (하위 호환성)
      if (onSave) {
        try {
          await onSave(panelsData, initialData?.title);
        } catch (legacyError) {
          console.warn('⚠️ Legacy save failed but new save succeeded:', legacyError);
        }
      }
      
    } catch (error) {
      console.error('❌ Auto-save failed:', error);
      console.error('Auto-save error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        cuts: cuts.length,
        projectId,
        hasUnsavedChanges
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 요소 추가 함수
  const addTextElement = () => {
    if (!textContent.trim()) return;
    
    const selectedCut = cuts.find(cut => cut.id === selectedCutId);
    if (!selectedCut) return;

    const newElement: CanvasElement = {
      id: Date.now().toString(),
      type: 'text',
      content: textContent,
      x: 50 + Math.random() * 100,
      y: 50 + Math.random() * 100,
      width: 150,
      height: 40,
      fontSize: 16,
      fontFamily: STUDIO_FONTS[0].fontFamily, // 기본: Noto Sans KR
      fontWeight: STUDIO_FONTS[0].weights?.[0]?.weight || 400, // 기본 폰트 굵기
      color: '#000000'
    };

    pushHistory(prev => ({
      ...prev,
      cuts: prev.cuts.map(cut => 
        cut.id === selectedCutId 
          ? { ...cut, elements: [...cut.elements, newElement] }
          : cut
      ),
      selectedElementId: null // 텍스트 추가 후 선택 상태 해제
    }));
    
    setTextContent('');
  };

  // 🎨 스타일이 미리 정의된 텍스트 요소 직접 추가 (미리캔버스 스타일)
  const addTextElementWithStyle = (style: { name: string; fontSize: number; weight: string; description?: string }) => {
    const selectedCut = cuts.find(cut => cut.id === selectedCutId);
    if (!selectedCut) return;

    const newElement: CanvasElement = {
      id: Date.now().toString(),
      type: 'text',
      content: style.name,  // 버튼 텍스트를 기본값으로 사용
      x: 50 + Math.random() * 100,
      y: 50 + Math.random() * 100,
      width: style.fontSize === 28 ? 250 : style.fontSize === 20 ? 200 : 150,  // 폰트 크기에 따른 적절한 너비
      height: style.fontSize === 28 ? 60 : style.fontSize === 20 ? 50 : 40,   // 폰트 크기에 따른 적절한 높이
      fontSize: style.fontSize,
      fontFamily: STUDIO_FONTS[0].fontFamily,
      fontWeight: style.weight,
      color: '#000000',
      textAlign: 'center'
    };

    pushHistory(prev => ({
      ...prev,
      cuts: prev.cuts.map(cut => 
        cut.id === selectedCutId 
          ? { ...cut, elements: [...cut.elements, newElement] }
          : cut
      ),
      selectedElementId: null // 텍스트 추가 후 선택 상태 해제
    }));
  };

  const addBubbleElement = (style: 'speech' | 'thought' | 'shout' | 'whisper' = 'speech') => {
    if (!bubbleText.trim()) return;
    
    const selectedCut = cuts.find(cut => cut.id === selectedCutId);
    if (!selectedCut) return;

    const newElement: CanvasElement = {
      id: Date.now().toString(),
      type: 'bubble',
      content: bubbleText,
      x: 50 + Math.random() * 100,
      y: 50 + Math.random() * 100,
      width: 120,
      height: 60,
      fontSize: 14,
      color: '#000000',
      bubbleStyle: style
    };

    pushHistory(prev => ({
      ...prev,
      cuts: prev.cuts.map(cut => 
        cut.id === selectedCutId 
          ? { ...cut, elements: [...cut.elements, newElement] }
          : cut
      ),
      selectedElementId: newElement.id
    }));
    
    setBubbleText('');
    setSelectedElementId(newElement.id);
  };

  // useCallback을 사용한 템플릿으로부터 말풍선 추가 함수
  const addBubbleFromTemplate = useCallback((templateId: string) => {
    const template = BUBBLE_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    const selectedCut = cuts.find(cut => cut.id === selectedCutId);
    if (!selectedCut) return;

    const newElement: CanvasElement = {
      id: Date.now().toString(),
      type: 'bubble',
      // content 제거 - 말풍선은 순수 그래픽 요소
      x: 150 + Math.random() * 50, // 캔버스 중앙 부근에 배치
      y: 150 + Math.random() * 50,
      width: 120,
      height: 80,
      bubbleStyle: template.category as 'speech' | 'thought' | 'shout' | 'whisper',
      templateId: template.id, // 템플릿 정보 저장
      fillColor: '#ffffff', // 기본 배경색
      strokeColor: '#333333', // 기본 테두리색
      strokeWidth: 2 // 기본 테두리 두께
    };

    pushHistory(prev => ({
      ...prev,
      cuts: prev.cuts.map(cut => 
        cut.id === selectedCutId 
          ? { ...cut, elements: [...cut.elements, newElement] }
          : cut
      ),
      selectedElementId: newElement.id
    }));
  }, [cuts, selectedCutId]);

  // 🎯 완전히 개선된 리사이즈 로직 - 고정점 기반으로 정확한 크기 조절
  const handleResizeStart = (e: React.MouseEvent, elementId: string, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    console.log('🎯 Resize Start:', { elementId, handle });
    
    // 🔒 드래그 시작 상태 저장
    setDragStartState([...historyCuts]);
    
    setIsResizing(true);
    setResizeHandle(handle);
    
    const element = cuts.find(cut => cut.id === selectedCutId)?.elements.find(el => el.id === elementId);
    if (!element) return;
    
    const startX = e.clientX;
    const startY = e.clientY;
    
    // 📍 요소의 원래 바운딩 박스 - 고정점 기준으로 계산
    const originalBounds = {
      left: element.x,
      top: element.y,
      right: element.x + element.width,
      bottom: element.y + element.height,
      width: element.width,
      height: element.height
    };
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      // 🔄 회전을 고려한 새로운 리사이즈 로직 사용
      const result = calculateRotatedResize({
        clientX: moveEvent.clientX,
        clientY: moveEvent.clientY,
        startX,
        startY,
        element,
        handle,
        zoom,
        maintainAspectRatio: moveEvent.shiftKey // Shift 키 누르면 비율 유지
      });
      
      console.log('🔄 Rotated Resize:', result.debug);
      
      // 🎨 작업 영역 범위 제한 (Canva 스타일)
      const workspaceWidth = CANVAS_SIZES[canvasRatio].width * 2;
      const workspaceHeight = CANVAS_SIZES[canvasRatio].height * 2;
      const workspaceOffsetX = -CANVAS_SIZES[canvasRatio].width * 0.5;
      const workspaceOffsetY = -CANVAS_SIZES[canvasRatio].height * 0.5;
      
      const clampedX = Math.max(workspaceOffsetX, Math.min(result.x, workspaceWidth + workspaceOffsetX - result.width));
      const clampedY = Math.max(workspaceOffsetY, Math.min(result.y, workspaceHeight + workspaceOffsetY - result.height));
      
      // 요소 업데이트 (리사이즈 중 실시간 업데이트)
      setCuts(cuts.map(cut => ({
        ...cut,
        elements: cut.elements.map(el => 
          el.id === elementId 
            ? { ...el, width: result.width, height: result.height, x: clampedX, y: clampedY }
            : el
        )
      })));
    };
    
    const handleMouseUp = () => {
      console.log('🏁 Resize End');
      // 리사이즈 완료 시 변경사항 커밋
      commitDrag();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setIsResizing(false);
      setResizeHandle('');
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 🎯 그룹 리사이즈 기능
  const handleGroupResizeStart = (
    e: React.MouseEvent, 
    elementIds: string[], 
    handle: string, 
    groupX: number, 
    groupY: number, 
    groupWidth: number, 
    groupHeight: number
  ) => {
    e.stopPropagation();
    e.preventDefault();
    
    console.log('🎯 Group Resize Start:', { elementIds, handle, groupX, groupY, groupWidth, groupHeight });
    
    // 드래그 시작 상태 저장
    setDragStartState([...historyCuts]);
    setIsResizing(true);
    setResizeHandle(handle);
    
    const startX = e.clientX;
    const startY = e.clientY;
    
    // 선택된 요소들 가져오기
    const currentCut = cuts.find(cut => cut.id === selectedCutId);
    if (!currentCut) return;
    
    const selectedElements = currentCut.elements.filter(el => elementIds.includes(el.id));
    if (selectedElements.length === 0) return;
    
    // 각 요소의 그룹 내 상대적 위치와 크기 비율 저장
    const originalRelativePositions = selectedElements.map(element => ({
      id: element.id,
      // 그룹 바운딩 박스 기준 상대적 위치 (0-1 비율)
      relativeX: (element.x - groupX) / groupWidth,
      relativeY: (element.y - groupY) / groupHeight,
      relativeWidth: element.width / groupWidth,
      relativeHeight: element.height / groupHeight,
      // 원본 크기 저장
      originalWidth: element.width,
      originalHeight: element.height
    }));
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      // 줌 레벨에 따른 스케일 보정
      const scale = zoom / 100;
      const scaledDeltaX = deltaX / scale;
      const scaledDeltaY = deltaY / scale;
      
      // 새로운 그룹 바운딩 박스 계산
      let newGroupX = groupX;
      let newGroupY = groupY;
      let newGroupWidth = groupWidth;
      let newGroupHeight = groupHeight;
      
      const maintainAspectRatio = moveEvent.shiftKey;
      const groupAspectRatio = groupWidth / groupHeight;
      
      if (maintainAspectRatio && ['nw', 'ne', 'sw', 'se'].includes(handle)) {
        // 🔒 비율 유지 모드 - 대각선 핸들만 적용
        const deltaAmount = Math.abs(scaledDeltaX) > Math.abs(scaledDeltaY) ? scaledDeltaX : scaledDeltaY;
        
        switch (handle) {
          case 'nw':
            newGroupWidth = Math.max(20, groupWidth - deltaAmount);
            newGroupHeight = Math.max(20, newGroupWidth / groupAspectRatio);
            newGroupX = groupX + (groupWidth - newGroupWidth);
            newGroupY = groupY + (groupHeight - newGroupHeight);
            break;
          case 'ne':
            newGroupWidth = Math.max(20, groupWidth + deltaAmount);
            newGroupHeight = Math.max(20, newGroupWidth / groupAspectRatio);
            newGroupY = groupY + (groupHeight - newGroupHeight);
            break;
          case 'sw':
            newGroupWidth = Math.max(20, groupWidth - deltaAmount);
            newGroupHeight = Math.max(20, newGroupWidth / groupAspectRatio);
            newGroupX = groupX + (groupWidth - newGroupWidth);
            break;
          case 'se':
            newGroupWidth = Math.max(20, groupWidth + deltaAmount);
            newGroupHeight = Math.max(20, newGroupWidth / groupAspectRatio);
            break;
        }
      } else {
        // 🔓 일반 리사이즈 모드
        switch (handle) {
          case 'nw':
            newGroupX = groupX + scaledDeltaX;
            newGroupY = groupY + scaledDeltaY;
            newGroupWidth = Math.max(20, groupWidth - scaledDeltaX);
            newGroupHeight = Math.max(20, groupHeight - scaledDeltaY);
            break;
          case 'ne':
            newGroupY = groupY + scaledDeltaY;
            newGroupWidth = Math.max(20, groupWidth + scaledDeltaX);
            newGroupHeight = Math.max(20, groupHeight - scaledDeltaY);
            break;
          case 'sw':
            newGroupX = groupX + scaledDeltaX;
            newGroupWidth = Math.max(20, groupWidth - scaledDeltaX);
            newGroupHeight = Math.max(20, groupHeight + scaledDeltaY);
            break;
          case 'se':
            newGroupWidth = Math.max(20, groupWidth + scaledDeltaX);
            newGroupHeight = Math.max(20, groupHeight + scaledDeltaY);
            break;
          case 'n':
            newGroupY = groupY + scaledDeltaY;
            newGroupHeight = Math.max(20, groupHeight - scaledDeltaY);
            break;
          case 's':
            newGroupHeight = Math.max(20, groupHeight + scaledDeltaY);
            break;
          case 'w':
            newGroupX = groupX + scaledDeltaX;
            newGroupWidth = Math.max(20, groupWidth - scaledDeltaX);
            break;
          case 'e':
            newGroupWidth = Math.max(20, groupWidth + scaledDeltaX);
            break;
        }
      }
      
      // 각 요소를 새로운 그룹 바운딩 박스에 맞게 변형
      const updatedElements = originalRelativePositions.map(({ id, relativeX, relativeY, relativeWidth, relativeHeight }) => {
        const newX = newGroupX + (relativeX * newGroupWidth);
        const newY = newGroupY + (relativeY * newGroupHeight);
        const newWidth = Math.max(10, relativeWidth * newGroupWidth);
        const newHeight = Math.max(10, relativeHeight * newGroupHeight);
        
        return {
          id,
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight
        };
      });
      
      // 모든 요소들 업데이트
      setCuts(cuts.map(cut => ({
        ...cut,
        elements: cut.elements.map(el => {
          const updatedElement = updatedElements.find(updated => updated.id === el.id);
          return updatedElement ? { ...el, ...updatedElement } : el;
        })
      })));
    };
    
    const handleMouseUp = () => {
      console.log('🏁 Group Resize End');
      // 리사이즈 완료 시 변경사항 커밋
      commitDrag();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setIsResizing(false);
      setResizeHandle('');
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 🎨 회전 버튼 드래그로 자유 회전 (히스토리 최적화)
  const handleRotationStart = (e: React.MouseEvent, elementId: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    console.log('🔄 Rotation Drag Start:', { elementId });
    
    const element = cuts.find(cut => cut.id === selectedCutId)?.elements.find(el => el.id === elementId);
    if (!element) return;

    // 🔒 회전 시작 상태 저장 (히스토리에 기록 - 시작점)
    setDragStartState([...historyCuts]);
    setIsRotating(true);
    
    // 요소의 중심점 계산 (화면 좌표)
    const canvasElement = canvasRefs.current[selectedCutId];
    if (!canvasElement) return;
    
    const rect = canvasElement.getBoundingClientRect();
    
    // 화면에서 요소의 실제 중심점 계산
    const elementCenterX = rect.left + (element.x / CANVAS_SIZES[canvasRatio].width) * rect.width + ((element.width / CANVAS_SIZES[canvasRatio].width) * rect.width) / 2;
    const elementCenterY = rect.top + (element.y / CANVAS_SIZES[canvasRatio].height) * rect.height + ((element.height / CANVAS_SIZES[canvasRatio].height) * rect.height) / 2;
    
    // 초기 회전 각도 저장
    const initialRotation = element.rotation || 0;
    
    // 시작 각도 계산 (화면 좌표 기준)
    const startAngle = Math.atan2(e.clientY - elementCenterY, e.clientX - elementCenterX) * (180 / Math.PI);
    setRotationStartAngle(startAngle);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      // 현재 각도 계산 (화면 좌표 기준)
      const currentAngle = Math.atan2(moveEvent.clientY - elementCenterY, moveEvent.clientX - elementCenterX) * (180 / Math.PI);
      
      // 각도 차이 계산
      let angleDiff = currentAngle - startAngle;
      
      // 180도 경계 처리 - 간단한 보정
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;
      
      // 최종 회전 각도
      let newRotation = initialRotation + angleDiff;
      
      // 0-360 범위로 정규화 (간단하게)
      newRotation = ((newRotation % 360) + 360) % 360;
      
      // ⚡ 실시간 회전 업데이트 (히스토리 없이 부드러운 애니메이션)
      updateStateWithoutHistory(prev => ({
        ...prev,
        cuts: prev.cuts.map(cut => ({
          ...cut,
          elements: cut.elements.map(el => 
            el.id === elementId 
              ? { ...el, rotation: newRotation }
              : el
          )
        }))
      }));
    };
    
    const handleMouseUp = () => {
      console.log('🔄 Rotation Drag End - Saving to History');
      
      // 🎯 회전 완료 시에만 히스토리에 최종 상태 저장
      pushHistory(prev => ({
        ...prev,
        cuts: prev.cuts.map(cut => ({
          ...cut,
          elements: cut.elements.map(el => 
            el.id === elementId 
              ? { ...el, rotation: el.rotation }
              : el
          )
        }))
      }));
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setIsRotating(false);
      setDragStartState(null);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 🎨 클릭 회전 기능 (15도씩, 연속적인 회전)
  const rotateElement = (elementId: string, degrees: number = 15) => {
    pushHistory(prev => ({
      ...prev,
      cuts: prev.cuts.map(cut => ({
        ...cut,
        elements: cut.elements.map(el => 
          el.id === elementId 
            ? { ...el, rotation: (el.rotation || 0) + degrees }
            : el
        )
      }))
    }));
  };


  const deleteElement = (elementId: string) => {
    console.log('🗑️ deleteElement 호출:', { elementId });
    
    // 모든 캔버스에서 해당 요소를 찾아서 삭제
    pushHistory(prev => ({
      ...prev,
      cuts: prev.cuts.map(cut => {
        const hasElement = cut.elements.some(el => el.id === elementId);
        if (hasElement) {
          console.log('✅ 요소 삭제됨:', { cutId: cut.id, elementId });
        }
        if (!hasElement) return cut;
        
        // 해당 요소가 있는 캔버스에서 요소 삭제
        return {
          ...cut,
          elements: cut.elements.filter(el => el.id !== elementId)
        };
      }),
      selectedElementId: null
    }));
  };

  const updateElementContent = (elementId: string, content: string) => {
    // 모든 캔버스에서 해당 요소를 찾아서 업데이트
    pushHistory(prev => ({
      ...prev,
      cuts: prev.cuts.map(cut => {
        const hasElement = cut.elements.some(el => el.id === elementId);
        if (!hasElement) return cut;
        
        return {
          ...cut,
          elements: cut.elements.map(el => 
            el.id === elementId ? { ...el, content } : el
          )
        };
      })
    }));
  };


  // 생성된 이미지 삭제 함수
  const deleteGeneratedImage = (cutId: string) => {
    // 확인 다이얼로그
    if (window.confirm('정말로 생성된 이미지를 삭제하시겠습니까?\n삭제된 이미지는 복구할 수 없습니다.')) {
      pushHistory(prev => ({
        ...prev,
        cuts: prev.cuts.map(cut => 
          cut.id === cutId 
            ? { ...cut, imageUrl: undefined, generationId: undefined }
            : cut
        )
      }));
      
      // 성공 피드백 (선택사항)
    }
  };

  // 파일 업로드 함수
  const handleFileUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      const validTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
      return validTypes.includes(file.type);
    });

    if (validFiles.length === 0) {
      alert('JPG, PNG, SVG, WebP 파일만 업로드 가능합니다.');
      return;
    }

    setIsUploading(true);
    try {
      for (const file of validFiles) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/uploads', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (result.success) {
          const newImage = {
            id: result.data.id,
            name: result.data.name,
            url: result.data.url,
            type: result.data.type
          };
          console.log('업로드 성공:', newImage);
          setUploadedImages(prev => [...prev, newImage]);
          
          // 업로드 완료 후 파일 목록을 새로고침하여 최신 상태 유지
          await loadUploadedFiles();
        } else {
          console.error('업로드 실패:', result.error);
          alert(`파일 업로드 실패: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('파일 업로드 실패:', error);
      alert('파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  // 업로드된 파일 목록 불러오기
  const loadUploadedFiles = async () => {
    try {
      setIsLoadingFiles(true);
      const response = await fetch('/api/uploads');
      const result = await response.json();

      if (result.success) {
        setUploadedImages(result.data);
      } else {
        console.error('파일 목록 로딩 실패:', result.error);
      }
    } catch (error) {
      console.error('파일 목록 로딩 실패:', error);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // 파일 삭제 함수
  const handleFileDelete = async (fileId: string) => {
    try {
      const response = await fetch('/api/uploads', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId }),
      });

      const result = await response.json();

      if (result.success) {
        setUploadedImages(prev => prev.filter(img => img.id !== fileId));
      } else {
        console.error('삭제 실패:', result.error);
        alert(`파일 삭제 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('파일 삭제 실패:', error);
      alert('파일 삭제 중 오류가 발생했습니다.');
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  // 프로젝트 저장 함수
  const handleSave = async () => {
    if (!onSave) return;
    
    // 빈 캔버스 체크
    const hasContent = cuts.some(cut => {
      return cut.imageUrl || (cut.elements && cut.elements.length > 0) || cut.prompt?.trim();
    });
    
    if (!hasContent) {
      return;
    }
    
    setIsSaving(true);
    try {
      const panelsData = cuts.map(cut => ({
        id: cut.id,
        prompt: cut.prompt,
        imageUrl: cut.imageUrl,
        editData: {
          elements: cut.elements,
          canvasRatio: canvasRatio,
          selectedCharacters: selectedCharacters
        }
      }));
      
      await onSave(panelsData, initialData?.title);
    } catch (error) {
      console.error('저장 실패:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // 캔버스 다운로드 함수
  const downloadCanvas = async (cutId: string) => {
    const cut = cuts.find(c => c.id === cutId);
    if (!cut) return;

    try {
      // Canvas 생성
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 캔버스 크기 설정 (고해상도)
      const canvasSize = CANVAS_SIZES[canvasRatio];
      canvas.width = canvasSize.actualWidth;
      canvas.height = canvasSize.actualHeight;

      // 배경색 설정
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 배경 이미지가 있으면 그리기 (WebP → PNG 고품질 변환 포함)
      if (cut.imageUrl) {
        let imageToUse = cut.imageUrl;
        
        // 🚀 WebP 이미지인 경우 PNG로 변환하여 최고 품질 보장
        if (cut.imageUrl.includes('data:image/webp') || cut.imageUrl.includes('.webp')) {
          try {
            const response = await fetch('/api/images/convert-webp-to-png', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageUrl: cut.imageUrl })
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.success) {
                imageToUse = data.pngUrl;
              }
            }
          } catch (error) {
            console.warn('WebP → PNG 변환 실패, 원본 사용:', error);
          }
        }
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise((resolve, reject) => {
          img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(null);
          };
          img.onerror = reject;
          img.src = imageToUse;
        });
      }

      // 요소들 순차적으로 그리기 (async 처리)
      const scaleX = canvas.width / canvasSize.width;
      const scaleY = canvas.height / canvasSize.height;
      
      for (const element of cut.elements) {
        const x = element.x * scaleX;
        const y = element.y * scaleY;
        const width = element.width * scaleX;
        const height = element.height * scaleY;

        ctx.save();
        
        // 회전 적용 (모든 요소에 공통)
        if (element.rotation) {
          const centerX = x + width / 2;
          const centerY = y + height / 2;
          ctx.translate(centerX, centerY);
          ctx.rotate((element.rotation * Math.PI) / 180);
          ctx.translate(-centerX, -centerY);
        }

        if (element.type === 'text') {
          // 📝 편집 화면과 정확히 일치하는 텍스트 렌더링
          ctx.fillStyle = element.color || '#000000';
          
          // 🎯 폰트 설정 - 웹 폰트 로딩을 고려한 안전한 방식
          const fontFamily = element.fontFamily || STUDIO_FONTS[0].fontFamily;
          
          // Google Fonts 이름을 Canvas 호환 폰트명으로 매핑
          const fontMappings: Record<string, string> = {
            '"Noto Sans KR", sans-serif': 'Noto Sans KR',
            '"Noto Serif KR", serif': 'Noto Serif KR', 
            '"Nanum Gothic", sans-serif': 'Nanum Gothic',
            '"Nanum Pen Script", cursive': 'Nanum Pen Script',
            '"Black Han Sans", sans-serif': 'Black Han Sans',
            '"Jua", sans-serif': 'Jua',
            '"Dokdo", cursive': 'Dokdo',
            '"Cute Font", cursive': 'Cute Font',
            '"Gaegu", cursive': 'Gaegu',
            '"Gamja Flower", cursive': 'Gamja Flower'
          };
          
          const canvasFontFamily = fontMappings[fontFamily] || 
                                   fontFamily.replace(/['"]/g, '').split(',')[0].trim() || 
                                   'Arial';
          const fontWeight = element.fontWeight || 400;
          const fontStyle = element.fontStyle || 'normal';
          
          // 🎯 편집 화면과 정확히 동일한 폰트 크기 계산
          // 편집 화면: (fontSize || 16) * (zoom / 100)
          // 다운로드: (fontSize || 16) * scaleX (scaleX = actualWidth / displayWidth)
          const baseFontSize = element.fontSize || 16;
          const downloadFontSize = baseFontSize * scaleX;
          
          console.log('🎯 텍스트 렌더링 디버그:', {
            elementId: element.id,
            baseFontSize,
            scaleX,
            downloadFontSize,
            editorFontSize: `${baseFontSize} * (zoom/100) = ${baseFontSize * (zoom / 100)}`,
            canvasSize: { width: canvasSize.width, height: canvasSize.height },
            actualSize: { width: canvas.width, height: canvas.height }
          });
          
          // 🎯 Canvas에서 폰트가 확실히 로드되도록 fallback 체인 설정
          const fontString = `${fontStyle} ${fontWeight} ${downloadFontSize}px "${canvasFontFamily}", "Noto Sans KR", Arial, sans-serif`;
          ctx.font = fontString;
          
          // 폰트 로딩 확인 및 대기
          try {
            if (document.fonts && document.fonts.check) {
              const isLoaded = document.fonts.check(`${downloadFontSize}px "${canvasFontFamily}"`);
              if (!isLoaded) {
                console.warn(`⚠️ 폰트 미로드: ${canvasFontFamily}, fallback 사용`);
                // Fallback 폰트로 재설정
                ctx.font = `${fontStyle} ${fontWeight} ${downloadFontSize}px "Noto Sans KR", Arial, sans-serif`;
              }
            }
          } catch (e) {
            console.warn('폰트 체크 오류:', e);
          }
          
          // 텍스트 정렬 설정
          const textAlign = element.textAlign || 'center';
          ctx.textAlign = textAlign === 'justify' ? 'left' : textAlign;
          ctx.textBaseline = 'middle';
          
          // 🎯 편집 화면과 정확히 일치하는 패딩 (p-2 = 8px를 비례적으로 스케일)
          const basePadding = 8;
          const paddingX = basePadding * scaleX;
          const paddingY = basePadding * scaleY;
          const textAreaX = x + paddingX;
          const textAreaY = y + paddingY;
          const textAreaWidth = width - (paddingX * 2);
          const textAreaHeight = height - (paddingY * 2);
          
          const lines = (element.content || '').split('\n');
          // 🎯 편집 화면과 동일한 라인 높이 계산
          const lineHeight = downloadFontSize * 1.2;
          const totalTextHeight = lines.length * lineHeight;
          
          // 수직 정렬을 위한 시작 Y 좌표 계산
          const startY = textAreaY + (textAreaHeight - totalTextHeight) / 2 + lineHeight / 2;
          
          lines.forEach((line, index) => {
            if (!line.trim()) return; // 빈 줄 스킵
            
            const lineY = startY + (index * lineHeight);
            
            // 수평 정렬에 따른 X 좌표 계산
            let textX;
            if (textAlign === 'left') {
              textX = textAreaX;
            } else if (textAlign === 'right') {
              textX = textAreaX + textAreaWidth;
            } else { // center 또는 justify
              textX = textAreaX + textAreaWidth / 2;
            }
            
            console.log('🎯 텍스트 라인 렌더링:', {
              line: line.substr(0, 20) + '...',
              textX,
              lineY,
              font: ctx.font,
              color: ctx.fillStyle,
              visible: textX >= 0 && textX <= canvas.width && lineY >= 0 && lineY <= canvas.height
            });
            
            // 그림자 그리기
            if (element.textShadow) {
              ctx.save();
              const shadowColor = element.textShadowColor || '#000000';
              ctx.fillStyle = shadowColor + '80'; // 50% 투명도
              ctx.fillText(line, textX + 2, lineY + 2);
              ctx.restore();
            }
            
            // 외곽선 그리기
            if (element.textStroke) {
              ctx.save();
              const strokeColor = element.textStrokeColor || '#ffffff';
              const strokeWidth = element.textStrokeWidth || 2;
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = strokeWidth * scaleX;
              ctx.strokeText(line, textX, lineY);
              ctx.restore();
            }
            
            // 메인 텍스트 그리기
            ctx.fillStyle = element.color || '#000000';
            ctx.fillText(line, textX, lineY);
          });
          
        } else if (element.type === 'bubble') {
          // 🎈 SVG 템플릿을 사용한 정확한 말풍선 렌더링
          if (element.templateId) {
            try {
              const template = BUBBLE_TEMPLATES.find(t => t.id === element.templateId);
              if (template) {
                const response = await fetch(`/bubbles/${template.fileName}`);
                if (response.ok) {
                  let svgContent = await response.text();
                  
                  // 색상 및 스타일 적용
                  svgContent = svgContent
                    .replace(/fill="[^"]*"/g, `fill="${element.fillColor || '#ffffff'}"`)
                    .replace(/stroke="[^"]*"/g, `stroke="${element.strokeColor || '#333333'}"`)
                    .replace(/stroke-width="[^"]*"/g, `stroke-width="${element.strokeWidth || 2}"`)
                    .replace(/preserveAspectRatio="[^"]*"/g, 'preserveAspectRatio="none"')
                    .replace(/<svg/, `<svg preserveAspectRatio="none" width="${width}" height="${height}"`);
                  
                  // SVG를 이미지로 변환하여 Canvas에 그리기
                  const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
                  const svgUrl = URL.createObjectURL(svgBlob);
                  
                  const img = new Image();
                  await new Promise((resolve, reject) => {
                    img.onload = () => {
                      ctx.drawImage(img, x, y, width, height);
                      URL.revokeObjectURL(svgUrl);
                      resolve(null);
                    };
                    img.onerror = reject;
                    img.src = svgUrl;
                  });
                } else {
                  throw new Error('템플릿 로드 실패');
                }
              } else {
                throw new Error('템플릿 없음');
              }
            } catch (error) {
              console.warn('SVG 템플릿 렌더링 실패, 기본 모양 사용:', error);
              // 폴백: 기본 말풍선
              ctx.fillStyle = element.fillColor || '#ffffff';
              ctx.strokeStyle = element.strokeColor || '#333333';
              ctx.lineWidth = (element.strokeWidth || 2) * scaleX;
              
              ctx.beginPath();
              ctx.roundRect(x, y, width, height, 10 * scaleX);
              ctx.fill();
              ctx.stroke();
            }
          } else {
            // 기본 말풍선 (둥근 사각형)
            ctx.fillStyle = element.fillColor || '#ffffff';
            ctx.strokeStyle = element.strokeColor || '#333333';
            ctx.lineWidth = (element.strokeWidth || 2) * scaleX;
            
            ctx.beginPath();
            ctx.roundRect(x, y, width, height, 10 * scaleX);
            ctx.fill();
            ctx.stroke();
          }
          
        } else if (element.type === 'image' && element.imageUrl) {
          // 이미지 그리기
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = () => {
              ctx.drawImage(img, x, y, width, height);
              resolve(null);
            };
            img.onerror = reject;
            img.src = element.imageUrl;
          });
        }
        
        ctx.restore();
      }

      // 다운로드
      const link = document.createElement('a');
      link.download = `웹툰-패널-${cuts.findIndex(c => c.id === cutId) + 1}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

    } catch (error) {
      console.error('다운로드 실패:', error);
      alert('다운로드 중 오류가 발생했습니다.');
    }
  };

  // 전체 웹툰 다운로드 함수
  const downloadAllCanvases = async () => {
    try {
      // JSZip 라이브러리가 필요하지만, 우선 개별 다운로드로 구현
      for (let i = 0; i < cuts.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5초 간격
        await downloadCanvas(cuts[i].id);
      }
    } catch (error) {
      console.error('전체 다운로드 실패:', error);
      alert('전체 다운로드 중 오류가 발생했습니다.');
    }
  };

  // 메모이제이션을 통한 성능 최적화
  const selectedCut = useMemo(() => 
    cuts.find(cut => cut.id === selectedCutId), 
    [cuts, selectedCutId]
  );
  
  const selectedCutIndex = useMemo(() => 
    cuts.findIndex(cut => cut.id === selectedCutId), 
    [cuts, selectedCutId]
  );
  
  const selectedElement = useMemo(() => 
    selectedCut?.elements.find(el => el.id === selectedElementId), 
    [selectedCut?.elements, selectedElementId]
  );

  // useCallback을 사용한 드래그 이벤트 핸들러들
  const handleBubbleTemplateSelect = useCallback((templateId: string) => {
    addBubbleFromTemplate(templateId);
  }, [addBubbleFromTemplate]);

  const handleTemplateDragStart = useCallback((e: React.DragEvent, templateId: string) => {
    setIsDraggingBubble(true);
    setDraggedBubbleId(templateId);
    e.dataTransfer.setData('bubbleId', templateId);
  }, []);

  const handleTemplateDragEnd = useCallback(() => {
    setIsDraggingBubble(false);
    setDraggedBubbleId(null);
  }, []);

  // AI 캐릭터 생성 함수
  const handleGenerateCharacter = useCallback(async () => {
    if (!characterDescription.trim()) {
      alert('캐릭터 설명을 입력해주세요.');
      return;
    }
    
    if (!characterName.trim()) {
      alert('캐릭터 이름을 입력해주세요.');
      return;
    }

    try {
      // 🎯 캐릭터 탭으로 자동 이동하고 로딩 시작
      setActiveTab('ai-character');
      setIsGeneratingCharacter(true);

      // 멤버십 제한 확인
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }

      const { data: userData } = await supabase
        .from('user')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!userData) {
        throw new Error('사용자 정보를 찾을 수 없습니다');
      }

      // 멤버십 정보 확인
      const { data: subscriptionData } = await supabase
        .from('subscription')
        .select('plan')
        .eq('userId', userData.id)
        .single();

      const userPlan = subscriptionData?.plan || 'FREE';

      // 현재 사용자가 등록한 캐릭터 수 확인
      const { count: currentCharacterCount } = await supabase
        .from('character')
        .select('*', { count: 'exact' })
        .eq('userId', userData.id);

      // 멤버십별 캐릭터 등록 제한 확인
      const maxCharacters = userPlan === 'FREE' ? 1 : userPlan === 'PRO' ? 3 : 5;
      
      if ((currentCharacterCount || 0) >= maxCharacters) {
        throw new Error(`${userPlan} 플랜은 최대 ${maxCharacters}개의 캐릭터만 등록할 수 있습니다. 업그레이드를 고려해보세요.`);
      }
      
      const response = await fetch('/api/ai/character/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: characterDescription,
          style: 'character_reference',
          aspectRatio: '1:1' // 1:1 비율로 고정
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'AI 캐릭터 생성에 실패했습니다.');
      }

      const result = await response.json();
      setGeneratedCharacterUrl(result.imageUrl);
      
    } catch (error) {
      console.error('캐릭터 생성 실패:', error);
      alert(error instanceof Error ? error.message : '캐릭터 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingCharacter(false);
    }
  }, [characterDescription, characterName]);

  // 생성된 캐릭터를 DB에 저장하는 함수 (비차단 처리)
  const handleAddCharacterToDB = useCallback(async () => {
    if (!generatedCharacterUrl) return;

    try {
      setIsAddingCharacterToDB(true);
      
      // 사용자 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }

      // 사용자 데이터 조회
      const { data: userData } = await supabase
        .from('user')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!userData) {
        throw new Error('사용자 정보를 찾을 수 없습니다');
      }

      // 멤버십 정보 확인
      const { data: subscriptionData } = await supabase
        .from('subscription')
        .select('plan')
        .eq('userId', userData.id)
        .single();

      const userPlan = subscriptionData?.plan || 'FREE';

      // 현재 사용자가 등록한 캐릭터 수 확인
      const { count: currentCharacterCount } = await supabase
        .from('character')
        .select('*', { count: 'exact' })
        .eq('userId', userData.id);

      // 멤버십별 캐릭터 등록 제한 확인
      const maxCharacters = userPlan === 'FREE' ? 1 : userPlan === 'PRO' ? 3 : 5;
      
      if ((currentCharacterCount || 0) >= maxCharacters) {
        throw new Error(`${userPlan} 플랜은 최대 ${maxCharacters}개의 캐릭터만 등록할 수 있습니다. 업그레이드를 고려해보세요.`);
      }

      // 사용자가 입력한 캐릭터명 사용
      const finalCharacterName = characterName.trim() || '새 캐릭터';
      
      // 이미지 URL과 레퍼런스 이미지 설정
      const referenceImages = [generatedCharacterUrl];

      // 1. 즉시 캐릭터 데이터베이스에 기본 정보 저장 (빠른 반응)
      const { data: character, error } = await supabase
        .from('character')
        .insert({
          userId: userData.id,
          name: finalCharacterName,
          description: characterDescription.trim(),
          referenceImages: referenceImages,
          ratioImages: null, // 처음에는 null로 저장
          thumbnailUrl: generatedCharacterUrl,
          isPublic: false,
          isFavorite: false
        })
        .select()
        .single();

      if (error) throw error;

      // 2. 기본 저장 완료 후 UI 초기화는 나중에
      setCharacterDescription('');
      setGeneratedCharacterUrl(null);
      
      // 성공 메시지 표시
      alert('캐릭터가 등록되었습니다! 다양한 비율 이미지를 생성 중입니다...');

      // 3. 백그라운드에서 멀티 비율 이미지 처리 (비차단)
      
      // 백그라운드 처리 시작 (비동기)
      fetch('/api/characters/process-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          referenceImages,
          userId: userData.id
        })
      })
      .then(response => response.json())
      .then(async (processingResult) => {
        if (processingResult.success && processingResult.ratioImages) {
          
          // 4. 처리 완료 후 데이터베이스 업데이트
          await supabase
            .from('character')
            .update({ ratioImages: processingResult.ratioImages })
            .eq('id', character.id);
            
        } else {
          console.error('❌ 백그라운드 multi-ratio processing 실패:', processingResult.error);
        }
        
        // 5. 모든 처리 완료 후 로딩 상태 해제
        setIsAddingCharacterToDB(false);
      })
      .catch((processingError) => {
        console.error('❌ 백그라운드 multi-ratio processing API 오류:', processingError);
        // 에러 시에도 로딩 상태 해제
        setIsAddingCharacterToDB(false);
      });
      
    } catch (error) {
      console.error('캐릭터 생성 실패:', error);
      alert(error instanceof Error ? error.message : '캐릭터 생성 중 오류가 발생했습니다.');
      setIsAddingCharacterToDB(false);
    }
  }, [generatedCharacterUrl, characterDescription, supabase]);

  const menuItems = [
    { id: 'bubble', label: '말풍선', icon: MessageSquare },
    { id: 'text', label: '텍스트', icon: Type },
    { id: 'ai-character', label: 'AI 캐릭터', icon: UserPlus },
    { id: 'upload', label: '업로드', icon: Upload }
  ];

  const quickDialogues = ['안녕?', '뭐야!', '정말?', '좋아!', '싫어', '어?', '와!', '헉!'];

  // 패널 로딩 중일 때 로딩 화면 표시
  if (!panelsLoaded) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">프로젝트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 overflow-hidden">
      {/* 상단 헤더 - 고정 */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-6">
          {/* GenToon 로고 - 클릭하면 메인으로 이동 */}
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img 
              src="/gentoon.webp" 
              alt="GenToon" 
              className="h-8 w-8 object-contain"
            />
            <span className="text-2xl font-bold">GenToon</span>
          </a>
          
          {/* 프로젝트 저장 버튼 - 추가 */}
          <Button
            onClick={handleSaveProject}
            disabled={isSaving}
            className={cn(
              "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white transition-all duration-200",
              hasUnsavedChanges && "animate-pulse shadow-lg shadow-purple-500/50 ring-2 ring-purple-300"
            )}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                프로젝트 저장
              </>
            )}
          </Button>
          
          {/* 캔버스 크기 선택 - 개선된 반응형 디자인 */}
          {/* 초대형 화면 (2xl+): 아이콘 + 텍스트 + 해상도 */}
          <div className="hidden 2xl:flex items-center bg-slate-100 rounded-lg overflow-hidden">
            <button
              className={cn(
                "flex items-center gap-2 px-4 py-2 transition-all text-sm font-medium whitespace-nowrap",
                canvasRatio === '4:5' 
                  ? "bg-white shadow-sm text-purple-600 border-r border-purple-200" 
                  : "text-slate-600 hover:text-slate-900",
                cuts.some(cut => cut.imageUrl) && canvasRatio !== '4:5' && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => {
                if (cuts.some(cut => cut.imageUrl) && canvasRatio !== '4:5') {
                  alert('이미지가 생성된 컷이 있어 비율을 변경할 수 없습니다.\n새 프로젝트를 만들거나 이미지를 삭제한 후 비율을 변경하세요.');
                  return;
                }
                setCanvasRatio('4:5');
              }}
            >
              <RectangleVertical className="h-4 w-4 flex-shrink-0" />
              <span>{CANVAS_SIZES['4:5'].label}</span>
              <span className="text-xs text-slate-400">{CANVAS_SIZES['4:5'].actualWidth}×{CANVAS_SIZES['4:5'].actualHeight}</span>
            </button>
            <button
              className={cn(
                "flex items-center gap-2 px-4 py-2 transition-all text-sm font-medium whitespace-nowrap relative",
                canvasRatio === '1:1' 
                  ? "bg-white shadow-sm text-purple-600 border-l border-purple-200" 
                  : "text-slate-600 hover:text-slate-900",
                cuts.some(cut => cut.imageUrl) && canvasRatio !== '1:1' && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => {
                if (cuts.some(cut => cut.imageUrl) && canvasRatio !== '1:1') {
                  alert('이미지가 생성된 컷이 있어 비율을 변경할 수 없습니다.\n새 프로젝트를 만들거나 이미지를 삭제한 후 비율을 변경하세요.');
                  return;
                }
                setCanvasRatio('1:1');
              }}
            >
              <Square className="h-4 w-4 flex-shrink-0" />
              <span>{CANVAS_SIZES['1:1'].label}</span>
              <span className="text-xs text-slate-400">{CANVAS_SIZES['1:1'].actualWidth}×{CANVAS_SIZES['1:1'].actualHeight}</span>
              {cuts.some(cut => cut.imageUrl) && canvasRatio !== '1:1' && (
                <Lock className="h-3 w-3 text-slate-400 ml-1" />
              )}
            </button>
          </div>
          
          {/* 중형 화면 (lg-2xl): 아이콘 + 텍스트만 (해상도 숨김) */}
          <div className="hidden lg:flex 2xl:hidden items-center bg-slate-100 rounded-lg overflow-hidden">
            <button
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 transition-all text-sm font-medium whitespace-nowrap min-w-0",
                canvasRatio === '4:5' 
                  ? "bg-white shadow-sm text-purple-600 border-r border-purple-200" 
                  : "text-slate-600 hover:text-slate-900",
                cuts.some(cut => cut.imageUrl) && canvasRatio !== '4:5' && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => {
                if (cuts.some(cut => cut.imageUrl) && canvasRatio !== '4:5') {
                  alert('이미지가 생성된 컷이 있어 비율을 변경할 수 없습니다.\n새 프로젝트를 만들거나 이미지를 삭제한 후 비율을 변경하세요.');
                  return;
                }
                setCanvasRatio('4:5');
              }}
            >
              <RectangleVertical className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate text-xs">{CANVAS_SIZES['4:5'].label}</span>
            </button>
            <button
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 transition-all text-sm font-medium whitespace-nowrap min-w-0",
                canvasRatio === '1:1' 
                  ? "bg-white shadow-sm text-purple-600 border-l border-purple-200" 
                  : "text-slate-600 hover:text-slate-900",
                cuts.some(cut => cut.imageUrl) && canvasRatio !== '1:1' && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => {
                if (cuts.some(cut => cut.imageUrl) && canvasRatio !== '1:1') {
                  alert('이미지가 생성된 컷이 있어 비율을 변경할 수 없습니다.\n새 프로젝트를 만들거나 이미지를 삭제한 후 비율을 변경하세요.');
                  return;
                }
                setCanvasRatio('1:1');
              }}
            >
              <Square className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate text-xs">{CANVAS_SIZES['1:1'].label}</span>
              {cuts.some(cut => cut.imageUrl) && canvasRatio !== '1:1' && (
                <Lock className="h-2.5 w-2.5 text-slate-400 ml-1" />
              )}
            </button>
          </div>

          {/* 소형 화면 (lg 미만): 아이콘만 + 툴팁 */}
          <div className="flex lg:hidden items-center bg-slate-100 rounded-lg overflow-hidden">
            <button
              className={cn(
                "flex items-center justify-center p-2.5 transition-all",
                canvasRatio === '4:5' 
                  ? "bg-white shadow-sm text-purple-600" 
                  : "text-slate-600 hover:text-slate-900",
                cuts.some(cut => cut.imageUrl) && canvasRatio !== '4:5' && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => {
                if (cuts.some(cut => cut.imageUrl) && canvasRatio !== '4:5') {
                  alert('이미지가 생성된 컷이 있어 비율을 변경할 수 없습니다.');
                  return;
                }
                setCanvasRatio('4:5');
              }}
              title={`${CANVAS_SIZES['4:5'].label} (${CANVAS_SIZES['4:5'].actualWidth}×${CANVAS_SIZES['4:5'].actualHeight})`}
            >
              <RectangleVertical className="h-4 w-4" />
            </button>
            <button
              className={cn(
                "flex items-center justify-center p-2.5 transition-all relative",
                canvasRatio === '1:1' 
                  ? "bg-white shadow-sm text-purple-600" 
                  : "text-slate-600 hover:text-slate-900",
                cuts.some(cut => cut.imageUrl) && canvasRatio !== '1:1' && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => {
                if (cuts.some(cut => cut.imageUrl) && canvasRatio !== '1:1') {
                  alert('이미지가 생성된 컷이 있어 비율을 변경할 수 없습니다.');
                  return;
                }
                setCanvasRatio('1:1');
              }}
              title={`${CANVAS_SIZES['1:1'].label} (${CANVAS_SIZES['1:1'].actualWidth}×${CANVAS_SIZES['1:1'].actualHeight}) ${cuts.some(cut => cut.imageUrl) && canvasRatio !== '1:1' ? '- 잠금됨' : ''}`}
            >
              <Square className="h-4 w-4" />
              {cuts.some(cut => cut.imageUrl) && canvasRatio !== '1:1' && (
                <Lock className="h-2 w-2 text-slate-400 absolute -top-0.5 -right-0.5" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 w-9 p-0 relative group"
              onClick={undo}
              disabled={!canUndo}
              title="실행 취소 (Ctrl+Z)"
            >
              <Undo className={cn("h-4 w-4", canUndo ? "text-slate-700" : "text-slate-300")} />
              {canUndo && (
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs bg-slate-800 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  실행 취소
                </span>
              )}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 w-9 p-0 relative group"
              onClick={redo}
              disabled={!canRedo}
              title="다시 실행 (Ctrl+Y)"
            >
              <Redo className={cn("h-4 w-4", canRedo ? "text-slate-700" : "text-slate-300")} />
              {canRedo && (
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs bg-slate-800 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  다시 실행
                </span>
              )}
            </Button>
          </div>
          <div className="w-px h-6 bg-slate-200" />
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-9 px-3"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4 mr-2" />
                저장
              </>
            )}
          </Button>
          <Button 
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-9 px-4" 
            size="sm"
            onClick={downloadAllCanvases}
          >
            <Download className="h-4 w-4 mr-2" />
            다운로드
          </Button>
        </div>
      </header>

      {/* 메인 워크스페이스 - 고정 높이 */}
      <main className="flex-1 flex overflow-hidden">
        {/* 왼쪽 사이드바 - 독립 스크롤 */}
        <aside className="w-80 bg-white border-r border-slate-200 flex flex-shrink-0">
          {/* 메뉴 탭 */}
          <div className="w-20 bg-slate-50 border-r border-slate-200 flex-shrink-0">
            <div className="py-4">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={cn(
                      "w-full px-3 py-4 flex flex-col items-center gap-2 transition-all hover:bg-white",
                      activeTab === item.id && "bg-white border-r-2 border-purple-500 text-purple-600"
                    )}
                  >
                    <Icon className={cn(
                      "h-6 w-6",
                      activeTab === item.id ? "text-purple-600" : "text-slate-500"
                    )} />
                    <span className={cn(
                      "text-xs font-medium text-center leading-tight",
                      activeTab === item.id ? "text-purple-600" : "text-slate-500"
                    )}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 컨텐츠 패널 - 독립 스크롤 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex-shrink-0">
              <h3 className="font-semibold text-slate-900 mb-3">
                {menuItems.find(item => item.id === activeTab)?.label}
              </h3>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              {/* 선택된 요소 속성 편집 패널 - 해당 탭에서만 표시 */}
              {selectedElementId && (() => {
                const element = cuts.find(cut => cut.id === selectedCutId)?.elements.find(el => el.id === selectedElementId);
                if (!element) return false;
                
                // 요소 타입과 현재 탭이 일치할 때만 속성 편집 패널 표시
                return (
                  (element.type === 'bubble' && activeTab === 'bubble') ||
                  (element.type === 'text' && activeTab === 'text')
                );
              })() && (
                <div className="space-y-4 pb-6 mb-6 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-slate-900">속성 편집</h4>
                    <button 
                      onClick={() => setSelectedElementId(null)}
                      className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {(() => {
                    const element = cuts.find(cut => cut.id === selectedCutId)?.elements.find(el => el.id === selectedElementId);
                    if (!element) return null;
                    
                    return (
                      <>
                        {/* 📝 고급 텍스트 편집 패널 */}
                        {element.type === 'text' && (
                          <div className="space-y-4">
                            {/* 🎨 캔바급 폰트 선택기 */}
                            <div>
                              <label className="text-sm font-medium text-slate-700 mb-2 block">
                                폰트
                              </label>
                              <FontSelector
                                selectedFontFamily={element.fontFamily || STUDIO_FONTS[0]?.fontFamily || 'Noto Sans KR'}
                                selectedFontWeight={element.fontWeight || 400}
                                onFontChange={handleFontChange}
                                className="w-full"
                              />
                            </div>


                            {/* 📏 폰트 크기 컨트롤 */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex items-center border border-slate-300 rounded-lg">
                                <button
                                  onClick={() => {
                                    const newSize = Math.max((element.fontSize || 14) - 1, 8);
                                    updateElementProperty(selectedElementId!, { fontSize: newSize });
                                  }}
                                  className="flex-shrink-0 p-2 hover:bg-slate-50 transition-colors"
                                >
                                  <Minus className="h-4 w-4 text-slate-600" />
                                </button>
                                <input
                                  type="number"
                                  value={element.fontSize || 14}
                                  onChange={(e) => {
                                    const size = Math.max(Math.min(parseInt(e.target.value) || 14, 200), 8);
                                    updateElementProperty(selectedElementId!, { fontSize: size });
                                  }}
                                  className="flex-1 text-center border-none outline-none py-2 text-sm font-medium bg-transparent"
                                  min="8"
                                  max="200"
                                />
                                <button
                                  onClick={() => {
                                    const newSize = Math.min((element.fontSize || 14) + 1, 200);
                                    updateElementProperty(selectedElementId!, { fontSize: newSize });
                                  }}
                                  className="flex-shrink-0 p-2 hover:bg-slate-50 transition-colors"
                                >
                                  <Plus className="h-4 w-4 text-slate-600" />
                                </button>
                              </div>

                              {/* 📐 텍스트 스타일 버튼 */}
                              <div className="grid grid-cols-4 gap-1">
                                <button
                                  onClick={() => {
                                    const currentWeight = element.fontWeight || 'normal';
                                    updateElementProperty(selectedElementId!, { 
                                      fontWeight: currentWeight === 'bold' ? 'normal' : 'bold' 
                                    });
                                  }}
                                  className={`p-2 border border-slate-300 rounded hover:bg-slate-50 transition-colors ${
                                    element.fontWeight === 'bold' ? 'bg-slate-100' : ''
                                  }`}
                                >
                                  <Bold className="h-4 w-4 text-slate-700" />
                                </button>
                                <button
                                  onClick={() => {
                                    const currentStyle = element.fontStyle || 'normal';
                                    updateElementProperty(selectedElementId!, { 
                                      fontStyle: currentStyle === 'italic' ? 'normal' : 'italic' 
                                    });
                                  }}
                                  className={`p-2 border border-slate-300 rounded hover:bg-slate-50 transition-colors ${
                                    element.fontStyle === 'italic' ? 'bg-slate-100' : ''
                                  }`}
                                >
                                  <Italic className="h-4 w-4 text-slate-700" />
                                </button>
                                <button
                                  onClick={() => {
                                    const currentDecoration = element.textDecoration || 'none';
                                    updateElementProperty(selectedElementId!, { 
                                      textDecoration: currentDecoration === 'underline' ? 'none' : 'underline' 
                                    });
                                  }}
                                  className={`p-2 border border-slate-300 rounded hover:bg-slate-50 transition-colors ${
                                    element.textDecoration === 'underline' ? 'bg-slate-100' : ''
                                  }`}
                                >
                                  <Underline className="h-4 w-4 text-slate-700" />
                                </button>
                                <button
                                  className="p-2 border border-slate-300 rounded hover:bg-slate-50 transition-colors"
                                  title="더 많은 옵션"
                                >
                                  <MoreHorizontal className="h-4 w-4 text-slate-700" />
                                </button>
                              </div>
                            </div>

                            {/* 📐 텍스트 정렬 */}
                            <div className="grid grid-cols-4 gap-1">
                              {[
                                { align: 'left', icon: AlignLeft },
                                { align: 'center', icon: AlignCenter },
                                { align: 'right', icon: AlignRight },
                                { align: 'justify', icon: AlignJustify }
                              ].map(({ align, icon: Icon }) => (
                                <button
                                  key={align}
                                  onClick={() => {
                                    updateElementProperty(selectedElementId!, { textAlign: align });
                                  }}
                                  className={`p-2 border border-slate-300 rounded hover:bg-slate-50 transition-colors ${
                                    (element.textAlign || 'center') === align ? 'bg-slate-100' : ''
                                  }`}
                                >
                                  <Icon className="h-4 w-4 text-slate-700" />
                                </button>
                              ))}
                            </div>

                            {/* 🎨 텍스트 색상 */}
                            <div className="space-y-4">
                              {/* 텍스트 색상 섹션 */}
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <label className="text-sm font-medium text-slate-700">
                                    텍스트 색상
                                  </label>
                                  <div 
                                    className="w-6 h-6 rounded border border-slate-300 shadow-sm"
                                    style={{ backgroundColor: element.color || '#000000' }}
                                  />
                                </div>
                                <input
                                  type="color"
                                  value={element.color || '#000000'}
                                  onChange={(e) => {
                                    updateElementPropertyDebounced(selectedElementId!, { color: e.target.value });
                                  }}
                                  className="w-full h-10 rounded-lg border border-slate-300 cursor-pointer shadow-sm"
                                />
                              </div>

                              {/* 🖋️ 외곽선 섹션 */}
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <label className="text-sm font-medium text-slate-700">
                                    외곽선
                                  </label>
                                  <button
                                    onClick={() => {
                                      const hasStroke = element.textStroke;
                                      updateElementProperty(selectedElementId!, { 
                                        textStroke: hasStroke ? undefined : '2px #ffffff',
                                        textStrokeColor: hasStroke ? undefined : '#ffffff',
                                        textStrokeWidth: hasStroke ? undefined : 2
                                      });
                                    }}
                                    className={`w-8 h-8 rounded-lg border transition-all duration-200 flex items-center justify-center ${
                                      element.textStroke 
                                        ? 'bg-purple-500 border-purple-500 shadow-md' 
                                        : 'border-slate-300 hover:border-slate-400'
                                    }`}
                                  >
                                    {element.textStroke && <Check className="h-4 w-4 text-white" />}
                                  </button>
                                </div>
                                
                                {element.textStroke && (
                                  <div className="space-y-3 bg-slate-50 p-3 rounded-lg">
                                    {/* 외곽선 색상 */}
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-medium text-slate-600">색상</span>
                                      <div 
                                        className="w-5 h-5 rounded border border-slate-300 shadow-sm"
                                        style={{ backgroundColor: element.textStrokeColor || '#ffffff' }}
                                      />
                                    </div>
                                    <input
                                      type="color"
                                      value={element.textStrokeColor || '#ffffff'}
                                      onChange={(e) => {
                                        updateElementPropertyDebounced(selectedElementId!, { 
                                          textStrokeColor: e.target.value,
                                          textStroke: `${element.textStrokeWidth || 2}px ${e.target.value}`
                                        });
                                      }}
                                      className="w-full h-8 rounded border border-slate-300 cursor-pointer"
                                    />
                                    
                                    {/* 외곽선 굵기 */}
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-slate-600">굵기</span>
                                        <span className="text-xs text-slate-500">{element.textStrokeWidth || 2}px</span>
                                      </div>
                                      <div className="flex gap-1">
                                        {[1, 2, 3, 4, 6, 8].map((width) => (
                                          <button
                                            key={width}
                                            onClick={() => {
                                              updateElementProperty(selectedElementId!, {
                                                textStrokeWidth: width,
                                                textStroke: `${width}px ${element.textStrokeColor || '#ffffff'}`
                                              });
                                            }}
                                            className={`flex-1 py-1.5 px-2 text-xs rounded border transition-all ${
                                              (element.textStrokeWidth || 2) === width
                                                ? 'bg-purple-500 text-white border-purple-500 shadow-sm'
                                                : 'bg-white border-slate-300 hover:border-slate-400 text-slate-700'
                                            }`}
                                          >
                                            {width}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* 🎨 그림자 */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-slate-700">
                                  그림자
                                </label>
                                <button
                                  onClick={() => {
                                    const hasShadow = element.textShadow;
                                    updateElementProperty(selectedElementId!, { 
                                      textShadow: hasShadow ? undefined : '2px 2px 4px rgba(0,0,0,0.3)'
                                    });
                                  }}
                                  className={`w-6 h-6 rounded border transition-colors ${
                                    element.textShadow ? 'bg-purple-500 border-purple-500' : 'border-slate-300'
                                  }`}
                                >
                                  {element.textShadow && <Check className="h-3 w-3 text-white" />}
                                </button>
                              </div>
                              <input
                                type="color"
                                value={element.textShadowColor || '#000000'}
                                onChange={(e) => {
                                  updateElementPropertyDebounced(selectedElementId!, { 
                                    textShadowColor: e.target.value,
                                    textShadow: `2px 2px 4px ${e.target.value}80`
                                  });
                                }}
                                disabled={!element.textShadow}
                                className="w-full h-10 rounded border border-slate-300 cursor-pointer disabled:opacity-50"
                              />
                            </div>

                          </div>
                        )}

                        {/* 공통: 위치 및 크기 */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">
                              X 위치
                            </label>
                            <Input
                              type="number"
                              value={Math.round(element.x)}
                              onChange={(e) => {
                                const newX = parseInt(e.target.value) || 0;
                                setCuts(cuts.map(cut => ({
                                  ...cut,
                                  elements: cut.elements.map(el => 
                                    el.id === selectedElementId 
                                      ? { ...el, x: newX }
                                      : el
                                  )
                                })));
                              }}
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">
                              Y 위치
                            </label>
                            <Input
                              type="number"
                              value={Math.round(element.y)}
                              onChange={(e) => {
                                const newY = parseInt(e.target.value) || 0;
                                setCuts(cuts.map(cut => ({
                                  ...cut,
                                  elements: cut.elements.map(el => 
                                    el.id === selectedElementId 
                                      ? { ...el, y: newY }
                                      : el
                                  )
                                })));
                              }}
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">
                              너비
                            </label>
                            <Input
                              type="number"
                              value={Math.round(element.width)}
                              onChange={(e) => {
                                const newWidth = parseInt(e.target.value) || 0;
                                setCuts(cuts.map(cut => ({
                                  ...cut,
                                  elements: cut.elements.map(el => 
                                    el.id === selectedElementId 
                                      ? { ...el, width: newWidth }
                                      : el
                                  )
                                })));
                              }}
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">
                              높이
                            </label>
                            <Input
                              type="number"
                              value={Math.round(element.height)}
                              onChange={(e) => {
                                const newHeight = parseInt(e.target.value) || 0;
                                setCuts(cuts.map(cut => ({
                                  ...cut,
                                  elements: cut.elements.map(el => 
                                    el.id === selectedElementId 
                                      ? { ...el, height: newHeight }
                                      : el
                                  )
                                })));
                              }}
                              className="text-sm"
                            />
                          </div>
                        </div>

                      </>
                    );
                  })()}
                </div>
              )}

              {activeTab === 'bubble' && (
                <div className="space-y-4">

                  {/* 말풍선 라이브러리 - 가상화된 리스트 사용 */}
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                      말풍선 선택
                    </label>
                    <VirtualizedTemplateList
                      selectedCategory="all"
                      onTemplateSelect={handleBubbleTemplateSelect}
                      onDragStart={handleTemplateDragStart}
                      onDragEnd={handleTemplateDragEnd}
                      isDraggingBubble={isDraggingBubble}
                      draggedBubbleId={draggedBubbleId}
                    />
                  </div>

                  {/* 선택된 말풍선 색상 편집 */}
                  {selectedElementId && selectedElement?.type === 'bubble' && (
                    <div className="mt-6 space-y-4 pt-4 border-t border-slate-200">
                      <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        선택된 말풍선 속성
                      </h4>
                      
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-slate-700 block">
                          말풍선 색상
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-slate-600 mb-1 block">
                              배경색
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={selectedElement.fillColor || '#ffffff'}
                                onChange={(e) => {
                                  setCuts(cuts.map(cut => ({
                                    ...cut,
                                    elements: cut.elements.map(el => 
                                      el.id === selectedElementId 
                                        ? { ...el, fillColor: e.target.value }
                                        : el
                                    )
                                  })));
                                }}
                                className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={selectedElement.fillColor || '#ffffff'}
                                onChange={(e) => {
                                  setCuts(cuts.map(cut => ({
                                    ...cut,
                                    elements: cut.elements.map(el => 
                                      el.id === selectedElementId 
                                        ? { ...el, fillColor: e.target.value }
                                        : el
                                    )
                                  })));
                                }}
                                className="text-xs flex-1"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-slate-600 mb-1 block">
                              테두리색
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={selectedElement.strokeColor || '#333333'}
                                onChange={(e) => {
                                  setCuts(cuts.map(cut => ({
                                    ...cut,
                                    elements: cut.elements.map(el => 
                                      el.id === selectedElementId 
                                        ? { ...el, strokeColor: e.target.value }
                                        : el
                                    )
                                  })));
                                }}
                                className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={selectedElement.strokeColor || '#333333'}
                                onChange={(e) => {
                                  setCuts(cuts.map(cut => ({
                                    ...cut,
                                    elements: cut.elements.map(el => 
                                      el.id === selectedElementId 
                                        ? { ...el, strokeColor: e.target.value }
                                        : el
                                    )
                                  })));
                                }}
                                className="text-xs flex-1"
                              />
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-slate-600 mb-1 block">
                            테두리 두께
                          </label>
                          <Input
                            type="number"
                            min="1"
                            max="10"
                            value={selectedElement.strokeWidth || 2}
                            onChange={(e) => {
                              setCuts(cuts.map(cut => ({
                                ...cut,
                                elements: cut.elements.map(el => 
                                  el.id === selectedElementId 
                                    ? { ...el, strokeWidth: parseInt(e.target.value) || 2 }
                                    : el
                                )
                              })));
                            }}
                            className="text-sm w-full"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 말풍선은 순수 그래픽 요소 - 텍스트 입력 없음 */}
                  {!selectedElementId && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        💡 말풍선과 텍스트는 별도 요소입니다. 텍스트를 추가하려면 "텍스트" 탭을 사용하세요.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'text' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-3 block">
                      텍스트 스타일 선택
                    </label>
                    <div className="space-y-2">
                      {[
                        { name: '제목 추가', fontSize: 28, weight: 'bold', description: '큰 제목 텍스트' },
                        { name: '부제목 추가', fontSize: 20, weight: '600', description: '중간 크기 제목' },
                        { name: '본문 텍스트 추가', fontSize: 14, weight: 'normal', description: '일반 텍스트' }
                      ].map((style, index) => (
                        <button
                          key={index}
                          onClick={() => addTextElementWithStyle(style)}
                          className="w-full p-4 text-left bg-white border border-slate-200 rounded-lg hover:border-purple-300 hover:shadow-sm transition-all group"
                        >
                          <div 
                            className={`text-black mb-1 ${style.weight === 'bold' ? 'font-bold' : style.weight === '600' ? 'font-semibold' : 'font-normal'} group-hover:text-purple-700 transition-colors`}
                            style={{ fontSize: Math.min(style.fontSize, 20) }}
                          >
                            {style.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {style.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <div className="text-xs text-slate-500 text-center">
                      💡 스타일을 선택하면 캔버스에 바로 텍스트 상자가 추가됩니다
                    </div>
                  </div>
                </div>
              )}


              {activeTab === 'ai-character' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      캐릭터 이름 <span className="text-red-500">*</span>
                    </label>
                    <Input 
                      value={characterName}
                      onChange={(e) => setCharacterName(e.target.value.substring(0, 20))}
                      placeholder="캐릭터 이름을 입력하세요"
                      className="text-sm border-slate-200"
                      maxLength={20}
                    />
                    <div className="text-xs text-gray-500 text-right">
                      {characterName.length}/20
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      캐릭터 설명 <span className="text-red-500">*</span>
                    </label>
                    <Textarea 
                      value={characterDescription}
                      onChange={(e) => setCharacterDescription(e.target.value.substring(0, 300))}
                      placeholder="캐릭터의 외모와 특징을 설명해주세요..."
                      className="min-h-[100px] text-sm resize-none border-slate-200"
                      maxLength={300}
                    />
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>자세히 입력할수록 좋은 캐릭터가 생성돼요!</span>
                      <span>{characterDescription.length}/300</span>
                    </div>
                  </div>

                  {/* 가로 세로 비율 (1:1 고정 표시) */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      가로 세로 비율
                    </label>
                    <div className="p-3 border-2 border-green-300 bg-green-50 rounded-lg text-center">
                      <div className="text-lg font-medium text-green-700">1:1</div>
                    </div>
                  </div>

                  {/* 캐릭터 생성 버튼 */}
                  <Button 
                    onClick={handleGenerateCharacter}
                    disabled={isGeneratingCharacter || !characterDescription.trim() || !characterName.trim()}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" 
                    size="sm"
                  >
                    {isGeneratingCharacter ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        생성 중...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        캐릭터 생성
                      </>
                    )}
                  </Button>

                  {/* 생성된 캐릭터 이미지 표시 */}
                  {generatedCharacterUrl && (
                    <div className="space-y-3">
                      <div className="relative">
                        <img
                          src={generatedCharacterUrl}
                          alt="생성된 캐릭터"
                          className="w-full rounded-lg border border-slate-200"
                        />
                      </div>
                      
                      {/* 캐릭터 추가 버튼 */}
                      <Button
                        onClick={handleAddCharacterToDB}
                        disabled={isAddingCharacterToDB}
                        className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                        size="sm"
                      >
                        {isAddingCharacterToDB ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            캐릭터 추가 중...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            캐릭터 추가하기
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'upload' && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-sm font-medium text-slate-700 mb-3">
                      지원 형식: JPG, PNG, SVG
                    </div>
                    
                    {/* 업로드 드래그 앤 드롭 영역 */}
                    <div 
                      className="border-2 border-dashed border-slate-300 rounded-lg p-8 hover:border-purple-400 hover:bg-purple-50/50 transition-all cursor-pointer"
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.multiple = true;
                        input.accept = 'image/jpeg,image/png,image/svg+xml';
                        input.onchange = (e) => {
                          const files = (e.target as HTMLInputElement).files;
                          if (files) {
                            handleFileUpload(files);
                          }
                        };
                        input.click();
                      }}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                          {isUploading ? (
                            <Loader2 className="h-6 w-6 text-purple-600 animate-spin" />
                          ) : (
                            <Upload className="h-6 w-6 text-purple-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">
                            {isUploading ? '업로드 중...' : '파일을 드래그하거나 클릭하여 업로드'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            JPG, PNG, SVG 파일만 업로드 가능합니다
                          </p>
                        </div>
                        <Button variant="outline" size="sm" className="mt-2" disabled={isUploading}>
                          <Plus className="h-4 w-4 mr-2" />
                          파일 선택
                        </Button>
                      </div>
                    </div>
                    
                    {/* 업로드된 이미지 목록 */}
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-medium text-slate-700">
                          업로드된 이미지 ({uploadedImages.length})
                        </div>
                        {uploadedImages.length > 0 && (
                          <div className="flex items-center gap-2">
                            <ArrowUpDown className="h-3 w-3 text-slate-400" />
                            <select
                              value={sortOrder}
                              onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest' | 'name')}
                              className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-600 hover:border-purple-300 focus:border-purple-400 focus:outline-none"
                            >
                              <option value="newest">최신순</option>
                              <option value="oldest">오래된순</option>
                              <option value="name">이름순</option>
                            </select>
                          </div>
                        )}
                      </div>
                      {isLoadingFiles ? (
                        <div className="text-center py-8 text-slate-400">
                          <Loader2 className="h-8 w-8 mx-auto mb-2 opacity-50 animate-spin" />
                          <p className="text-sm">파일 목록을 불러오는 중...</p>
                        </div>
                      ) : uploadedImages.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">업로드된 이미지가 없습니다</p>
                          <p className="text-xs text-slate-400 mt-1">이미지를 업로드하면 여기에 표시됩니다</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                          {sortedUploadedImages.map((image) => (
                            <div
                              key={image.id}
                              className="relative group border border-slate-200 rounded-lg overflow-hidden hover:border-purple-300 transition-colors cursor-grab active:cursor-grabbing"
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('uploaded-image', image.id);
                                e.dataTransfer.effectAllowed = 'copy';
                              }}
                            >
                              <div className="aspect-square bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-2 relative overflow-hidden">
                                {image.type.includes('svg') ? (
                                  <div
                                    className="w-full h-full"
                                    dangerouslySetInnerHTML={{
                                      __html: atob(image.url.split(',')[1])
                                    }}
                                  />
                                ) : (
                                  <>
                                    {/* 로딩 인디케이터 */}
                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                                      <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                                    </div>
                                    <img
                                      src={image.url}
                                      alt={image.name}
                                      className="w-full h-full object-cover relative z-10"
                                      draggable={false}
                                      onError={(e) => {
                                        console.error('이미지 로딩 실패:', image.url);
                                        const target = e.currentTarget;
                                        const parent = target.parentElement;
                                        if (parent) {
                                          // 로딩 인디케이터 숨기기
                                          const loader = parent.querySelector('.animate-spin')?.parentElement;
                                          if (loader) loader.style.display = 'none';
                                          
                                          // 에러 표시
                                          target.style.display = 'none';
                                          const errorDiv = document.createElement('div');
                                          errorDiv.className = 'absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50';
                                          errorDiv.innerHTML = `
                                            <svg class="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                            </svg>
                                            <span class="text-xs text-center">로딩 실패</span>
                                          `;
                                          parent.appendChild(errorDiv);
                                        }
                                      }}
                                      onLoad={(e) => {
                                        console.log('이미지 로딩 성공:', image.url);
                                        // 로딩 인디케이터 숨기기
                                        const target = e.currentTarget;
                                        const parent = target.parentElement;
                                        if (parent) {
                                          const loader = parent.querySelector('.animate-spin')?.parentElement;
                                          if (loader) loader.style.display = 'none';
                                        }
                                      }}
                                    />
                                  </>
                                )}
                              </div>
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all"></div>
                              
                              {/* 삭제 버튼 - 개선된 UI */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirm({
                                    isOpen: true,
                                    imageId: image.id,
                                    imageName: image.name
                                  });
                                }}
                                className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full opacity-80 hover:opacity-100 transition-all duration-200 flex items-center justify-center hover:bg-red-600 hover:scale-110 shadow-lg"
                                title={`"${image.name}" 삭제`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              
                              {/* 파일명 표시 */}
                              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-1 truncate">
                                {image.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
        
        {/* 중앙 캔버스 영역 - 완전 고정 레이아웃 */}
        <section className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
          {/* 페이지 정보 바 */}
          <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-700">
                {selectedCutIndex + 1}컷 / {cuts.length}컷
              </span>
              <div className="text-xs text-slate-500">
                {CANVAS_SIZES[canvasRatio].actualWidth} × {CANVAS_SIZES[canvasRatio].actualHeight}px
              </div>
              <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1">
                Ctrl+휠: 확대/축소
              </div>
            </div>
          </div>

          {/* 캔버스 컨테이너 - 작업공간만 스크롤 */}
          <div 
            ref={canvasAreaRef}
            className="flex-1 overflow-auto bg-slate-50"
            style={{ isolation: 'isolate' }}
          >
            {/* 캔버스 래퍼 - 충분한 패딩으로 캔버스 간격 보장 */}
            <div 
              className="min-h-full flex flex-col items-center py-12"
              style={{
                paddingLeft: '200px',
                paddingRight: '200px',
              }}
            >
              {cuts.map((cut, index) => {
                // 각 캔버스의 실제 크기 계산
                const scaledWidth = CANVAS_SIZES[canvasRatio].width * (zoom / 100);
                const scaledHeight = CANVAS_SIZES[canvasRatio].height * (zoom / 100);
                
                // 마진 계산 - 배율이 커질수록 마진도 증가
                const marginBottom = Math.max(60, 100 * (zoom / 100));
                
                return (
                  <div
                    key={cut.id}
                    ref={(el) => {
                      canvasRefs.current[cut.id] = el;
                    }}
                    className={cn(
                      "relative group transition-all duration-200",
                      selectedCutId === cut.id && "drop-shadow-xl"
                    )}
                    style={{
                      width: `${scaledWidth}px`,
                      height: `${scaledHeight}px`,
                      marginBottom: index < cuts.length - 1 ? `${marginBottom}px` : '0'
                      // overflow 제거 - 미리캔버스처럼 패널 밖으로 요소가 나갈 수 있도록
                    }}
                  >
                    {/* 컷 번호 */}
                    <div className="absolute -left-12 top-0 flex flex-col items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center text-sm font-bold rounded">
                        {index + 1}
                      </div>
                    </div>

                    {/* 캠버스 상단 컨트롤 버튼들 - 미리캠버스 스타일 */}
                    <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 flex items-center gap-1">
                      {/* 개별 다운로드 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadCanvas(cut.id);
                        }}
                        className="w-7 h-7 bg-white border border-green-300 hover:bg-green-50 text-green-600 flex items-center justify-center rounded shadow-sm transition-colors"
                        title="이 패널 다운로드"
                      >
                        <Download className="h-3 w-3" />
                      </button>
                      
                      {/* 🎯 드래그 핸들 (Canva/Miri 스타일) */}
                      <div
                        className="w-7 h-7 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 flex items-center justify-center rounded shadow-sm transition-all cursor-grab active:cursor-grabbing group"
                        title="드래그하여 순서 변경"
                        draggable="true"
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData('text/plain', cut.id);
                          e.dataTransfer.effectAllowed = 'move';
                          // 드래그 이미지 설정
                          const dragElement = document.createElement('div');
                          dragElement.className = 'bg-white border border-purple-400 rounded px-2 py-1 text-sm font-medium text-purple-700 shadow-lg';
                          dragElement.textContent = `패널 ${index + 1}`;
                          dragElement.style.position = 'absolute';
                          dragElement.style.top = '-1000px';
                          document.body.appendChild(dragElement);
                          e.dataTransfer.setDragImage(dragElement, 40, 15);
                          setTimeout(() => document.body.removeChild(dragElement), 0);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const draggedCutId = e.dataTransfer.getData('text/plain');
                          if (draggedCutId && draggedCutId !== cut.id) {
                            // 🔄 패널 순서 재배열 로직
                            const draggedIndex = cuts.findIndex(c => c.id === draggedCutId);
                            const targetIndex = index;
                            
                            if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
                              const newCuts = [...cuts];
                              const [draggedCut] = newCuts.splice(draggedIndex, 1);
                              newCuts.splice(targetIndex, 0, draggedCut);
                              setCuts(newCuts);
                              
                              // 드래그된 패널로 포커스 이동
                              setSelectedCutId(draggedCutId);
                            }
                          }
                        }}
                      >
                        <svg className="w-4 h-4 text-slate-500 group-hover:text-slate-700 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M7 2a1 1 0 011 1v2h4V3a1 1 0 112 0v2h2a1 1 0 110 2h-2v4h2a1 1 0 110 2h-2v2a1 1 0 11-2 0v-2H8v2a1 1 0 11-2 0v-2H4a1 1 0 110-2h2V7H4a1 1 0 110-2h2V3a1 1 0 011-1zM8 7v4h4V7H8z"/>
                        </svg>
                      </div>
                      
                      {/* 삭제 */}
                      {cuts.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCut(cut.id);
                          }}
                          className="w-7 h-7 bg-white border border-red-300 hover:bg-red-50 text-red-600 flex items-center justify-center rounded shadow-sm transition-colors"
                          title="컷 삭제"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {/* 캔버스 */}
                    <div
                      className={cn(
                        "w-full h-full bg-white shadow-lg overflow-visible cursor-pointer relative border-2 transition-all duration-200",
                        selectedCutId === cut.id ? "border-purple-500" : "border-slate-300 hover:border-slate-400",
                        isDraggingBubble && selectedCutId === cut.id && "border-purple-400 bg-purple-50"
                        // 🚫 드롭 존 하이라이트 제거 - 자연스러운 드래그 경험을 위해
                      )}
                      style={{ position: 'relative' }}
                      onClick={(e) => {
                        // 캔버스 클릭 시 선택 해제 (단, Shift 키가 눌린 경우는 제외)
                        if (!e.shiftKey) {
                          setSelectedElementIds([]);
                        }
                        setSelectedCutId(cut.id);
                        setSelectedElementId(null);
                        setDragElementPosition(null); // 드래그 상태 초기화
                        scrollToCanvas(cut.id);
                      }}
                      onMouseDown={(e) => {
                        // 빈 캔버스 영역에서 드래그 시작 시 선택 영역 모드
                        if (e.target === e.currentTarget) {
                          e.preventDefault();
                          
                          const canvasElement = e.currentTarget as HTMLElement; // 안전하게 저장
                          const rect = canvasElement.getBoundingClientRect();
                          const startX = ((e.clientX - rect.left) / rect.width) * CANVAS_SIZES[canvasRatio].width;
                          const startY = ((e.clientY - rect.top) / rect.height) * CANVAS_SIZES[canvasRatio].height;
                          
                          setSelectionBox({
                            startX,
                            startY,
                            endX: startX,
                            endY: startY,
                            isActive: true
                          });
                          setIsSelecting(true);
                          
                          const handleMouseMove = (moveEvent: MouseEvent) => {
                            if (!canvasElement) return; // null 체크 추가
                            const moveRect = canvasElement.getBoundingClientRect();
                            const endX = ((moveEvent.clientX - moveRect.left) / moveRect.width) * CANVAS_SIZES[canvasRatio].width;
                            const endY = ((moveEvent.clientY - moveRect.top) / moveRect.height) * CANVAS_SIZES[canvasRatio].height;
                            
                            setSelectionBox(prev => ({
                              ...prev,
                              endX,
                              endY
                            }));
                          };
                          
                          const handleMouseUp = () => {
                            // 현재 선택 박스로 요소들 찾기 (실시간 상태 사용)
                            setSelectionBox(currentBox => {
                              const selectedElements = getElementsInSelectionBox(currentBox, cut.id);
                              console.log('🎯 선택된 요소들:', selectedElements);
                              
                              if (selectedElements.length > 0) {
                                // 히스토리에 반영
                                pushHistory(prev => ({
                                  ...prev,
                                  selectedElementIds: selectedElements,
                                  selectedElementId: selectedElements[0]
                                }));
                                
                                // 🎯 다중 선택 성공 알림
                                console.log(`✅ ${selectedElements.length}개 요소가 선택되었습니다!`);
                              } else {
                                // 빈 영역 선택 시 모든 선택 해제
                                pushHistory(prev => ({
                                  ...prev,
                                  selectedElementIds: [],
                                  selectedElementId: null
                                }));
                              }
                              
                              return { ...currentBox, isActive: false };
                            });
                            
                            setIsSelecting(false);
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                          };
                          
                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                        }
                      }}
                      onDragOver={(e) => {
                        e.preventDefault(); // 드롭 허용
                        if (isDraggingBubble) {
                          setSelectedCutId(cut.id); // 드래그 중일 때 캔버스 선택
                        }
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        if (isDraggingBubble) {
                          setSelectedCutId(cut.id);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        
                        // 업로드된 이미지 드롭 처리
                        const uploadedImageId = e.dataTransfer.getData('uploaded-image');
                        if (uploadedImageId) {
                          const uploadedImage = uploadedImages.find(img => img.id === uploadedImageId);
                          if (uploadedImage) {
                            // 드롭 위치 계산
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = (e.clientX - rect.left) / rect.width * CANVAS_SIZES[canvasRatio].width - 50;
                            const y = (e.clientY - rect.top) / rect.height * CANVAS_SIZES[canvasRatio].height - 50;
                            
                            // 캔버스 경계 내에 배치
                            const constrainedX = Math.max(0, Math.min(x, CANVAS_SIZES[canvasRatio].width - 100));
                            const constrainedY = Math.max(0, Math.min(y, CANVAS_SIZES[canvasRatio].height - 100));
                            
                            // 이미지 로드해서 원본 크기 가져오기
                            const img = new Image();
                            img.onload = () => {
                              const aspectRatio = img.width / img.height;
                              let elementWidth = 200; // 기본 크기
                              let elementHeight = 200;
                              
                              // 가로가 더 긴 경우 (가로 기준으로 크기 조정)
                              if (aspectRatio > 1) {
                                elementHeight = elementWidth / aspectRatio;
                              } 
                              // 세로가 더 긴 경우 (세로 기준으로 크기 조정)
                              else if (aspectRatio < 1) {
                                elementWidth = elementHeight * aspectRatio;
                              }
                              // 1:1인 경우 그대로 유지
                              
                              // 캔버스 경계 내에 배치 (크기 고려)
                              const maxX = CANVAS_SIZES[canvasRatio].width - elementWidth;
                              const maxY = CANVAS_SIZES[canvasRatio].height - elementHeight;
                              const finalX = Math.max(0, Math.min(x - elementWidth / 2, maxX));
                              const finalY = Math.max(0, Math.min(y - elementHeight / 2, maxY));
                              
                              // 새 이미지 요소 생성
                              const newElement: CanvasElement = {
                                id: Date.now().toString(),
                                type: 'image',
                                x: finalX,
                                y: finalY,
                                width: elementWidth,
                                height: elementHeight,
                                imageUrl: uploadedImage.url,
                                imageName: uploadedImage.name
                              };
                              
                              // 캔버스에 요소 추가
                              pushHistory(prev => ({
                                ...prev,
                                cuts: cuts.map(c => 
                                  c.id === cut.id 
                                    ? { ...c, elements: [...c.elements, newElement] }
                                    : c
                                )
                              }));
                              
                              // 새 요소 선택
                              pushHistory(prev => ({
                                ...prev,
                                selectedElementId: newElement.id
                              }));
                            };
                            
                            img.src = uploadedImage.url;
                            
                            return;
                          }
                        }
                        
                        if (!isDraggingBubble || !draggedBubbleId) return;
                        
                        // 드롭 위치 계산 (캔버스 중앙 기준)
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = (e.clientX - rect.left) / rect.width * CANVAS_SIZES[canvasRatio].width - 60; // 말풍선 크기의 절반
                        const y = (e.clientY - rect.top) / rect.height * CANVAS_SIZES[canvasRatio].height - 40;
                        
                        // 캔버스 경계 내에 배치
                        const constrainedX = Math.max(0, Math.min(x, CANVAS_SIZES[canvasRatio].width - 120));
                        const constrainedY = Math.max(0, Math.min(y, CANVAS_SIZES[canvasRatio].height - 80));
                        
                        // 말풍선 템플릿 찾기
                        const template = BUBBLE_TEMPLATES.find(t => t.id === draggedBubbleId);
                        if (!template) return;
                        
                        // 새 말풍선 요소 생성 (텍스트 내용 없음)
                        const newElement: CanvasElement = {
                          id: Date.now().toString(),
                          type: 'bubble',
                          // content 제거 - 말풍선은 순수 그래픽 요소
                          x: constrainedX,
                          y: constrainedY,
                          width: 120,
                          height: 80,
                          bubbleStyle: template.category as 'speech' | 'thought' | 'shout' | 'whisper',
                          templateId: template.id,
                          fillColor: '#ffffff', // 기본 배경색
                          strokeColor: '#333333', // 기본 테두리색
                          strokeWidth: 2 // 기본 테두리 두께
                        };
                        
                        // 캔버스에 요소 추가
                        pushHistory(prev => ({
                          ...prev,
                          cuts: cuts.map(c => 
                            c.id === cut.id 
                              ? { ...c, elements: [...c.elements, newElement] }
                              : c
                          )
                        }));
                        
                        // 새 요소 선택
                        pushHistory(prev => ({
                          ...prev,
                          selectedElementId: newElement.id
                        }));
                      }}
                    >
                      {/* 배경 이미지 */}
                      {cut.imageUrl ? (
                        <OptimizedCanvasImage
                          src={cut.imageUrl}
                          alt={`${index + 1}컷`}
                          cutId={cut.id}
                          generationId={cut.generationId}
                          className="pointer-events-none select-none"
                          style={{
                            objectFit: 'cover', // 비율 유지하면서 캔버스 채우기
                            objectPosition: 'center',
                            zIndex: 1 // 배경 이미지는 가장 낮은 레이어
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                          <ImageIcon className="h-16 w-16 mb-3 opacity-30" />
                          <p className="text-sm font-medium opacity-60">AI 이미지를 생성하세요</p>
                        </div>
                      )}

                      {/* 🔥 이미지 생성 중 오버레이 (히스토리와 분리된 상태) */}
                      {generatingCutIds.has(cut.id) && (
                        <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                          <div className="flex flex-col items-center gap-3 text-white">
                            <Loader2 className="h-10 w-10 animate-spin" />
                            <p className="text-sm font-medium">이미지 생성 중...</p>
                          </div>
                        </div>
                      )}

                      {/* 캔버스 요소들 (말풍선, 텍스트) - 미리캔버스 스타일 스마트 드래그 */}
                      {cut.elements.map(element => (
                        <div
                          key={element.id}
                          className={cn(
                            "absolute cursor-move select-none",
                            // 회전 중이 아닐 때만 transition 적용 (360도 깜빡임 방지)
                            !isRotating && "transition-transform duration-150 ease-out",
                            // 🎨 프리미엄 Canva 스타일 선택 효과
                            (selectedElementId === element.id || selectedElementIds.includes(element.id))
                              ? "border-2 border-blue-500 shadow-lg shadow-blue-500/20 ring-1 ring-blue-500/30" 
                              : !isDraggingElement && "border border-transparent hover:border-gray-300 hover:shadow-md",
                            // 🎯 드래그 중인 요소는 모든 요소보다 위에 + 선택된 요소도 최상위
                            (isDraggingElement && draggedElement?.id === element.id) && "z-[99999]",
                            (selectedElementId === element.id && !isDraggingElement) && "z-[9999]"
                          )}
                          style={(() => {
                            const renderPos = getElementRenderPosition(element, cut.id);
                            return {
                              left: `${(renderPos.x / CANVAS_SIZES[canvasRatio].width) * 100}%`,
                              top: `${(renderPos.y / CANVAS_SIZES[canvasRatio].height) * 100}%`,
                              width: `${(element.width / CANVAS_SIZES[canvasRatio].width) * 100}%`,
                              height: `${(element.height / CANVAS_SIZES[canvasRatio].height) * 100}%`,
                              transform: element.rotation ? `rotate(${element.rotation}deg)` : 'none',
                              transformOrigin: 'center center',
                              cursor: isRotating && selectedElementId === element.id ? 'grabbing' : 'default',
                              // 🎯 부드러운 레이어 구조: 배경(1) < AI이미지(5) < 말풍선(10) < 텍스트(12) < 선택된요소(20) < 드래그중(30)
                              zIndex: isDraggingElement && draggedElement?.id === element.id ? 30 : 
                                     selectedElementId === element.id ? 20 : 
                                     element.type === 'text' ? 12 :
                                     element.type === 'bubble' ? 10 :
                                     element.type === 'image' ? 5 : 10,
                              // 회전 중일 때 시각적 피드백
                              opacity: isRotating && selectedElementId === element.id ? 0.9 : 1
                            };
                          })()}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Shift 키가 눌렸을 때 멀티 선택, 아니면 단일 선택
                            toggleElementSelection(element.id, e.shiftKey);
                            findElementCutAndSelect(element.id);
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            
                            // 텍스트 편집 모드일 때는 드래그 비활성화
                            if (element.type === 'text' && editingTextId === element.id) {
                              return;
                            }
                                                        
                            // 즉시 선택 및 드래그 시작 - UX 개선
                            findElementCutAndSelect(element.id);
                            
                            // 🔒 드래그 시작 상태 저장 (useRef + React 상태)
                            
                            // useRef에 안정적 저장
                            dragDataRef.current.startState = [...historyCuts];
                            dragDataRef.current.isCommitted = false;
                            
                            // React 상태도 업데이트 (렌더링용)
                            setDragStartState([...historyCuts]);
                            
                            const rect = e.currentTarget.getBoundingClientRect();
                            const offsetX = e.clientX - rect.left;
                            const offsetY = e.clientY - rect.top;
                            
                            setIsDraggingElement(true);
                            setDraggedElement({ 
                              id: element.id, 
                              offsetX, 
                              offsetY 
                            });
                            
                            let dragStarted = false;
                            const startX = e.clientX;
                            const startY = e.clientY;
                            const originalCutId = cut.id; // 원본 패널 ID (드래그 시작시)
                            let currentCutId = cut.id; // 현재 요소가 속한 캔버스 ID 추적
                            let finalPosition = { x: element.x, y: element.y, cutId: cut.id }; // 최종 위치 추적
                            
                            const handleMouseMove = (moveEvent: MouseEvent) => {
                              // 최소 이동 거리로 드래그 시작 감지
                              if (!dragStarted) {
                                const distance = Math.sqrt(
                                  Math.pow(moveEvent.clientX - startX, 2) + 
                                  Math.pow(moveEvent.clientY - startY, 2)
                                );
                                if (distance < 3) return; // 3px 이하면 드래그로 인식하지 않음
                                dragStarted = true;
                              }
                              
                              // 🎯 미리캔버스 스타일: 절대 좌표 기반 자연스러운 드래그
                              // 드래그 시작점의 오프셋을 유지하면서 마우스 이동량만큼 이동
                              const deltaX = moveEvent.clientX - startX;
                              const deltaY = moveEvent.clientY - startY;
                              
                              // 원본 요소의 화면상 위치 계산
                              const originalCanvas = canvasRefs.current[originalCutId];
                              if (!originalCanvas) return;
                              
                              const originalRect = originalCanvas.getBoundingClientRect();
                              
                              // 원본 화면 좌표 + 마우스 이동량 = 새로운 화면 좌표
                              const elementScreenX = originalRect.left + (element.x / CANVAS_SIZES[canvasRatio].width) * originalRect.width + deltaX;
                              const elementScreenY = originalRect.top + (element.y / CANVAS_SIZES[canvasRatio].height) * originalRect.height + deltaY;
                              
                              // 🔍 어느 패널에 속하는지 확인 (자연스러운 패널 전환)
                              let targetCutId = originalCutId; // 기본값은 원본 패널
                              let targetCanvas = originalCanvas;
                              
                              // 모든 패널을 검사해서 가장 적합한 패널 찾기
                              for (const cutId of Object.keys(canvasRefs.current)) {
                                const canvas = canvasRefs.current[cutId];
                                if (canvas) {
                                  const rect = canvas.getBoundingClientRect();
                                  
                                  // 패널 내부에 있는지 체크 (우선순위 최상)
                                  if (elementScreenX >= rect.left && 
                                      elementScreenX <= rect.right && 
                                      elementScreenY >= rect.top && 
                                      elementScreenY <= rect.bottom) {
                                    targetCutId = cutId;
                                    targetCanvas = canvas;
                                    break;
                                  }
                                }
                              }
                              
                              // 타겟 패널의 좌표계로 변환
                              const targetRect = targetCanvas.getBoundingClientRect();
                              const relativeX = ((elementScreenX - targetRect.left) / targetRect.width) * CANVAS_SIZES[canvasRatio].width;
                              const relativeY = ((elementScreenY - targetRect.top) / targetRect.height) * CANVAS_SIZES[canvasRatio].height;
                              
                              // 🎯 스마트 정렬 적용 (같은 패널 내에서만)
                              let finalX = relativeX;
                              let finalY = relativeY;
                              
                              if (targetCutId === currentCutId) {
                                const { horizontal, vertical, snappedX, snappedY } = calculateAlignmentGuides(
                                  element.id, relativeX, relativeY, element.width, element.height
                                );
                                
                                finalX = snappedX;
                                finalY = snappedY;
                                
                                // 가이드라인 표시
                                setAlignmentGuides({
                                  horizontal,
                                  vertical,
                                  showGuides: horizontal.length > 0 || vertical.length > 0
                                });
                              } else {
                                // 패널 변경 시 가이드라인 숨기기
                                setAlignmentGuides({ horizontal: [], vertical: [], showGuides: false });
                              }
                              
                              // 🌍 완전 자유로운 배치 영역 (미리캔버스 스타일)
                              const workspaceWidth = CANVAS_SIZES[canvasRatio].width * 3;
                              const workspaceHeight = CANVAS_SIZES[canvasRatio].height * 3;
                              const workspaceOffsetX = -CANVAS_SIZES[canvasRatio].width;
                              const workspaceOffsetY = -CANVAS_SIZES[canvasRatio].height;
                              
                              const constrainedX = Math.max(workspaceOffsetX, Math.min(finalX, workspaceWidth + workspaceOffsetX - element.width));
                              const constrainedY = Math.max(workspaceOffsetY, Math.min(finalY, workspaceHeight + workspaceOffsetY - element.height));
                              
                              // 🔥 부드러운 위치 업데이트 (패널 전환도 자연스럽게)
                              updateDragPosition(element.id, constrainedX, constrainedY, targetCutId);
                              finalPosition = { x: constrainedX, y: constrainedY, cutId: targetCutId };
                              currentCutId = targetCutId;
                            };
                            
                            const cleanup = () => {
                              document.removeEventListener('mousemove', handleMouseMove);
                              document.removeEventListener('mouseup', handleMouseUp);
                              window.removeEventListener('mouseup', handleMouseUp);
                              document.removeEventListener('mouseleave', handleMouseUp);
                              
                              // 🔥 핵심 수정: 모든 드래그 상태 초기화
                              setIsDraggingElement(false);
                              setDraggedElement(null);
                              setDragElementPosition(null);
                              
                              // 가이드라인 숨기기
                              setAlignmentGuides({ horizontal: [], vertical: [], showGuides: false });
                              // 드래그 오버 상태 초기화
                              setDragOverCutId(null);
                              
                              console.log('✅ 드래그 상태 완전 초기화 완료');
                            };
                            
                            // 드래그 타임아웃 설정 (5초 후 자동 종료) - commitDrag 제거
                            const dragTimeout = setTimeout(() => {
                              cleanup();
                            }, 5000);
                            
                            const handleMouseUp = () => {
                              clearTimeout(dragTimeout);
                              
                              // 🎯 드래그 완료 - 실제 데이터 커밋
                              if (dragStarted) {
                                console.log('🎯 드래그 완료 - 실제 데이터 커밋:', { 
                                  elementId: element.id,
                                  finalPosition,
                                  originalCutId 
                                });
                                commitDragChanges(
                                  element.id,
                                  finalPosition.x,
                                  finalPosition.y,
                                  finalPosition.cutId,
                                  originalCutId
                                );
                              }
                              
                              // cleanup 및 상태 초기화
                              cleanup();
                            };
                            
                                                        document.addEventListener('mousemove', handleMouseMove);
                            document.addEventListener('mouseup', handleMouseUp);
                            window.addEventListener('mouseup', handleMouseUp); // window 레벨에서도 캐치
                            document.addEventListener('mouseleave', handleMouseUp); // 마우스가 페이지를 벗어날 때도 처리
                          }}
                        >
                          {element.type === 'text' ? (
                            editingTextId === element.id ? (
                              // ✏️ 편집 모드 - 인라인 텍스트 에디터
                              <textarea
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                onBlur={finishTextEditing}
                                onMouseDown={(e) => e.stopPropagation()}
                                onMouseMove={(e) => e.stopPropagation()}
                                onMouseUp={(e) => e.stopPropagation()}
                                autoFocus
                                className={`w-full h-full p-2 border-none outline-none resize-none bg-transparent ${
                                  element.textAlign === 'left' ? 'text-left' :
                                  element.textAlign === 'right' ? 'text-right' :
                                  element.textAlign === 'justify' ? 'text-justify' :
                                  'text-center'
                                }`}
                                style={{
                                  fontSize: `${(element.fontSize || 16) * (zoom / 100)}px`,
                                  fontFamily: element.fontFamily || STUDIO_FONTS[0].fontFamily,
                                  color: element.color || '#000000',
                                  fontWeight: element.fontWeight || 400,
                                  fontStyle: element.fontStyle || 'normal',
                                  textDecoration: element.textDecoration || 'none',
                                  textAlign: element.textAlign || 'center',
                                  WebkitTextStroke: element.textStroke || 'none',
                                  textShadow: element.textShadow || 'none',
                                  lineHeight: '1.2',
                                  overflow: 'hidden',
                                  wordBreak: 'break-word'
                                }}
                                placeholder="텍스트 입력..."
                              />
                            ) : (
                              // 📖 보기 모드 - 더블클릭으로 편집 시작
                              <div
                                className={`w-full h-full flex items-center p-2 cursor-text ${
                                  element.textAlign === 'left' ? 'justify-start text-left' :
                                  element.textAlign === 'right' ? 'justify-end text-right' :
                                  element.textAlign === 'justify' ? 'justify-between text-justify' :
                                  'justify-center text-center'
                                }`}
                                style={{
                                  fontSize: `${(element.fontSize || 16) * (zoom / 100)}px`,
                                  fontFamily: element.fontFamily || STUDIO_FONTS[0].fontFamily,
                                  color: element.color || '#000000',
                                  fontWeight: element.fontWeight || 400,
                                  fontStyle: element.fontStyle || 'normal',
                                  textDecoration: element.textDecoration || 'none',
                                  textAlign: element.textAlign || 'center',
                                  WebkitTextStroke: element.textStroke || 'none',
                                  textShadow: element.textShadow || 'none',
                                  background: 'transparent',
                                  lineHeight: '1.2',
                                  wordBreak: 'break-word'
                                }}
                                onDoubleClick={(e) => startTextEditing(element.id, element.content || '', e)}
                                title="더블클릭하여 편집 (Enter: 완료, Shift+Enter: 새줄, Esc: 취소)"
                              >
                                {element.content || '텍스트 입력...'}
                              </div>
                            )
                          ) : element.type === 'image' ? (
                            <div className="w-full h-full relative overflow-hidden">
                              {element.imageUrl && (
                                <img
                                  src={element.imageUrl}
                                  alt={element.imageName || '업로드된 이미지'}
                                  className="absolute inset-0 w-full h-full object-fill"
                                  draggable={false}
                                />
                              )}
                            </div>
                          ) : element.type === 'bubble' ? (
                            <div className="w-full h-full relative">
                              {element.templateId ? (
                                // 템플릿 SVG 사용
                                <BubbleTemplateRenderer
                                  templateId={element.templateId}
                                  fillColor={element.fillColor || '#ffffff'}
                                  strokeColor={element.strokeColor || '#333333'}
                                  strokeWidth={element.strokeWidth || 2}
                                  className="absolute inset-0 w-full h-full"
                                />
                              ) : (
                                // 기본 말풍선 SVG
                                <svg
                                  className="absolute inset-0 w-full h-full"
                                  viewBox="0 0 120 60"
                                  preserveAspectRatio="none"
                                >
                                  <rect
                                    x="2"
                                    y="2"
                                    width="116"
                                    height="56"
                                    rx={element.bubbleStyle === 'thought' ? "15" : "8"}
                                    fill={element.fillColor || '#ffffff'}
                                    stroke={element.strokeColor || '#333333'}
                                    strokeWidth={element.strokeWidth || 2}
                                  />
                                  <path
                                    d="M20,56 L25,65 L30,56"
                                    fill={element.fillColor || '#ffffff'}
                                    stroke={element.strokeColor || '#333333'}
                                    strokeWidth={element.strokeWidth || 2}
                                  />
                                </svg>
                              )}
                              {/* 말풍선에는 텍스트 표시 안 함 - 순수 그래픽 요소 */}
                            </div>
                          ) : null}

                          {/* 선택된 요소의 컨트롤 UI */}
                          {selectedElementId === element.id && (
                            <>
                              {/* 상단 툴바 - Canva 스타일 */}
                              <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 flex items-center gap-1 bg-white rounded-lg shadow-lg border border-gray-200 px-2 py-1 z-30">
                                <button
                                  className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-gray-600 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // 복사 기능 (나중에 구현)
                                  }}
                                  title="복사"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                                <button
                                  className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-gray-600 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteElement(element.id);
                                  }}
                                  title="삭제"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                                <div className="w-px h-6 bg-gray-300 mx-1" />
                                <button
                                  className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-gray-600 transition-colors"
                                  title="더 보기"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </div>

                              {/* 🎯 깔끔한 리사이즈 핸들 - 요소 타입별 최적화 */}
                              {element.type === 'image' ? (
                                // 이미지: 네 모서리 대각선 핸들
                                <>
                                  <div 
                                    className="absolute -top-2 -left-2 w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-white rounded-full cursor-nw-resize z-25 shadow-lg hover:from-blue-600 hover:to-blue-700 hover:scale-110 transition-all" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'nw')}
                                    title="대각선 크기 조절 (Shift: 비율 유지)"
                                  />
                                  <div 
                                    className="absolute -top-2 -right-2 w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-white rounded-full cursor-ne-resize z-25 shadow-lg hover:from-blue-600 hover:to-blue-700 hover:scale-110 transition-all" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'ne')}
                                    title="대각선 크기 조절 (Shift: 비율 유지)"
                                  />
                                  <div 
                                    className="absolute -bottom-2 -left-2 w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-white rounded-full cursor-sw-resize z-25 shadow-lg hover:from-blue-600 hover:to-blue-700 hover:scale-110 transition-all" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'sw')}
                                    title="대각선 크기 조절 (Shift: 비율 유지)"
                                  />
                                  <div 
                                    className="absolute -bottom-2 -right-2 w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-white rounded-full cursor-se-resize z-25 shadow-lg hover:from-blue-600 hover:to-blue-700 hover:scale-110 transition-all" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'se')}
                                    title="대각선 크기 조절 (Shift: 비율 유지)"
                                  />
                                </>
                              ) : element.type === 'bubble' ? (
                                // 말풍선: 모든 방향 핸들 (세로/가로 독립 조절 가능)
                                <>
                                  {/* 대각선 핸들 */}
                                  <div 
                                    className="absolute -top-2 -left-2 w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-white rounded-full cursor-nw-resize z-25 shadow-lg hover:from-blue-600 hover:to-blue-700 hover:scale-110 transition-all" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'nw')}
                                    title="대각선 크기 조절 (Shift: 비율 유지)"
                                  />
                                  <div 
                                    className="absolute -top-2 -right-2 w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-white rounded-full cursor-ne-resize z-25 shadow-lg hover:from-blue-600 hover:to-blue-700 hover:scale-110 transition-all" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'ne')}
                                    title="대각선 크기 조절 (Shift: 비율 유지)"
                                  />
                                  <div 
                                    className="absolute -bottom-2 -left-2 w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-white rounded-full cursor-sw-resize z-25 shadow-lg hover:from-blue-600 hover:to-blue-700 hover:scale-110 transition-all" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'sw')}
                                    title="대각선 크기 조절 (Shift: 비율 유지)"
                                  />
                                  <div 
                                    className="absolute -bottom-2 -right-2 w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-white rounded-full cursor-se-resize z-25 shadow-lg hover:from-blue-600 hover:to-blue-700 hover:scale-110 transition-all" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'se')}
                                    title="대각선 크기 조절 (Shift: 비율 유지)"
                                  />
                                  
                                  {/* 세로/가로 방향 핸들 */}
                                  <div 
                                    className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-3 bg-purple-500 border border-purple-600 rounded cursor-n-resize z-25 shadow-sm hover:bg-purple-600 transition-colors" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'n')}
                                    title="세로로만 늘리기"
                                  />
                                  <div 
                                    className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-3 bg-purple-500 border border-purple-600 rounded cursor-s-resize z-25 shadow-sm hover:bg-purple-600 transition-colors" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 's')}
                                    title="세로로만 늘리기"
                                  />
                                  <div 
                                    className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-3 h-4 bg-green-500 border border-green-600 rounded cursor-w-resize z-25 shadow-sm hover:bg-green-600 transition-colors" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'w')}
                                    title="가로로만 늘리기"
                                  />
                                  <div 
                                    className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-3 h-4 bg-green-500 border border-green-600 rounded cursor-e-resize z-25 shadow-sm hover:bg-green-600 transition-colors" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'e')}
                                    title="가로로만 늘리기"
                                  />
                                </>
                              ) : element.type === 'text' ? (
                                // 텍스트: 대각선 핸들 + 가로/세로 핸들
                                <>
                                  {/* 대각선 핸들 */}
                                  <div 
                                    className="absolute -top-1 -left-1 w-2 h-2 bg-blue-400 rounded-full cursor-nw-resize z-25 hover:bg-blue-500 transition-colors" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'nw')}
                                    title="대각선 크기 조절 (Shift: 비율 유지)"
                                  />
                                  <div 
                                    className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full cursor-ne-resize z-25 hover:bg-blue-500 transition-colors" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'ne')}
                                    title="대각선 크기 조절 (Shift: 비율 유지)"
                                  />
                                  <div 
                                    className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-400 rounded-full cursor-sw-resize z-25 hover:bg-blue-500 transition-colors" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'sw')}
                                    title="대각선 크기 조절 (Shift: 비율 유지)"
                                  />
                                  <div 
                                    className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-400 rounded-full cursor-se-resize z-25 hover:bg-blue-500 transition-colors" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'se')}
                                    title="대각선 크기 조절 (Shift: 비율 유지)"
                                  />
                                  
                                  {/* 가로/세로 방향 핸들 */}
                                  <div 
                                    className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-3 h-2 bg-purple-400 rounded cursor-n-resize z-25 hover:bg-purple-500 transition-colors" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'n')}
                                    title="세로로만 크기 조절"
                                  />
                                  <div 
                                    className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-3 h-2 bg-purple-400 rounded cursor-s-resize z-25 hover:bg-purple-500 transition-colors" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 's')}
                                    title="세로로만 크기 조절"
                                  />
                                  <div 
                                    className="absolute -left-1 top-1/2 transform -translate-y-1/2 w-2 h-3 bg-green-400 rounded cursor-w-resize z-25 hover:bg-green-500 transition-colors" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'w')}
                                    title="가로로만 크기 조절"
                                  />
                                  <div 
                                    className="absolute -right-1 top-1/2 transform -translate-y-1/2 w-2 h-3 bg-green-400 rounded cursor-e-resize z-25 hover:bg-green-500 transition-colors" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'e')}
                                    title="가로로만 크기 조절"
                                  />
                                </>
                              ) : (
                                // 기타 요소: 모든 핸들
                                <>
                                  <div 
                                    className="absolute -top-2 -left-2 w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-white rounded-full cursor-nw-resize z-25 shadow-lg hover:from-blue-600 hover:to-blue-700 hover:scale-110 transition-all" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'nw')}
                                    title="좌상단 크기 조절"
                                  />
                                  <div 
                                    className="absolute -top-2 -right-2 w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-white rounded-full cursor-ne-resize z-25 shadow-lg hover:from-blue-600 hover:to-blue-700 hover:scale-110 transition-all" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'ne')}
                                    title="우상단 크기 조절"
                                  />
                                  <div 
                                    className="absolute -bottom-2 -left-2 w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-white rounded-full cursor-sw-resize z-25 shadow-lg hover:from-blue-600 hover:to-blue-700 hover:scale-110 transition-all" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'sw')}
                                    title="좌하단 크기 조절"
                                  />
                                  <div 
                                    className="absolute -bottom-2 -right-2 w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-white rounded-full cursor-se-resize z-25 shadow-lg hover:from-blue-600 hover:to-blue-700 hover:scale-110 transition-all" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'se')}
                                    title="우하단 크기 조절"
                                  />
                                  
                                  {/* 중간점 핸들 */}
                                  <div 
                                    className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-3 h-4 bg-gradient-to-b from-purple-500 to-purple-600 border-2 border-white rounded cursor-n-resize z-25 shadow-lg hover:from-purple-600 hover:to-purple-700 hover:scale-110 transition-all" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'n')}
                                    title="상단 크기 조절"
                                  />
                                  <div 
                                    className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-3 h-4 bg-gradient-to-b from-purple-500 to-purple-600 border-2 border-white rounded cursor-s-resize z-25 shadow-lg hover:from-purple-600 hover:to-purple-700 hover:scale-110 transition-all" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 's')}
                                    title="하단 크기 조절"
                                  />
                                  <div 
                                    className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-4 h-3 bg-gradient-to-r from-green-500 to-green-600 border-2 border-white rounded cursor-w-resize z-25 shadow-lg hover:from-green-600 hover:to-green-700 hover:scale-110 transition-all" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'w')}
                                    title="좌측 크기 조절"
                                  />
                                  <div 
                                    className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-4 h-3 bg-gradient-to-r from-green-500 to-green-600 border-2 border-white rounded cursor-e-resize z-25 shadow-lg hover:from-green-600 hover:to-green-700 hover:scale-110 transition-all" 
                                    onMouseDown={(e) => handleResizeStart(e, element.id, 'e')}
                                    title="우측 크기 조절"
                                  />
                                </>
                              )}

                              {/* 드래그 회전 버튼 (하단 중앙) */}
                              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 z-25 flex flex-col items-center">
                                {/* 회전 각도 표시 */}
                                {(isRotating && selectedElementId === element.id) && (
                                  <div className="mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded-md whitespace-nowrap">
                                    {Math.round(element.rotation || 0)}°
                                  </div>
                                )}
                                
                                {/* 회전 버튼 */}
                                <div 
                                  className="w-6 h-6 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center hover:bg-blue-600 transition-all shadow-lg cursor-grab active:cursor-grabbing hover:scale-110"
                                  onMouseDown={(e) => handleRotationStart(e, element.id)}
                                  title="드래그하여 자유 회전"
                                >
                                  <RotateCw className="h-3 w-3 text-white" />
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                      {/* 🎯 드래그 선택 박스 - 최상위 레이어 */}
                      {selectionBox.isActive && selectedCutId === cut.id && (
                        <div
                          className="absolute border-2 border-dashed border-blue-500 bg-blue-100 bg-opacity-20 pointer-events-none z-50 shadow-lg"
                          style={{
                            left: `${(Math.min(selectionBox.startX, selectionBox.endX) / CANVAS_SIZES[canvasRatio].width) * 100}%`,
                            top: `${(Math.min(selectionBox.startY, selectionBox.endY) / CANVAS_SIZES[canvasRatio].height) * 100}%`,
                            width: `${(Math.abs(selectionBox.endX - selectionBox.startX) / CANVAS_SIZES[canvasRatio].width) * 100}%`,
                            height: `${(Math.abs(selectionBox.endY - selectionBox.startY) / CANVAS_SIZES[canvasRatio].height) * 100}%`,
                          }}
                        >
                          {/* 선택 박스 내부 정보 표시 */}
                          <div className="absolute -top-6 left-0 bg-blue-600 text-white text-xs px-2 py-1 rounded shadow-md whitespace-nowrap">
                            드래그하여 선택
                          </div>
                        </div>
                      )}

                      {/* 🎯 다중 선택 요소들의 그룹 바운딩 박스 및 리사이즈 핸들 */}
                      {selectedElementIds.length > 1 && selectedCutId === cut.id && (() => {
                        const selectedElements = cut.elements.filter(el => selectedElementIds.includes(el.id));
                        if (selectedElements.length === 0) return null;
                        
                        // 모든 선택된 요소들의 바운딩 박스 계산
                        const minX = Math.min(...selectedElements.map(el => el.x));
                        const minY = Math.min(...selectedElements.map(el => el.y));
                        const maxX = Math.max(...selectedElements.map(el => el.x + el.width));
                        const maxY = Math.max(...selectedElements.map(el => el.y + el.height));
                        
                        const groupWidth = maxX - minX;
                        const groupHeight = maxY - minY;
                        
                        return (
                          <div
                            className="absolute border-2 border-purple-500 bg-purple-100 bg-opacity-10 pointer-events-none"
                            style={{
                              left: `${(minX / CANVAS_SIZES[canvasRatio].width) * 100}%`,
                              top: `${(minY / CANVAS_SIZES[canvasRatio].height) * 100}%`,
                              width: `${(groupWidth / CANVAS_SIZES[canvasRatio].width) * 100}%`,
                              height: `${(groupHeight / CANVAS_SIZES[canvasRatio].height) * 100}%`,
                            }}
                          >
                            {/* 그룹 리사이즈 핸들들 */}
                            {/* 좌상단 */}
                            <div 
                              className="absolute -top-2 -left-2 w-4 h-4 bg-gradient-to-br from-purple-500 to-purple-600 border-2 border-white rounded-full cursor-nw-resize z-30 shadow-lg hover:from-purple-600 hover:to-purple-700 hover:scale-110 transition-all pointer-events-auto" 
                              onMouseDown={(e) => handleGroupResizeStart(e, selectedElementIds, 'nw', minX, minY, groupWidth, groupHeight)}
                              title="그룹 대각선 크기 조절 (Shift: 비율 유지)"
                            />
                            {/* 우상단 */}
                            <div 
                              className="absolute -top-2 -right-2 w-4 h-4 bg-gradient-to-br from-purple-500 to-purple-600 border-2 border-white rounded-full cursor-ne-resize z-30 shadow-lg hover:from-purple-600 hover:to-purple-700 hover:scale-110 transition-all pointer-events-auto" 
                              onMouseDown={(e) => handleGroupResizeStart(e, selectedElementIds, 'ne', minX, minY, groupWidth, groupHeight)}
                              title="그룹 대각선 크기 조절 (Shift: 비율 유지)"
                            />
                            {/* 좌하단 */}
                            <div 
                              className="absolute -bottom-2 -left-2 w-4 h-4 bg-gradient-to-br from-purple-500 to-purple-600 border-2 border-white rounded-full cursor-sw-resize z-30 shadow-lg hover:from-purple-600 hover:to-purple-700 hover:scale-110 transition-all pointer-events-auto" 
                              onMouseDown={(e) => handleGroupResizeStart(e, selectedElementIds, 'sw', minX, minY, groupWidth, groupHeight)}
                              title="그룹 대각선 크기 조절 (Shift: 비율 유지)"
                            />
                            {/* 우하단 */}
                            <div 
                              className="absolute -bottom-2 -right-2 w-4 h-4 bg-gradient-to-br from-purple-500 to-purple-600 border-2 border-white rounded-full cursor-se-resize z-30 shadow-lg hover:from-purple-600 hover:to-purple-700 hover:scale-110 transition-all pointer-events-auto" 
                              onMouseDown={(e) => handleGroupResizeStart(e, selectedElementIds, 'se', minX, minY, groupWidth, groupHeight)}
                              title="그룹 대각선 크기 조절 (Shift: 비율 유지)"
                            />
                            
                            {/* 중간점 핸들들 */}
                            {/* 상단 */}
                            <div 
                              className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-3 h-4 bg-gradient-to-b from-purple-500 to-purple-600 border-2 border-white rounded cursor-n-resize z-30 shadow-lg hover:from-purple-600 hover:to-purple-700 hover:scale-110 transition-all pointer-events-auto" 
                              onMouseDown={(e) => handleGroupResizeStart(e, selectedElementIds, 'n', minX, minY, groupWidth, groupHeight)}
                              title="그룹 세로 크기 조절"
                            />
                            {/* 하단 */}
                            <div 
                              className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-3 h-4 bg-gradient-to-b from-purple-500 to-purple-600 border-2 border-white rounded cursor-s-resize z-30 shadow-lg hover:from-purple-600 hover:to-purple-700 hover:scale-110 transition-all pointer-events-auto" 
                              onMouseDown={(e) => handleGroupResizeStart(e, selectedElementIds, 's', minX, minY, groupWidth, groupHeight)}
                              title="그룹 세로 크기 조절"
                            />
                            {/* 좌측 */}
                            <div 
                              className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-4 h-3 bg-gradient-to-r from-purple-500 to-purple-600 border-2 border-white rounded cursor-w-resize z-30 shadow-lg hover:from-purple-600 hover:to-purple-700 hover:scale-110 transition-all pointer-events-auto" 
                              onMouseDown={(e) => handleGroupResizeStart(e, selectedElementIds, 'w', minX, minY, groupWidth, groupHeight)}
                              title="그룹 가로 크기 조절"
                            />
                            {/* 우측 */}
                            <div 
                              className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-4 h-3 bg-gradient-to-r from-purple-500 to-purple-600 border-2 border-white rounded cursor-e-resize z-30 shadow-lg hover:from-purple-600 hover:to-purple-700 hover:scale-110 transition-all pointer-events-auto" 
                              onMouseDown={(e) => handleGroupResizeStart(e, selectedElementIds, 'e', minX, minY, groupWidth, groupHeight)}
                              title="그룹 가로 크기 조절"
                            />
                            
                            {/* 그룹 선택 표시 */}
                            <div className="absolute -top-8 left-0 bg-purple-600 text-white text-xs px-2 py-1 rounded shadow-lg">
                              {selectedElementIds.length}개 선택됨
                            </div>
                          </div>
                        );
                      })()}

                      {/* 🎯 플로팅 툴바 - 다중 선택된 요소들 위에 표시 */}
                      {selectedElementIds.length > 1 && selectedCutId === cut.id && (() => {
                        const selectedElements = cut.elements.filter(el => selectedElementIds.includes(el.id));
                        if (selectedElements.length === 0) return null;
                        
                        // 선택된 요소들의 바운딩 박스 계산
                        const minX = Math.min(...selectedElements.map(el => el.x));
                        const minY = Math.min(...selectedElements.map(el => el.y));
                        const maxX = Math.max(...selectedElements.map(el => el.x + el.width));
                        const maxY = Math.max(...selectedElements.map(el => el.y + el.height));
                        
                        const groupWidth = maxX - minX;
                        const centerX = minX + groupWidth / 2;
                        const topY = minY;
                        
                        return (
                          <div
                            className="absolute pointer-events-none z-50"
                            style={{
                              left: `${(centerX / CANVAS_SIZES[canvasRatio].width) * 100}%`,
                              top: `${(topY / CANVAS_SIZES[canvasRatio].height) * 100}%`,
                              transform: 'translate(-50%, -100%)'
                            }}
                          >
                            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 mb-2 pointer-events-auto">
                              {/* 그룹화/해제 버튼 */}
                              <button
                                onClick={() => {
                                  // 선택된 요소 중 그룹화된 요소가 있는지 확인
                                  const currentCut = cuts.find(cut => cut.id === selectedCutId);
                                  if (!currentCut) return;
                                  
                                  const selectedElements = currentCut.elements.filter(el => selectedElementIds.includes(el.id));
                                  const hasGroupedElements = selectedElements.some(el => el.isGrouped && el.groupId);
                                  
                                  if (hasGroupedElements) {
                                    ungroupSelectedElements();
                                  } else {
                                    groupSelectedElements();
                                  }
                                }}
                                className="flex items-center justify-center w-8 h-8 rounded hover:bg-slate-100 transition-colors"
                                title={(() => {
                                  const currentCut = cuts.find(cut => cut.id === selectedCutId);
                                  if (!currentCut) return "그룹화";
                                  
                                  const selectedElements = currentCut.elements.filter(el => selectedElementIds.includes(el.id));
                                  const hasGroupedElements = selectedElements.some(el => el.isGrouped && el.groupId);
                                  
                                  return hasGroupedElements ? "그룹 해제" : "그룹화";
                                })()}
                              >
                                {(() => {
                                  const currentCut = cuts.find(cut => cut.id === selectedCutId);
                                  if (!currentCut) {
                                    return (
                                      <div className="w-4 h-4 border border-slate-400 rounded-sm relative">
                                        <div className="absolute -top-1 -right-1 w-3 h-3 border border-slate-400 rounded-sm bg-white"></div>
                                      </div>
                                    );
                                  }
                                  
                                  const selectedElements = currentCut.elements.filter(el => selectedElementIds.includes(el.id));
                                  const hasGroupedElements = selectedElements.some(el => el.isGrouped && el.groupId);
                                  
                                  if (hasGroupedElements) {
                                    // 그룹 해제 아이콘 (분리된 사각형들)
                                    return (
                                      <div className="w-4 h-4 relative">
                                        <div className="absolute top-0 left-0 w-2 h-2 border border-red-400 rounded-sm"></div>
                                        <div className="absolute top-2 right-0 w-2 h-2 border border-red-400 rounded-sm"></div>
                                      </div>
                                    );
                                  } else {
                                    // 그룹화 아이콘 (겹친 사각형들)
                                    return (
                                      <div className="w-4 h-4 border border-slate-400 rounded-sm relative">
                                        <div className="absolute -top-1 -right-1 w-3 h-3 border border-slate-400 rounded-sm bg-white"></div>
                                      </div>
                                    );
                                  }
                                })()}
                              </button>
                              
                              {/* 복사 버튼 */}
                              <button
                                onClick={copySelectedElements}
                                className="flex items-center justify-center w-8 h-8 rounded hover:bg-slate-100 transition-colors"
                                title="복사"
                              >
                                <Copy className="w-4 h-4 text-slate-600" />
                              </button>
                              
                              {/* 삭제 버튼 */}
                              <button
                                onClick={() => {
                                  if (confirm(`선택된 ${selectedElementIds.length}개 요소를 삭제하시겠습니까?`)) {
                                    console.log(`🗑️ ${selectedElementIds.length}개 요소를 삭제합니다.`);
                                    pushHistory(prev => ({
                                      ...prev,
                                      cuts: prev.cuts.map(cut => ({
                                        ...cut,
                                        elements: cut.elements.filter(el => !selectedElementIds.includes(el.id))
                                      })),
                                      selectedElementIds: [],
                                      selectedElementId: null
                                    }));
                                    console.log(`✅ ${selectedElementIds.length}개 요소가 삭제되었습니다.`);
                                  }
                                }}
                                className="flex items-center justify-center w-8 h-8 rounded hover:bg-red-50 hover:text-red-600 transition-colors"
                                title="삭제"
                              >
                                <Trash2 className="w-4 h-4 text-slate-600" />
                              </button>
                              
                              {/* 더보기 버튼 */}
                              <button
                                onClick={() => {
                                  // 더 많은 옵션 표시 (향후 구현)
                                }}
                                className="flex items-center justify-center w-8 h-8 rounded hover:bg-slate-100 transition-colors"
                                title="더보기"
                              >
                                <MoreHorizontal className="w-4 h-4 text-slate-600" />
                              </button>
                              
                              {/* 선택 개수 표시 */}
                              <div className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                                {selectedElementIds.length}개
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 스마트 정렬 가이드라인 */}
                      {alignmentGuides.showGuides && selectedCutId === cut.id && (
                        <>
                          {/* 수직 가이드라인 */}
                          {alignmentGuides.vertical.map((x, index) => (
                            <div
                              key={`vertical-${index}`}
                              className="absolute border-l-2 border-blue-400 border-dashed pointer-events-none opacity-70"
                              style={{
                                left: `${(x / CANVAS_SIZES[canvasRatio].width) * 100}%`,
                                top: '0%',
                                height: '100%',
                                width: '0px'
                              }}
                            />
                          ))}
                          
                          {/* 수평 가이드라인 */}
                          {alignmentGuides.horizontal.map((y, index) => (
                            <div
                              key={`horizontal-${index}`}
                              className="absolute border-t-2 border-blue-400 border-dashed pointer-events-none opacity-70"
                              style={{
                                top: `${(y / CANVAS_SIZES[canvasRatio].height) * 100}%`,
                                left: '0%',
                                width: '100%',
                                height: '0px'
                              }}
                            />
                          ))}
                        </>
                      )}

                      {/* 🚫 '여기에 놓기' UI 제거 - 자연스러운 드래그 경험을 위해 */}
                    </div>
                  </div>
                );
              })}
              
              {/* 페이지 추가 버튼 - 캔버스 가로 길이에 정확히 맞춤 */}
              <div className="flex justify-center mt-8">
                <button
                  onClick={addCut}
                  className="flex items-center justify-center gap-2 py-4 border-2 border-dashed border-slate-300 
                           text-slate-500 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 
                           transition-all font-medium rounded-lg bg-white shadow-sm"
                  style={{
                    width: `${CANVAS_SIZES[canvasRatio].width * (zoom / 100)}px`,
                    height: '60px'
                  }}
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm whitespace-nowrap">페이지 추가</span>
                </button>
              </div>
            </div>
          </div>

          {/* 하단 줌 컨트롤 - 고정 */}
          <footer className="h-14 bg-white border-t border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">
                전체 {cuts.length}컷
              </span>
            </div>

            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={handleZoomOut}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600 font-medium mr-2">배율</span>
                <span className="text-xs text-slate-500 w-8">25%</span>
                <Slider
                  value={[zoom]}
                  onValueChange={handleZoomChange}
                  min={25}
                  max={200}
                  step={1}
                  className="w-32"
                />
                <span className="text-xs text-slate-500 w-10">200%</span>
                <span className="text-sm font-semibold text-slate-900 bg-slate-100 px-3 py-1 rounded ml-2">
                  {zoom}%
                </span>
              </div>

              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={handleZoomIn}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>

              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-3"
                onClick={handleFitToScreen}
              >
                <Maximize2 className="h-3 w-3 mr-1" />
                <span className="text-xs">맞춤</span>
              </Button>
            </div>
          </footer>
        </section>

        {/* 오른쪽 속성 패널 - 독립 스크롤 */}
        <aside className="w-80 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex-shrink-0">
            {/* 탭 헤더 */}
            <div className="flex space-x-1 mb-4">
              <button
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  rightPanelTab === 'single'
                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                onClick={() => setRightPanelTab('single')}
              >
                한컷씩 생성하기
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  rightPanelTab === 'batch'
                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                onClick={() => setRightPanelTab('batch')}
              >
                여러컷 생성하기
              </button>
            </div>
            
            {/* 탭별 제목 */}
            {rightPanelTab === 'single' && (
              <>
                <h3 className="font-semibold text-slate-900">한컷씩 생성하기</h3>
                {selectedCut && (
                  <p className="text-sm text-slate-500 mt-1">
                    {selectedCutIndex + 1}컷 편집 중
                  </p>
                )}
              </>
            )}
            {rightPanelTab === 'batch' && (
              <h3 className="font-semibold text-slate-900">여러컷 생성하기</h3>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {rightPanelTab === 'single' && (
              <>
                {/* 캐릭터 & 요소 섹션 - 항상 표시 */}
                <div className="space-y-4 pb-6 mb-6 border-b border-slate-200">
                  <CharacterAndElementSelector
                    selectedCharacters={selectedCharacters}
                    onCharacterToggle={handleCharacterToggle}
                    onAddCharacter={handleAddCharacter}
                    refreshKey={characterRefreshKey}
                    isGeneratingCharacter={isGeneratingCharacter}
                    generatingCharacterInfo={isGeneratingCharacter ? {
                      name: characterName,
                      description: characterDescription
                    } : undefined}
                    // 🎭 AI 대본 기반 자동 선택 정보
                    currentPanelIndex={selectedCutIndex}
                    panelCharacterMap={panelCharacterMap}
                    isAutoSelected={panelCharacterMap.has(selectedCutIndex)}
                    // ✨ 요소 관련 props (새로 추가)
                    selectedElements={selectedElements}
                    onElementsChange={handleElementsChange}
                  />
                </div>

                {selectedCut && (
              <div className="space-y-4">

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    AI 프롬프트
                  </label>
                  <MentionTextArea
                    value={selectedCut.prompt}
                    onChange={(value) => updateCutPrompt(selectedCut.id, value)}
                    characters={mentionCharacters}
                    elements={mentionElements}
                    placeholder="@를 입력해서 캐릭터나 요소를 선택할 수 있습니다. AI가 생성할 장면을 자세히 설명하세요...&#10;예: 햇살이 비치는 카페에서 커피를 마시며 미소짓는 20대 여성, 창가 자리, 따뜻한 조명, 부드러운 웹툰 스타일"
                    className="min-h-[120px] text-sm resize-none border-slate-200"
                    onCharacterSelect={handleCharacterToggle}
                    onElementSelect={(element) => {
                      // 요소를 selectedElements 목록에 추가
                      const newElement = {
                        id: element.id,
                        name: element.name,
                        imageUrl: element.imageUrl,
                        description: element.description
                      };
                      
                      setSelectedElements(prev => {
                        // 이미 선택된 요소인지 확인
                        const isAlreadySelected = prev.some(e => e.id === element.id);
                        if (isAlreadySelected) {
                          console.log('🖼️ 요소가 이미 선택됨:', element.name);
                          return prev; // 중복 선택 방지
                        }
                        
                        const updated = [...prev, newElement];
                        console.log('🖼️ 요소 추가됨:', element.name, '총', updated.length, '개');
                        return updated;
                      });
                    }}
                  />
                </div>

                <Button 
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" 
                  size="sm"
                  onClick={() => {
                    generateImage(selectedCut.id);
                    scrollToCanvas(selectedCut.id); // 이미지 생성 시 해당 캔버스를 상단으로 이동
                  }}
                  disabled={!selectedCut.prompt.trim() || generatingCutIds.has(selectedCut.id)}
                >
                  {generatingCutIds.has(selectedCut.id) ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      이미지 생성
                    </>
                  )}
                </Button>

                {/* 🎯 다중 선택 시 그룹 작업 패널 */}
                {selectedElementIds.length > 1 && (
                  <div className="pt-4 border-t border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-slate-700">
                        그룹 작업 ({selectedElementIds.length}개 선택됨)
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => pushHistory(prev => ({ ...prev, selectedElementIds: [], selectedElementId: null }))}
                        className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      {/* 복사 */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copySelectedElements}
                        className="text-xs"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        복사
                      </Button>
                      
                      {/* 삭제 */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`선택된 ${selectedElementIds.length}개 요소를 삭제하시겠습니까?`)) {
                            pushHistory(prev => ({
                              ...prev,
                              cuts: prev.cuts.map(cut => ({
                                ...cut,
                                elements: cut.elements.filter(el => !selectedElementIds.includes(el.id))
                              })),
                              selectedElementIds: [],
                              selectedElementId: null
                            }));
                          }
                        }}
                        className="text-xs text-red-600 hover:text-red-700 hover:border-red-300"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        삭제
                      </Button>
                    </div>
                    
                    {/* 정렬 버튼들 */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-slate-600">정렬</div>
                      <div className="grid grid-cols-3 gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => alignElements('left')}
                          className="text-xs px-2 py-1"
                        >
                          <AlignLeft className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => alignElements('center')}
                          className="text-xs px-2 py-1"
                        >
                          <AlignCenter className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => alignElements('right')}
                          className="text-xs px-2 py-1"
                        >
                          <AlignRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 선택된 텍스트 요소 속성만 표시 (AI 생성 탭이 아닐 때만) */}
                {selectedElement && selectedElement.type === 'text' && selectedElementIds.length <= 1 && activeTab !== 'ai-character' && (
                  <div className="pt-4 border-t border-slate-200 space-y-3">
                    <h4 className="text-sm font-medium text-slate-700">
                      텍스트 속성
                    </h4>
                    
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">내용</label>
                      <Textarea
                        value={selectedElement.content}
                        onChange={(e) => updateElementContent(selectedElement.id, e.target.value)}
                        className="min-h-[60px] text-sm resize-none border-slate-200"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">크기</label>
                        <Input
                          type="number"
                          value={selectedElement.fontSize}
                          onChange={(e) => {
                            const newSize = parseInt(e.target.value) || 12;
                            updateElementProperty(selectedElement.id, { fontSize: newSize });
                          }}
                          className="text-sm border-slate-200"
                          min="8"
                          max="48"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">색상</label>
                        <Input
                          type="color"
                          value={selectedElement.color}
                          onChange={(e) => {
                            updateElementPropertyDebounced(selectedElement.id, { color: e.target.value });
                          }}
                          className="h-8 border-slate-200"
                        />
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => deleteElement(selectedElement.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      삭제
                    </Button>
                  </div>
                )}

                {selectedCut.imageUrl && (
                  <div className="space-y-3 pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-700">생성된 이미지</p>
                      {/* 삭제 버튼 - 우상단 */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
                        onClick={() => deleteGeneratedImage(selectedCut.id)}
                        title="이미지 삭제"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="relative aspect-square bg-slate-100 overflow-hidden rounded-lg border border-slate-200">
                      <OptimizedCanvasImage
                        src={selectedCut.imageUrl}
                        alt="생성된 이미지"
                        cutId={`sidebar-${selectedCut.id}`}
                        generationId={selectedCut.generationId}
                        className="w-full h-full"
                        style={{
                          objectFit: 'fill'
                        }}
                      />
                    </div>
                    <div className="w-full">
                      <Button 
                        size="sm" 
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                        onClick={() => handleEditImage(selectedCut.id)}
                        disabled={generatingCutIds.has(selectedCut.id)}
                      >
                        <Edit3 className="h-4 w-4 mr-1" />
                        수정
                      </Button>
                    </div>
                  </div>
                )}

              </div>
                )}
              </>
            )}
            
            {rightPanelTab === 'batch' && (
              <>
                {/* 캐릭터 & 요소 섹션 - 여러컷 생성에서도 표시 */}
                <div className="space-y-4 pb-6 mb-6 border-b border-slate-200">
                  <CharacterAndElementSelector
                    selectedCharacters={selectedCharacters}
                    onCharacterToggle={handleCharacterToggle}
                    onAddCharacter={handleAddCharacter}
                    refreshKey={characterRefreshKey}
                    isGeneratingCharacter={isGeneratingCharacter}
                    generatingCharacterInfo={isGeneratingCharacter ? {
                      name: characterName,
                      description: characterDescription
                    } : undefined}
                    // ✨ 요소 관련 props
                    selectedElements={selectedElements}
                    onElementsChange={handleElementsChange}
                  />
                </div>
                
                {/* AI 대본 생성기 */}
                <AIScriptGenerator 
                  onScriptGenerated={handleBatchGeneration}
                  onApplyToCanvas={handleApplyToCanvas}
                  className="border-0 shadow-none p-0 bg-transparent"
                  generatedScript={aiGeneratedScript}
                  setGeneratedScript={setAiGeneratedScript}
                  editedScript={aiEditedScript}
                  setEditedScript={setAiEditedScript}
                  // 🚀 선택된 캐릭터와 요소 ID 전달
                  selectedCharacterIds={selectedCharacters}
                  selectedElementIds={selectedElements.map(el => el.id)}
                />
              </>
            )}
          </div>
        </aside>
      </main>

      {/* 이미지 수정 모달 */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>이미지 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedCut && selectedCut.imageUrl && (
              <div className="relative">
                <img
                  src={selectedCut.imageUrl}
                  alt="수정할 이미지"
                  className="w-full h-auto rounded-lg"
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditModalOpen(false)}>
                취소
              </Button>
              <Button onClick={() => setEditModalOpen(false)}>
                확인
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* 캐릭터 추가 모달 */}
      <AddCharacterModal
        open={addCharacterModalOpen}
        onOpenChange={setAddCharacterModalOpen}
        onCharacterAdded={handleCharacterAdded}
        canvasRatio={canvasRatio}
      />

      {/* 저장 유도 모달 */}
      <Dialog open={savePromptModalOpen} onOpenChange={setSavePromptModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5 text-purple-600" />
              작업 저장
            </DialogTitle>
            <DialogDescription>
              작업한 내용을 저장하시겠습니까?<br />
              저장하지 않으면 변경사항이 사라질 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setSavePromptModalOpen(false);
                if (pendingNavigation) {
                  pendingNavigation();
                  setPendingNavigation(null);
                }
              }}
            >
              저장하지 않고 나가기
            </Button>
            <Button
              onClick={async () => {
                setSavePromptModalOpen(false);
                await handleSaveProject();
                if (pendingNavigation) {
                  pendingNavigation();
                  setPendingNavigation(null);
                }
              }}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Save className="h-4 w-4 mr-2" />
              저장하고 나가기
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 🎯 토큰 업그레이드 모달 */}
      <Dialog open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              토큰이 부족합니다
            </DialogTitle>
            <DialogDescription>
              이미지 생성을 위한 토큰이 부족합니다.<br />
              더 많은 토큰을 얻으려면 멤버십을 업그레이드하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-700">프리미엄 플랜의 혜택</span>
              </div>
              <ul className="text-xs text-purple-600 space-y-1">
                <li>• PRO: 이미지 40만 토큰 (월 ~310장)</li>
                <li>• PREMIUM: 이미지 150만 토큰 (월 ~1,163장)</li>
                <li>• AI 대본 생성 토큰 (300만~1,000만)</li>
                <li>• 5GB~20GB 저장공간</li>
                <li>• 캐릭터 3~5개 등록 가능</li>
              </ul>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setUpgradeModalOpen(false)}
              >
                나중에
              </Button>
              <Button
                onClick={() => {
                  setUpgradeModalOpen(false);
                  window.open('/pricing', '_blank');
                }}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
              >
                <Zap className="h-4 w-4 mr-2" />
                업그레이드하기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteConfirm.isOpen} onOpenChange={(open) => !open && setDeleteConfirm({isOpen: false, imageId: '', imageName: ''})}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              파일 삭제
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              정말로 <span className="font-medium text-slate-800">"{deleteConfirm.imageName}"</span> 파일을 삭제하시겠습니까?
              <br />
              <span className="text-red-500 font-medium">이 작업은 되돌릴 수 없습니다.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteConfirm({isOpen: false, imageId: '', imageName: ''})}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                handleFileDelete(deleteConfirm.imageId);
                setDeleteConfirm({isOpen: false, imageId: '', imageName: ''});
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              삭제
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 저장 성공 알림 */}
      {showSaveSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-right-4">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span className="font-medium">프로젝트가 저장되었습니다!</span>
        </div>
      )}
    </div>
  );
}