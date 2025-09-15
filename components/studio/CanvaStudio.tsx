"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Wand2, MessageCircle, Type, Sparkles, Image, 
  Download, Save, Share2, Undo, Redo, ZoomIn, ZoomOut,
  Trash2, Copy, Eye, EyeOff, Lock, Unlock, ChevronLeft,
  ChevronRight, Plus, Palette, Bold, Italic, AlignLeft,
  AlignCenter, AlignRight, Upload, Layers, Grid
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStudioStore } from '@/lib/stores/studio-store';
import { BUBBLE_TEMPLATES, BUBBLE_COLORS } from '@/lib/assets/bubble-templates';

// 캔버스 요소 타입
interface CanvasElement {
  id: string;
  type: 'background' | 'bubble' | 'text' | 'sticker' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  content?: string;
  imageUrl?: string;
  style?: any;
}

// 드래그 가능한 요소 컴포넌트
function DraggableElement({ type, data, children }: any) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'element',
    item: { type, data },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag}
      className={cn(
        "cursor-move transition-opacity",
        isDragging && "opacity-50"
      )}
    >
      {children}
    </div>
  );
}

// 내부 스튜디오 컴포넌트 (DndProvider 내부에서 실행)
function CanvaStudioInner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<CanvasElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [elementStart, setElementStart] = useState({ x: 0, y: 0 });
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [projectName, setProjectName] = useState("제목 없는 웹툰");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [history, setHistory] = useState<CanvasElement[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const { generatePanel } = useStudioStore();

  // 캔버스 드롭 영역 설정
  const [{ canDrop, isOver }, drop] = useDrop(() => ({
    accept: 'element',
    drop: (item: any, monitor) => {
      const offset = monitor.getClientOffset();
      if (offset && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = (offset.x - rect.left) / zoom;
        const y = (offset.y - rect.top) / zoom;
        addElement(item.type, item.data, x, y);
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
    }),
  }));

  // 캔버스 렌더링
  useEffect(() => {
    renderCanvas();
  }, [elements, selectedElement, zoom]);

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Grid
    if (zoom > 0.5) {
      ctx.strokeStyle = '#e5e5e5';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < canvas.width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 20) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }
    }

    // Render elements
    const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);
    sortedElements.forEach(element => {
      if (!element.visible) return;
      
      ctx.save();
      ctx.translate(element.x + element.width / 2, element.y + element.height / 2);
      ctx.rotate((element.rotation * Math.PI) / 180);
      ctx.translate(-element.width / 2, -element.height / 2);

      switch (element.type) {
        case 'background':
        case 'image':
          if (element.imageUrl) {
            const img = new Image();
            img.onload = () => {
              ctx.drawImage(img, 0, 0, element.width, element.height);
            };
            img.src = element.imageUrl;
          }
          break;
          
        case 'bubble':
          drawBubble(ctx, element);
          break;
          
        case 'text':
          drawText(ctx, element);
          break;
      }

      ctx.restore();

      // Selection handles
      if (selectedElement?.id === element.id && !element.locked) {
        drawSelectionHandles(ctx, element);
      }
    });
  };

  const drawBubble = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
    ctx.fillStyle = element.style?.backgroundColor || '#ffffff';
    ctx.strokeStyle = element.style?.borderColor || '#000000';
    ctx.lineWidth = element.style?.borderWidth || 2;

    const style = element.style?.bubbleStyle || 'round';
    
    switch (style) {
      case 'round':
        ctx.beginPath();
        ctx.ellipse(element.width / 2, element.height / 2, element.width / 2, element.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
        
      case 'rectangle':
        const radius = 10;
        ctx.beginPath();
        ctx.roundRect(0, 0, element.width, element.height, radius);
        ctx.fill();
        ctx.stroke();
        break;
        
      case 'cloud':
        // Cloud bubble
        ctx.beginPath();
        const cloudRadius = Math.min(element.width, element.height) * 0.15;
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const x = element.width / 2 + Math.cos(angle) * (element.width / 2 - cloudRadius);
          const y = element.height / 2 + Math.sin(angle) * (element.height / 2 - cloudRadius);
          ctx.arc(x, y, cloudRadius, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();
        break;
        
      case 'jagged':
        // Jagged bubble
        ctx.beginPath();
        const points = 16;
        for (let i = 0; i < points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const radius = i % 2 === 0 ? element.width * 0.5 : element.width * 0.4;
          const x = element.width / 2 + Math.cos(angle) * radius;
          const y = element.height / 2 + Math.sin(angle) * (element.height / element.width) * radius;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
    }

    // Tail
    if (element.style?.hasTail) {
      ctx.beginPath();
      ctx.moveTo(element.width * 0.4, element.height - 2);
      ctx.lineTo(element.width * 0.3, element.height + 20);
      ctx.lineTo(element.width * 0.5, element.height - 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
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
    ctx.strokeStyle = '#0096ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(element.x, element.y, element.width, element.height);
    ctx.setLineDash([]);

    // Resize handles
    const handleSize = 8;
    const handles = [
      { x: element.x - handleSize/2, y: element.y - handleSize/2 },
      { x: element.x + element.width/2 - handleSize/2, y: element.y - handleSize/2 },
      { x: element.x + element.width - handleSize/2, y: element.y - handleSize/2 },
      { x: element.x + element.width - handleSize/2, y: element.y + element.height/2 - handleSize/2 },
      { x: element.x + element.width - handleSize/2, y: element.y + element.height - handleSize/2 },
      { x: element.x + element.width/2 - handleSize/2, y: element.y + element.height - handleSize/2 },
      { x: element.x - handleSize/2, y: element.y + element.height - handleSize/2 },
      { x: element.x - handleSize/2, y: element.y + element.height/2 - handleSize/2 },
    ];

    handles.forEach(handle => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
      ctx.strokeStyle = '#0096ff';
      ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
    });
  };

  // 요소 추가
  const addElement = (type: string, data: any, x: number, y: number) => {
    let newElement: CanvasElement = {
      id: `${type}-${Date.now()}`,
      type: type as any,
      x: x - 100,
      y: y - 50,
      width: 200,
      height: 100,
      rotation: 0,
      zIndex: elements.length,
      visible: true,
      locked: false,
      style: {},
    };

    switch (type) {
      case 'bubble':
        newElement.style = {
          ...data,
          backgroundColor: '#ffffff',
          borderColor: '#000000',
          borderWidth: 2,
        };
        break;
        
      case 'text':
        newElement.content = data?.text || '텍스트를 입력하세요';
        newElement.style = {
          fontSize: 16,
          fontFamily: 'Noto Sans KR',
          fontWeight: 'normal',
          color: '#000000',
          textAlign: 'center',
        };
        newElement.height = 40;
        break;
    }

    setElements(prev => [...prev, newElement]);
    setSelectedElement(newElement);
    saveToHistory();
  };

  // AI 이미지 생성
  const generateAIImage = async () => {
    if (!aiPrompt) return;
    
    setIsGenerating(true);
    try {
      // AI 생성 API 호출
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: aiPrompt + " (텍스트나 글자 없이 이미지만)",
          settings: {
            style: 'korean_webtoon',
          }
        }),
      });
      
      const data = await response.json();
      if (data.success && data.imageUrl) {
        // 생성된 이미지를 배경으로 추가
        const bgElement: CanvasElement = {
          id: `bg-${Date.now()}`,
          type: 'background',
          x: 0,
          y: 0,
          width: 800,
          height: 800,
          rotation: 0,
          zIndex: 0,
          visible: true,
          locked: true,
          imageUrl: data.imageUrl,
        };
        
        setElements(prev => [bgElement, ...prev.filter(e => e.type !== 'background')]);
        saveToHistory();
      }
    } catch (error) {
      console.error('AI generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
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

  // 마우스 이벤트
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    const clickedElement = elements.find(el => 
      x >= el.x && x <= el.x + el.width &&
      y >= el.y && y <= el.y + el.height &&
      !el.locked
    );

    if (clickedElement) {
      setSelectedElement(clickedElement);
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setElementStart({ x: clickedElement.x, y: clickedElement.y });
    } else {
      setSelectedElement(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedElement) return;

    const deltaX = (e.clientX - dragStart.x) / zoom;
    const deltaY = (e.clientY - dragStart.y) / zoom;

    setElements(prev => prev.map(el => 
      el.id === selectedElement.id 
        ? { ...el, x: elementStart.x + deltaX, y: elementStart.y + deltaY }
        : el
    ));
  };

  const handleCanvasMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      saveToHistory();
    }
  };

  // 내보내기
  const exportCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `${projectName}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
        {/* 상단 헤더 */}
        <div className="h-14 bg-white border-b flex items-center px-4 gap-4">
          <Input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-48 font-medium"
          />
          
          <div className="flex-1" />
          
          <Button variant="ghost" size="sm" onClick={undo}>
            <Undo className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={redo}>
            <Redo className="h-4 w-4" />
          </Button>
          
          <div className="h-6 w-px bg-gray-200" />
          
          <Button variant="ghost" size="sm" onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[50px] text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="sm" onClick={() => setZoom(Math.min(2, zoom + 0.25))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          <div className="h-6 w-px bg-gray-200" />
          
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            공유
          </Button>
          <Button size="sm" onClick={exportCanvas}>
            <Download className="h-4 w-4 mr-2" />
            다운로드
          </Button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* 왼쪽 사이드바 */}
          <div className={cn(
            "bg-white border-r transition-all duration-300",
            isLeftPanelOpen ? "w-80" : "w-12"
          )}>
            {isLeftPanelOpen ? (
              <div className="h-full flex flex-col">
                <div className="p-3 border-b flex items-center justify-between">
                  <h3 className="font-semibold">요소</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setIsLeftPanelOpen(false)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
                
                <Tabs defaultValue="ai" className="flex-1">
                  <TabsList className="grid w-full grid-cols-5 px-3">
                    <TabsTrigger value="ai" className="text-xs">AI</TabsTrigger>
                    <TabsTrigger value="bubble" className="text-xs">말풍선</TabsTrigger>
                    <TabsTrigger value="text" className="text-xs">텍스트</TabsTrigger>
                    <TabsTrigger value="sticker" className="text-xs">스티커</TabsTrigger>
                    <TabsTrigger value="upload" className="text-xs">업로드</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="ai" className="p-3">
                    <div className="space-y-3">
                      <Textarea
                        placeholder="생성하고 싶은 장면을 설명하세요 (텍스트 없이)"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        className="min-h-[100px]"
                      />
                      <Button 
                        className="w-full"
                        onClick={generateAIImage}
                        disabled={!aiPrompt || isGenerating}
                      >
                        <Wand2 className="h-4 w-4 mr-2" />
                        {isGenerating ? "생성 중..." : "AI 이미지 생성"}
                      </Button>
                      
                      <div className="text-xs text-gray-500 bg-yellow-50 p-2 rounded">
                        💡 AI는 텍스트 없는 이미지만 생성합니다. 대사는 말풍선으로 추가하세요.
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="bubble" className="p-3">
                    <ScrollArea className="h-[calc(100vh-200px)]">
                      <div className="grid grid-cols-2 gap-2">
                        {BUBBLE_TEMPLATES.map(template => (
                          <DraggableElement
                            key={template.id}
                            type="bubble"
                            data={{ bubbleStyle: template.style, hasTail: template.type === 'speech' }}
                          >
                            <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-move">
                              <div className="text-3xl text-center mb-2">{template.preview}</div>
                              <div className="text-xs text-center text-gray-600">{template.name}</div>
                            </div>
                          </DraggableElement>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  
                  <TabsContent value="text" className="p-3">
                    <div className="space-y-3">
                      <DraggableElement type="text" data={{ text: "제목" }}>
                        <Button variant="outline" className="w-full justify-start">
                          <Type className="h-4 w-4 mr-2" />
                          제목 추가
                        </Button>
                      </DraggableElement>
                      
                      <DraggableElement type="text" data={{ text: "부제목" }}>
                        <Button variant="outline" className="w-full justify-start">
                          <Type className="h-4 w-4 mr-2" />
                          부제목 추가
                        </Button>
                      </DraggableElement>
                      
                      <DraggableElement type="text" data={{ text: "본문 텍스트" }}>
                        <Button variant="outline" className="w-full justify-start">
                          <Type className="h-4 w-4 mr-2" />
                          본문 추가
                        </Button>
                      </DraggableElement>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="sticker" className="p-3">
                    <div className="grid grid-cols-3 gap-2">
                      {['😀', '😍', '😎', '😭', '😡', '🤔', '💕', '⭐', '💥', '✨', '🔥', '💯'].map(emoji => (
                        <DraggableElement key={emoji} type="text" data={{ text: emoji }}>
                          <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-move text-2xl text-center">
                            {emoji}
                          </div>
                        </DraggableElement>
                      ))}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="upload" className="p-3">
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600 mb-2">이미지를 업로드하세요</p>
                      <Button variant="outline" size="sm">
                        파일 선택
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center py-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsLeftPanelOpen(true)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* 중앙 캔버스 영역 */}
          <div 
            ref={containerRef}
            className="flex-1 bg-gray-100 overflow-hidden relative"
          >
            <div
              ref={drop}
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: `scale(${zoom})` }}
            >
              <canvas
                ref={canvasRef}
                width={800}
                height={800}
                className={cn(
                  "bg-white shadow-lg",
                  isOver && "ring-4 ring-blue-400 ring-opacity-50"
                )}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
              />
            </div>
          </div>

          {/* 오른쪽 속성 패널 */}
          <div className={cn(
            "bg-white border-l transition-all duration-300",
            isRightPanelOpen ? "w-80" : "w-12"
          )}>
            {isRightPanelOpen ? (
              <div className="h-full flex flex-col">
                <div className="p-3 border-b flex items-center justify-between">
                  <h3 className="font-semibold">
                    {selectedElement ? "속성" : "레이어"}
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setIsRightPanelOpen(false)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                {selectedElement ? (
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                      {/* 텍스트 편집 */}
                      {selectedElement.type === 'text' && (
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium mb-1 block">텍스트</label>
                            <Textarea
                              value={selectedElement.content || ''}
                              onChange={(e) => {
                                setElements(prev => prev.map(el =>
                                  el.id === selectedElement.id
                                    ? { ...el, content: e.target.value }
                                    : el
                                ));
                              }}
                              className="min-h-[80px]"
                            />
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium mb-1 block">글꼴 크기</label>
                            <Slider
                              value={[selectedElement.style?.fontSize || 16]}
                              min={8}
                              max={72}
                              step={1}
                              onValueChange={([value]) => {
                                setElements(prev => prev.map(el =>
                                  el.id === selectedElement.id
                                    ? { ...el, style: { ...el.style, fontSize: value } }
                                    : el
                                ));
                              }}
                            />
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              variant={selectedElement.style?.fontWeight === 'bold' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => {
                                setElements(prev => prev.map(el =>
                                  el.id === selectedElement.id
                                    ? { ...el, style: { ...el.style, fontWeight: el.style?.fontWeight === 'bold' ? 'normal' : 'bold' } }
                                    : el
                                ));
                              }}
                            >
                              <Bold className="h-4 w-4" />
                            </Button>
                            <Button
                              variant={selectedElement.style?.fontStyle === 'italic' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => {
                                setElements(prev => prev.map(el =>
                                  el.id === selectedElement.id
                                    ? { ...el, style: { ...el.style, fontStyle: el.style?.fontStyle === 'italic' ? 'normal' : 'italic' } }
                                    : el
                                ));
                              }}
                            >
                              <Italic className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {/* 말풍선 편집 */}
                      {selectedElement.type === 'bubble' && (
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium mb-1 block">배경색</label>
                            <div className="grid grid-cols-4 gap-2">
                              {Object.entries(BUBBLE_COLORS).map(([name, colors]) => (
                                <button
                                  key={name}
                                  className="h-8 rounded border-2 border-gray-200"
                                  style={{ backgroundColor: colors.background }}
                                  onClick={() => {
                                    setElements(prev => prev.map(el =>
                                      el.id === selectedElement.id
                                        ? { ...el, style: { ...el.style, backgroundColor: colors.background, borderColor: colors.border } }
                                        : el
                                    ));
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium mb-1 block">테두리 두께</label>
                            <Slider
                              value={[selectedElement.style?.borderWidth || 2]}
                              min={0}
                              max={10}
                              step={1}
                              onValueChange={([value]) => {
                                setElements(prev => prev.map(el =>
                                  el.id === selectedElement.id
                                    ? { ...el, style: { ...el.style, borderWidth: value } }
                                    : el
                                ));
                              }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* 공통 속성 */}
                      <div className="space-y-3 pt-3 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">표시</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setElements(prev => prev.map(el =>
                                el.id === selectedElement.id
                                  ? { ...el, visible: !el.visible }
                                  : el
                              ));
                            }}
                          >
                            {selectedElement.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </Button>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">잠금</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setElements(prev => prev.map(el =>
                                el.id === selectedElement.id
                                  ? { ...el, locked: !el.locked }
                                  : el
                              ));
                            }}
                          >
                            {selectedElement.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                          </Button>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              const newElement = {
                                ...selectedElement,
                                id: `${selectedElement.type}-${Date.now()}`,
                                x: selectedElement.x + 20,
                                y: selectedElement.y + 20,
                              };
                              setElements(prev => [...prev, newElement]);
                              setSelectedElement(newElement);
                            }}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            복제
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setElements(prev => prev.filter(el => el.id !== selectedElement.id));
                              setSelectedElement(null);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            삭제
                          </Button>
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                ) : (
                  <ScrollArea className="flex-1">
                    <div className="p-4">
                      <div className="space-y-2">
                        {[...elements].reverse().map(element => (
                          <div
                            key={element.id}
                            className={cn(
                              "p-2 rounded border cursor-pointer hover:bg-gray-50",
                              selectedElement?.id === element.id && "border-blue-500 bg-blue-50"
                            )}
                            onClick={() => setSelectedElement(element)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm">
                                {element.type === 'bubble' ? '말풍선' :
                                 element.type === 'text' ? '텍스트' :
                                 element.type === 'background' ? '배경' : '요소'}
                              </span>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setElements(prev => prev.map(el =>
                                      el.id === element.id
                                        ? { ...el, visible: !el.visible }
                                        : el
                                    ));
                                  }}
                                >
                                  {element.visible ? 
                                    <Eye className="h-3 w-3" /> : 
                                    <EyeOff className="h-3 w-3" />
                                  }
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setElements(prev => prev.map(el =>
                                      el.id === element.id
                                        ? { ...el, locked: !el.locked }
                                        : el
                                    ));
                                  }}
                                >
                                  {element.locked ? 
                                    <Lock className="h-3 w-3" /> : 
                                    <Unlock className="h-3 w-3" />
                                  }
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center py-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsRightPanelOpen(true)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}

// 메인 컴포넌트 (DndProvider 포함)
export function CanvaStudio() {
  return (
    <DndProvider backend={HTML5Backend}>
      <CanvaStudioInner />
    </DndProvider>
  );
}