"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Layers, 
  Type, 
  MessageCircle, 
  Sparkles,
  Hand,
  MousePointer,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Download,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Save,
  Move,
  Square,
  Circle,
  Heart,
  Star,
  Plus
} from 'lucide-react';
import { BUBBLE_TEMPLATES } from '@/lib/assets/bubble-templates';
import { cn } from '@/lib/utils';

interface CanvasElement {
  id: string;
  type: 'bubble' | 'text' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  content?: string;
  style?: any;
  visible: boolean;
  locked: boolean;
  zIndex: number;
}

interface CanvasEditorProps {
  panelId: string;
  backgroundImage?: string;
  onSave?: (elements: CanvasElement[]) => void;
}

export function CanvasEditor({ panelId, backgroundImage, onSave }: CanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<CanvasElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [elementStart, setElementStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState('');
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<'select' | 'bubble' | 'text'>('select');
  const [history, setHistory] = useState<CanvasElement[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [canvasSize] = useState({ width: 800, height: 800 });

  // 캔버스 초기화 및 렌더링
  useEffect(() => {
    renderCanvas();
  }, [elements, selectedElement, zoom, backgroundImage]);

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 캔버스 클리어
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 배경색
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 배경 이미지 그리기
    if (backgroundImage) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawElements(ctx);
      };
      img.src = backgroundImage;
    } else {
      drawElements(ctx);
    }
  };

  const drawElements = (ctx: CanvasRenderingContext2D) => {
    // 정렬된 요소들 그리기
    const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);
    
    sortedElements.forEach(element => {
      if (!element.visible) return;
      
      ctx.save();
      ctx.translate(element.x + element.width / 2, element.y + element.height / 2);
      ctx.rotate((element.rotation * Math.PI) / 180);
      ctx.translate(-element.width / 2, -element.height / 2);

      switch (element.type) {
        case 'bubble':
          drawBubble(ctx, element);
          break;
        case 'text':
          drawText(ctx, element);
          break;
      }

      ctx.restore();

      // 선택된 요소 핸들 그리기
      if (selectedElement?.id === element.id && !element.locked) {
        drawSelectionHandles(ctx, element);
      }
    });
  };

  const drawBubble = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
    ctx.fillStyle = element.style?.backgroundColor || '#ffffff';
    ctx.strokeStyle = element.style?.borderColor || '#000000';
    ctx.lineWidth = element.style?.borderWidth || 2;

    const bubbleType = element.style?.type || 'round';
    
    switch (bubbleType) {
      case 'round':
        // 둥근 말풍선
        ctx.beginPath();
        ctx.ellipse(element.width / 2, element.height / 2, element.width / 2, element.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
        
      case 'rectangle':
        // 사각형 말풍선
        const radius = 10;
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(element.width - radius, 0);
        ctx.quadraticCurveTo(element.width, 0, element.width, radius);
        ctx.lineTo(element.width, element.height - radius);
        ctx.quadraticCurveTo(element.width, element.height, element.width - radius, element.height);
        ctx.lineTo(radius, element.height);
        ctx.quadraticCurveTo(0, element.height, 0, element.height - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
        
      case 'cloud':
        // 구름 모양 말풍선
        drawCloudBubble(ctx, element.width, element.height);
        ctx.fill();
        ctx.stroke();
        break;
        
      case 'jagged':
        // 톱니 모양 말풍선
        drawJaggedBubble(ctx, element.width, element.height);
        ctx.fill();
        ctx.stroke();
        break;
    }

    // 꼬리 그리기
    if (element.style?.tailPosition) {
      drawTail(ctx, element);
    }
  };

  const drawCloudBubble = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.beginPath();
    ctx.arc(width * 0.3, height * 0.3, width * 0.2, 0, Math.PI * 2);
    ctx.arc(width * 0.5, height * 0.25, width * 0.25, 0, Math.PI * 2);
    ctx.arc(width * 0.7, height * 0.3, width * 0.2, 0, Math.PI * 2);
    ctx.arc(width * 0.65, height * 0.55, width * 0.22, 0, Math.PI * 2);
    ctx.arc(width * 0.35, height * 0.55, width * 0.22, 0, Math.PI * 2);
    ctx.closePath();
  };

  const drawJaggedBubble = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const points = 20;
    ctx.beginPath();
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const radius = i % 2 === 0 ? width * 0.45 : width * 0.35;
      const x = (width / 2) + Math.cos(angle) * radius;
      const y = (height / 2) + Math.sin(angle) * radius;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
  };

  const drawTail = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
    const { tailPosition } = element.style;
    if (!tailPosition) return;

    ctx.beginPath();
    ctx.moveTo(element.width / 2 - 10, element.height - 2);
    ctx.lineTo(tailPosition.x, tailPosition.y);
    ctx.lineTo(element.width / 2 + 10, element.height - 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  const drawText = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
    ctx.fillStyle = element.style?.color || '#000000';
    ctx.font = `${element.style?.fontWeight || 'normal'} ${element.style?.fontSize || 16}px ${element.style?.fontFamily || 'Noto Sans KR'}`;
    ctx.textAlign = element.style?.textAlign || 'center';
    ctx.textBaseline = 'middle';
    
    const text = element.content || '';
    const lines = text.split('\n');
    const lineHeight = (element.style?.fontSize || 16) * 1.2;
    
    lines.forEach((line, index) => {
      const y = element.height / 2 + (index - (lines.length - 1) / 2) * lineHeight;
      ctx.fillText(line, element.width / 2, y, element.width);
    });
  };

  const drawSelectionHandles = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
    ctx.strokeStyle = '#4299e1';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(element.x, element.y, element.width, element.height);
    ctx.setLineDash([]);

    // 리사이즈 핸들
    const handleSize = 8;
    const handles = [
      { x: element.x, y: element.y, cursor: 'nw-resize' },
      { x: element.x + element.width / 2, y: element.y, cursor: 'n-resize' },
      { x: element.x + element.width, y: element.y, cursor: 'ne-resize' },
      { x: element.x + element.width, y: element.y + element.height / 2, cursor: 'e-resize' },
      { x: element.x + element.width, y: element.y + element.height, cursor: 'se-resize' },
      { x: element.x + element.width / 2, y: element.y + element.height, cursor: 's-resize' },
      { x: element.x, y: element.y + element.height, cursor: 'sw-resize' },
      { x: element.x, y: element.y + element.height / 2, cursor: 'w-resize' },
    ];

    handles.forEach(handle => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeStyle = '#4299e1';
      ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
    });
  };

  // 마우스 이벤트 핸들러
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 요소 선택
    const clickedElement = elements.find(el => 
      x >= el.x && x <= el.x + el.width &&
      y >= el.y && y <= el.y + el.height
    );

    if (clickedElement && !clickedElement.locked) {
      setSelectedElement(clickedElement);
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setElementStart({ x: clickedElement.x, y: clickedElement.y });
    } else if (tool === 'bubble') {
      // 새 말풍선 추가
      addBubble(x, y);
    } else if (tool === 'text') {
      // 새 텍스트 추가
      addText(x, y);
    } else {
      setSelectedElement(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedElement) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    setElements(prev => prev.map(el => 
      el.id === selectedElement.id 
        ? { ...el, x: elementStart.x + deltaX, y: elementStart.y + deltaY }
        : el
    ));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    if (isDragging || isResizing) {
      saveToHistory();
    }
  };

  // 요소 추가 함수
  const addBubble = (x: number, y: number) => {
    const template = BUBBLE_TEMPLATES[0];
    const newBubble: CanvasElement = {
      id: `bubble-${Date.now()}`,
      type: 'bubble',
      x: x - template.defaultSize.width / 2,
      y: y - template.defaultSize.height / 2,
      width: template.defaultSize.width,
      height: template.defaultSize.height,
      rotation: 0,
      style: {
        type: template.style,
        backgroundColor: '#ffffff',
        borderColor: '#000000',
        borderWidth: 2,
      },
      visible: true,
      locked: false,
      zIndex: elements.length,
    };

    setElements(prev => [...prev, newBubble]);
    setSelectedElement(newBubble);
    saveToHistory();
  };

  const addText = (x: number, y: number) => {
    const newText: CanvasElement = {
      id: `text-${Date.now()}`,
      type: 'text',
      x: x - 100,
      y: y - 20,
      width: 200,
      height: 40,
      rotation: 0,
      content: '텍스트를 입력하세요',
      style: {
        fontSize: 16,
        fontFamily: 'Noto Sans KR',
        fontWeight: 'normal',
        color: '#000000',
        textAlign: 'center',
      },
      visible: true,
      locked: false,
      zIndex: elements.length,
    };

    setElements(prev => [...prev, newText]);
    setSelectedElement(newText);
    setEditingText(newText.id);
    saveToHistory();
  };

  // 히스토리 관리
  const saveToHistory = () => {
    const newHistory = [...history.slice(0, historyIndex + 1), [...elements]];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setElements(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setElements(history[historyIndex + 1]);
    }
  };

  // 요소 조작 함수
  const deleteElement = (id: string) => {
    setElements(prev => prev.filter(el => el.id !== id));
    setSelectedElement(null);
    saveToHistory();
  };

  const duplicateElement = (element: CanvasElement) => {
    const newElement = {
      ...element,
      id: `${element.type}-${Date.now()}`,
      x: element.x + 20,
      y: element.y + 20,
      zIndex: elements.length,
    };
    setElements(prev => [...prev, newElement]);
    setSelectedElement(newElement);
    saveToHistory();
  };

  const toggleVisibility = (id: string) => {
    setElements(prev => prev.map(el => 
      el.id === id ? { ...el, visible: !el.visible } : el
    ));
  };

  const toggleLock = (id: string) => {
    setElements(prev => prev.map(el => 
      el.id === id ? { ...el, locked: !el.locked } : el
    ));
  };

  // 내보내기
  const exportCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `webtoon-panel-${panelId}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  // 저장
  const handleSave = () => {
    if (onSave) {
      onSave(elements);
    }
  };

  return (
    <div className="flex h-full bg-gray-100">
      {/* 왼쪽 툴바 */}
      <div className="w-16 bg-gray-900 flex flex-col items-center py-4 gap-2">
        <Button
          variant={tool === 'select' ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => setTool('select')}
          title="선택"
        >
          <MousePointer className="h-5 w-5" />
        </Button>
        <Button
          variant={tool === 'bubble' ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => setTool('bubble')}
          title="말풍선"
        >
          <MessageCircle className="h-5 w-5" />
        </Button>
        <Button
          variant={tool === 'text' ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => setTool('text')}
          title="텍스트"
        >
          <Type className="h-5 w-5" />
        </Button>
        
        <div className="flex-1" />
        
        <Button variant="ghost" size="icon" onClick={undo} title="실행 취소">
          <Undo className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={redo} title="다시 실행">
          <Redo className="h-5 w-5" />
        </Button>
      </div>

      {/* 메인 캔버스 영역 */}
      <div className="flex-1 relative overflow-hidden">
        {/* 상단 툴바 */}
        <div className="absolute top-0 left-0 right-0 h-12 bg-white border-b flex items-center px-4 gap-2 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{Math.round(zoom * 100)}%</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(Math.min(3, zoom + 0.1))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          <div className="flex-1" />
          
          <Button variant="outline" size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            저장
          </Button>
          <Button variant="outline" size="sm" onClick={exportCanvas}>
            <Download className="h-4 w-4 mr-2" />
            내보내기
          </Button>
        </div>

        {/* 캔버스 */}
        <div 
          ref={containerRef}
          className="absolute inset-0 top-12 flex items-center justify-center"
          style={{ transform: `scale(${zoom})` }}
        >
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="bg-white shadow-lg cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
      </div>

      {/* 오른쪽 패널 */}
      <div className="w-80 bg-white border-l">
        <Tabs defaultValue="layers" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="layers">레이어</TabsTrigger>
            <TabsTrigger value="assets">에셋</TabsTrigger>
          </TabsList>
          
          <TabsContent value="layers" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                {elements.map(element => (
                  <div
                    key={element.id}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded border",
                      selectedElement?.id === element.id ? "border-blue-500 bg-blue-50" : "border-gray-200"
                    )}
                    onClick={() => setSelectedElement(element)}
                  >
                    <span className="flex-1 text-sm">
                      {element.type === 'bubble' ? '말풍선' : '텍스트'}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleVisibility(element.id);
                      }}
                    >
                      {element.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLock(element.id);
                      }}
                    >
                      {element.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateElement(element);
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteElement(element.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="assets" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">
                <h3 className="font-semibold mb-3">말풍선 템플릿</h3>
                <div className="grid grid-cols-2 gap-2">
                  {BUBBLE_TEMPLATES.map(template => (
                    <Button
                      key={template.id}
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center"
                      onClick={() => {
                        setTool('bubble');
                        // 템플릿 스타일 저장
                      }}
                    >
                      <span className="text-2xl mb-1">{template.preview}</span>
                      <span className="text-xs">{template.name}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* 텍스트 편집 모달 */}
      {editingText && selectedElement?.type === 'text' && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <h3 className="text-lg font-semibold mb-4">텍스트 편집</h3>
            <Textarea
              value={selectedElement.content}
              onChange={(e) => {
                setElements(prev => prev.map(el => 
                  el.id === selectedElement.id 
                    ? { ...el, content: e.target.value }
                    : el
                ));
              }}
              className="w-80 h-32 mb-4"
              placeholder="텍스트를 입력하세요..."
            />
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setEditingText(null);
                  saveToHistory();
                }}
              >
                완료
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditingText(null)}
              >
                취소
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}