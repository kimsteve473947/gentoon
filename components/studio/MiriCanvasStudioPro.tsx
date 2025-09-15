"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { MiriCanvasSidebarPro } from "./MiriCanvasSidebarPro";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
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
  Copy,
  ChevronUp,
  ChevronDown,
  MoreVertical,
  Image as ImageIcon,
  Layers,
  Sparkles,
  FileText,
  Settings
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// 캔버스 크기 정의 (미리캔버스처럼 적절한 표시 크기)
const CANVAS_SIZES = {
  '4:5': { width: 320, height: 400, actualWidth: 1080, actualHeight: 1350, label: '세로형' },
  '1:1': { width: 320, height: 320, actualWidth: 1080, actualHeight: 1080, label: '정사각형' }
};

type CanvasRatio = '4:5' | '1:1';

// 캔버스 요소 타입
interface CanvasElement {
  id: string;
  type: 'text' | 'bubble' | 'image';
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  bubbleStyle?: 'speech' | 'thought' | 'shout';
  rotation?: number;
  zIndex?: number;
}

// 컷(페이지) 타입
interface WebtoonCut {
  id: string;
  prompt: string;
  imageUrl?: string;
  elements: CanvasElement[];
  isGenerating?: boolean;
}

export function MiriCanvasStudioPro() {
  const [canvasRatio, setCanvasRatio] = useState<CanvasRatio>('4:5');
  const [zoom, setZoom] = useState<number>(100);
  const [cuts, setCuts] = useState<WebtoonCut[]>([
    { id: '1', prompt: '', elements: [] }
  ]);
  const [selectedCutId, setSelectedCutId] = useState<string>('1');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<'se' | 'sw' | 'ne' | 'nw' | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [elementStart, setElementStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // 줌 관련 함수
  const handleZoomChange = (value: number[]) => {
    setZoom(value[0]);
  };

  const handleZoomIn = () => {
    setZoom(Math.min(200, zoom + 25));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(25, zoom - 25));
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
    setCuts([...cuts, newCut]);
    setSelectedCutId(newCut.id);
  };

  const deleteCut = (cutId: string) => {
    if (cuts.length > 1) {
      const newCuts = cuts.filter(cut => cut.id !== cutId);
      setCuts(newCuts);
      if (selectedCutId === cutId) {
        setSelectedCutId(newCuts[0].id);
      }
    }
  };

  const duplicateCut = (cutId: string) => {
    const cutToDuplicate = cuts.find(cut => cut.id === cutId);
    if (cutToDuplicate) {
      const newCut: WebtoonCut = {
        ...cutToDuplicate,
        id: Date.now().toString(),
        elements: cutToDuplicate.elements.map(el => ({
          ...el,
          id: Date.now().toString() + Math.random()
        }))
      };
      const cutIndex = cuts.findIndex(cut => cut.id === cutId);
      const newCuts = [...cuts];
      newCuts.splice(cutIndex + 1, 0, newCut);
      setCuts(newCuts);
    }
  };

  const updateCutPrompt = (cutId: string, prompt: string) => {
    setCuts(cuts.map(cut => 
      cut.id === cutId ? { ...cut, prompt } : cut
    ));
  };

  const moveCut = (cutId: string, direction: 'up' | 'down') => {
    const index = cuts.findIndex(cut => cut.id === cutId);
    if (
      (direction === 'up' && index > 0) ||
      (direction === 'down' && index < cuts.length - 1)
    ) {
      const newCuts = [...cuts];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      [newCuts[index], newCuts[newIndex]] = [newCuts[newIndex], newCuts[index]];
      setCuts(newCuts);
    }
  };

  // 요소 추가 함수
  const addElement = (type: 'text' | 'bubble', content: string = '') => {
    const selectedCut = cuts.find(cut => cut.id === selectedCutId);
    if (!selectedCut) return;

    const canvasSize = CANVAS_SIZES[canvasRatio];
    const newElement: CanvasElement = {
      id: Date.now().toString(),
      type,
      content: content || (type === 'text' ? '텍스트를 입력하세요' : '대사를 입력하세요'),
      x: 50 + Math.random() * (canvasSize.width - 200),
      y: 50 + Math.random() * (canvasSize.height - 100),
      width: type === 'bubble' ? 120 : 100,
      height: type === 'bubble' ? 60 : 30,
      fontSize: 14,
      fontFamily: 'Noto Sans KR',
      color: '#000000',
      bubbleStyle: type === 'bubble' ? 'speech' : undefined,
      zIndex: selectedCut.elements.length
    };

    setCuts(cuts.map(cut => 
      cut.id === selectedCutId 
        ? { ...cut, elements: [...cut.elements, newElement] }
        : cut
    ));
    setSelectedElementId(newElement.id);
  };

  // 드래그 & 리사이즈 핸들러들 (이전과 동일)
  const handleMouseDown = (e: React.MouseEvent, elementId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const element = selectedCut?.elements.find(el => el.id === elementId);
    if (!element) return;

    setIsDragging(true);
    setSelectedElementId(elementId);
    setDragStart({ x: e.clientX, y: e.clientY });
    setElementStart({ x: element.x, y: element.y, width: element.width, height: element.height });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, elementId: string, handle: 'se' | 'sw' | 'ne' | 'nw') => {
    e.preventDefault();
    e.stopPropagation();
    const element = selectedCut?.elements.find(el => el.id === elementId);
    if (!element) return;

    setIsResizing(true);
    setResizeHandle(handle);
    setSelectedElementId(elementId);
    setDragStart({ x: e.clientX, y: e.clientY });
    setElementStart({ x: element.x, y: element.y, width: element.width, height: element.height });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    if (isDragging && selectedElementId) {
      setCuts(prevCuts => prevCuts.map(cut => {
        if (cut.id !== selectedCutId) return cut;
        
        return {
          ...cut,
          elements: cut.elements.map(el => {
            if (el.id !== selectedElementId) return el;
            return {
              ...el,
              x: Math.max(0, Math.min(CANVAS_SIZES[canvasRatio].width - el.width, elementStart.x + deltaX / (zoom / 100))),
              y: Math.max(0, Math.min(CANVAS_SIZES[canvasRatio].height - el.height, elementStart.y + deltaY / (zoom / 100)))
            };
          })
        };
      }));
    } else if (isResizing && selectedElementId && resizeHandle) {
      setCuts(prevCuts => prevCuts.map(cut => {
        if (cut.id !== selectedCutId) return cut;
        
        return {
          ...cut,
          elements: cut.elements.map(el => {
            if (el.id !== selectedElementId) return el;
            
            const scaleFactor = zoom / 100;
            const adjustedDeltaX = deltaX / scaleFactor;
            const adjustedDeltaY = deltaY / scaleFactor;
            
            let newX = elementStart.x;
            let newY = elementStart.y;
            let newWidth = elementStart.width;
            let newHeight = elementStart.height;
            
            switch (resizeHandle) {
              case 'se':
                newWidth = Math.max(20, elementStart.width + adjustedDeltaX);
                newHeight = Math.max(20, elementStart.height + adjustedDeltaY);
                break;
              case 'sw':
                newX = elementStart.x + adjustedDeltaX;
                newWidth = Math.max(20, elementStart.width - adjustedDeltaX);
                newHeight = Math.max(20, elementStart.height + adjustedDeltaY);
                break;
              case 'ne':
                newY = elementStart.y + adjustedDeltaY;
                newWidth = Math.max(20, elementStart.width + adjustedDeltaX);
                newHeight = Math.max(20, elementStart.height - adjustedDeltaY);
                break;
              case 'nw':
                newX = elementStart.x + adjustedDeltaX;
                newY = elementStart.y + adjustedDeltaY;
                newWidth = Math.max(20, elementStart.width - adjustedDeltaX);
                newHeight = Math.max(20, elementStart.height - adjustedDeltaY);
                break;
            }
            
            return {
              ...el,
              x: Math.max(0, newX),
              y: Math.max(0, newY),
              width: newWidth,
              height: newHeight
            };
          })
        };
      }));
    }
  }, [isDragging, isResizing, selectedElementId, resizeHandle, dragStart, elementStart, selectedCutId, zoom, canvasRatio]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  // 요소 삭제
  const deleteElement = (elementId: string) => {
    setCuts(cuts.map(cut => {
      if (cut.id !== selectedCutId) return cut;
      return {
        ...cut,
        elements: cut.elements.filter(el => el.id !== elementId)
      };
    }));
    setSelectedElementId(null);
  };

  // 요소 내용 업데이트
  const updateElementContent = (elementId: string, content: string) => {
    setCuts(cuts.map(cut => {
      if (cut.id !== selectedCutId) return cut;
      return {
        ...cut,
        elements: cut.elements.map(el => 
          el.id === elementId ? { ...el, content } : el
        )
      };
    }));
  };

  const selectedCut = cuts.find(cut => cut.id === selectedCutId);
  const selectedCutIndex = cuts.findIndex(cut => cut.id === selectedCutId);
  const selectedElement = selectedCut?.elements.find(el => el.id === selectedElementId);

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50">
      {/* 상단 헤더 - 미리캔버스 스타일 */}
      <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              GenToon 스튜디오
            </h1>
          </div>
          
          {/* 캔버스 크기 선택 - 미리캔버스 스타일 */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium",
                canvasRatio === '4:5' 
                  ? "bg-white shadow-sm text-purple-600 border border-purple-200" 
                  : "text-slate-600 hover:text-slate-900"
              )}
              onClick={() => setCanvasRatio('4:5')}
            >
              <RectangleVertical className="h-4 w-4" />
              <span>{CANVAS_SIZES['4:5'].label}</span>
              <span className="text-xs text-slate-400">{CANVAS_SIZES['4:5'].actualWidth}×{CANVAS_SIZES['4:5'].actualHeight}</span>
            </button>
            <button
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium",
                canvasRatio === '1:1' 
                  ? "bg-white shadow-sm text-purple-600 border border-purple-200" 
                  : "text-slate-600 hover:text-slate-900"
              )}
              onClick={() => setCanvasRatio('1:1')}
            >
              <Square className="h-4 w-4" />
              <span>{CANVAS_SIZES['1:1'].label}</span>
              <span className="text-xs text-slate-400">{CANVAS_SIZES['1:1'].actualWidth}×{CANVAS_SIZES['1:1'].actualHeight}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
              <Undo className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
              <Redo className="h-4 w-4" />
            </Button>
          </div>
          <div className="w-px h-6 bg-slate-200" />
          <Button variant="ghost" size="sm" className="h-9 px-3">
            <Share2 className="h-4 w-4 mr-2" />
            공유
          </Button>
          <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-9 px-4" size="sm">
            <Download className="h-4 w-4 mr-2" />
            다운로드
          </Button>
        </div>
      </div>

      {/* 메인 워크스페이스 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 왼쪽 사이드바 */}
        <MiriCanvasSidebarPro 
          onAddText={(text) => addElement('text', text)}
          onAddBubble={(text) => addElement('bubble', text)}
        />
        
        {/* 중앙 캔버스 영역 */}
        <div className="flex-1 flex flex-col bg-slate-50">
          {/* 페이지 정보 바 */}
          <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-700">
                {selectedCutIndex + 1}컷 / {cuts.length}컷
              </span>
              <div className="text-xs text-slate-500">
                {CANVAS_SIZES[canvasRatio].actualWidth} × {CANVAS_SIZES[canvasRatio].actualHeight}px
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" className="h-8 px-3">
                <Layers className="h-4 w-4 mr-1" />
                레이어
              </Button>
            </div>
          </div>

          {/* 캔버스 컨테이너 */}
          <div className="flex-1 overflow-auto p-8 flex justify-center">
            <div className="flex flex-col items-center gap-8">
              {cuts.map((cut, index) => (
                <div
                  key={cut.id}
                  className={cn(
                    "relative group transition-all duration-200",
                    selectedCutId === cut.id && "drop-shadow-xl"
                  )}
                  style={{
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'center top'
                  }}
                >
                  {/* 컷 번호 및 컨트롤 */}
                  <div className="absolute -left-12 top-0 flex flex-col items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 hover:bg-slate-200"
                        onClick={() => moveCut(cut.id, 'up')}
                        disabled={index === 0}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 hover:bg-slate-200"
                        onClick={() => moveCut(cut.id, 'down')}
                        disabled={index === cuts.length - 1}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* 캔버스 */}
                  <div
                    ref={canvasRef}
                    className={cn(
                      "bg-white shadow-lg rounded-xl overflow-hidden cursor-pointer relative border-2",
                      selectedCutId === cut.id ? "border-purple-300" : "border-slate-200 hover:border-slate-300"
                    )}
                    style={{
                      width: CANVAS_SIZES[canvasRatio].width,
                      height: CANVAS_SIZES[canvasRatio].height
                    }}
                    onClick={() => {
                      setSelectedCutId(cut.id);
                      setSelectedElementId(null);
                    }}
                  >
                    {/* 배경 이미지 */}
                    {cut.imageUrl ? (
                      <img 
                        src={cut.imageUrl} 
                        alt={`${index + 1}컷`}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                        <ImageIcon className="h-16 w-16 mb-3 opacity-30" />
                        <p className="text-sm font-medium opacity-60">AI 이미지를 생성하세요</p>
                      </div>
                    )}

                    {/* 캔버스 요소들 */}
                    {cut.elements.map(element => (
                      <div
                        key={element.id}
                        className={cn(
                          "absolute border-2 rounded cursor-move transition-all",
                          selectedElementId === element.id 
                            ? "border-purple-500 shadow-lg" 
                            : "border-transparent hover:border-purple-300"
                        )}
                        style={{
                          left: element.x,
                          top: element.y,
                          width: element.width,
                          height: element.height,
                          zIndex: element.zIndex
                        }}
                        onMouseDown={(e) => handleMouseDown(e, element.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId(element.id);
                        }}
                      >
                        {element.type === 'text' ? (
                          <div
                            className="w-full h-full flex items-center justify-center p-2 font-medium"
                            style={{
                              fontSize: element.fontSize,
                              fontFamily: element.fontFamily,
                              color: element.color
                            }}
                          >
                            {element.content}
                          </div>
                        ) : element.type === 'bubble' ? (
                          <div className="w-full h-full relative">
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
                                rx="8"
                                fill="white"
                                stroke="#666"
                                strokeWidth="1"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center p-3">
                              <span 
                                className="text-center text-sm font-medium"
                                style={{ fontSize: element.fontSize }}
                              >
                                {element.content}
                              </span>
                            </div>
                          </div>
                        ) : null}

                        {/* 삭제 버튼 */}
                        {selectedElementId === element.id && (
                          <button
                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteElement(element.id);
                            }}
                          >
                            ×
                          </button>
                        )}
                        
                        {/* 리사이즈 핸들 */}
                        {selectedElementId === element.id && (
                          <>
                            <div
                              className="absolute -bottom-1 -right-1 w-2 h-2 bg-purple-500 cursor-se-resize rounded-sm"
                              onMouseDown={(e) => handleResizeMouseDown(e, element.id, 'se')}
                            />
                            <div
                              className="absolute -bottom-1 -left-1 w-2 h-2 bg-purple-500 cursor-sw-resize rounded-sm"
                              onMouseDown={(e) => handleResizeMouseDown(e, element.id, 'sw')}
                            />
                            <div
                              className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 cursor-ne-resize rounded-sm"
                              onMouseDown={(e) => handleResizeMouseDown(e, element.id, 'ne')}
                            />
                            <div
                              className="absolute -top-1 -left-1 w-2 h-2 bg-purple-500 cursor-nw-resize rounded-sm"
                              onMouseDown={(e) => handleResizeMouseDown(e, element.id, 'nw')}
                            />
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* 컷 액션 메뉴 */}
                  <div className="absolute -right-10 top-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-200">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-32">
                        <DropdownMenuItem onClick={() => duplicateCut(cut.id)}>
                          <Copy className="h-4 w-4 mr-2" />
                          복제
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => deleteCut(cut.id)}
                          disabled={cuts.length === 1}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}

              {/* 페이지 추가 버튼 */}
              <button
                onClick={addCut}
                className="w-full max-w-[320px] h-20 border-2 border-dashed border-slate-300 rounded-xl 
                         flex items-center justify-center gap-3 text-slate-500 hover:border-purple-400 
                         hover:text-purple-600 hover:bg-purple-50 transition-all font-medium"
                style={{
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'center top'
                }}
              >
                <Plus className="h-5 w-5" />
                <span>페이지 추가</span>
              </button>
            </div>
          </div>

          {/* 하단 줌 컨트롤 */}
          <div className="h-14 bg-white border-t border-slate-200 flex items-center justify-between px-6">
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
                <span className="text-xs text-slate-500 w-8">25%</span>
                <Slider
                  value={[zoom]}
                  onValueChange={handleZoomChange}
                  min={25}
                  max={200}
                  step={25}
                  className="w-24"
                />
                <span className="text-xs text-slate-500 w-10">200%</span>
                <span className="text-xs font-medium text-slate-700 w-10 text-center">
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

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-xs h-8 px-3">
                <Settings className="h-3 w-3 mr-1" />
                설정
              </Button>
            </div>
          </div>
        </div>

        {/* 오른쪽 속성 패널 */}
        <div className="w-80 bg-white border-l border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">속성 편집</h3>
            {selectedCut && (
              <p className="text-sm text-slate-500 mt-1">
                {selectedCutIndex + 1}컷 편집 중
              </p>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {selectedCut && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    AI 프롬프트
                  </label>
                  <Textarea
                    value={selectedCut.prompt}
                    onChange={(e) => updateCutPrompt(selectedCut.id, e.target.value)}
                    placeholder="AI가 생성할 장면을 자세히 설명하세요..."
                    className="min-h-[120px] text-sm resize-none border-slate-200"
                  />
                </div>

                <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" size="sm">
                  <Sparkles className="h-4 w-4 mr-2" />
                  이미지 생성
                </Button>

                {/* 선택된 요소 속성 */}
                {selectedElement && (
                  <div className="pt-4 border-t border-slate-200 space-y-3">
                    <h4 className="text-sm font-medium text-slate-700">
                      {selectedElement.type === 'text' ? '텍스트' : '말풍선'} 속성
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
                        <label className="text-xs text-slate-600 mb-1 block">X 위치</label>
                        <input
                          type="number"
                          value={Math.round(selectedElement.x)}
                          onChange={(e) => {
                            const newX = parseInt(e.target.value) || 0;
                            setCuts(cuts.map(cut => {
                              if (cut.id !== selectedCutId) return cut;
                              return {
                                ...cut,
                                elements: cut.elements.map(el =>
                                  el.id === selectedElement.id ? { ...el, x: newX } : el
                                )
                              };
                            }));
                          }}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">Y 위치</label>
                        <input
                          type="number"
                          value={Math.round(selectedElement.y)}
                          onChange={(e) => {
                            const newY = parseInt(e.target.value) || 0;
                            setCuts(cuts.map(cut => {
                              if (cut.id !== selectedCutId) return cut;
                              return {
                                ...cut,
                                elements: cut.elements.map(el =>
                                  el.id === selectedElement.id ? { ...el, y: newY } : el
                                )
                              };
                            }));
                          }}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-sm"
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
                    <p className="text-sm font-medium text-slate-700">생성된 이미지</p>
                    <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden">
                      <img 
                        src={selectedCut.imageUrl} 
                        alt="생성된 이미지"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <Button variant="outline" size="sm" className="w-full">
                      재생성
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}