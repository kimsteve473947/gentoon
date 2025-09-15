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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Wand2, MessageCircle, Type, Sparkles, Image as ImageIcon, 
  Download, Save, Share2, Undo, Redo, ZoomIn, ZoomOut, Grid,
  Trash2, Copy, Eye, EyeOff, Lock, Unlock, ChevronLeft, Upload,
  ChevronRight, Plus, Palette, Bold, Italic, AlignLeft, Settings,
  AlignCenter, AlignRight, Layers, Home, FileText, User,
  PlusCircle, ChevronDown, ChevronUp, MoreHorizontal, X,
  Navigation, Star, Heart, ArrowUp, ArrowDown, ArrowLeft, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStudioStore } from '@/lib/stores/studio-store';
import { BUBBLE_TEMPLATES, BUBBLE_COLORS } from '@/lib/assets/bubble-templates';
import { CANVAS_SIZES, type CanvasRatio } from '@/types/editor';

// 페이지(컷) 타입
interface Page {
  id: string;
  name: string;
  elements: CanvasElement[];
  prompt: string;
  generatedImage?: string;
  thumbnail?: string;
}

// 캔버스 요소 타입
interface CanvasElement {
  id: string;
  type: 'background' | 'bubble' | 'text' | 'sticker' | 'image' | 'shape';
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

// 캐릭터 레퍼런스 타입
interface CharacterRef {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  aliases: string[];
}

// 드래그 가능한 요소
function DraggableElement({ type, data, children }: any) {
  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: 'element',
    item: { type, data },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={dragRef as any}
      className={cn(
        "cursor-move transition-opacity",
        isDragging && "opacity-50"
      )}
    >
      {children}
    </div>
  );
}

// 내부 스튜디오 컴포넌트
function WebtoonStudioInner({ canvasRatio }: { canvasRatio: CanvasRatio }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 페이지 관리
  const [pages, setPages] = useState<Page[]>([
    {
      id: 'page-1',
      name: '1컷',
      elements: [],
      prompt: '',
    }
  ]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const currentPage = pages[currentPageIndex];
  
  // 캐릭터 레퍼런스
  const [characters, setCharacters] = useState<CharacterRef[]>([]);
  const [showCharacterDialog, setShowCharacterDialog] = useState(false);
  const [newCharacter, setNewCharacter] = useState<Partial<CharacterRef>>({});
  
  // UI 상태
  const [selectedElement, setSelectedElement] = useState<CanvasElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [elementStart, setElementStart] = useState({ x: 0, y: 0 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [projectName, setProjectName] = useState("제목 없는 웹툰");
  const [history, setHistory] = useState<Page[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // 캔버스 드롭 영역
  const [{ canDrop, isOver }, dropRef] = useDrop(() => ({
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
  }, [currentPage, selectedElement, zoom]);

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Generated background image
    if (currentPage.generatedImage) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawElements(ctx);
      };
      img.src = currentPage.generatedImage;
    } else {
      drawElements(ctx);
    }
  };

  const drawElements = (ctx: CanvasRenderingContext2D) => {
    const sortedElements = [...currentPage.elements].sort((a, b) => a.zIndex - b.zIndex);
    
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
        case 'shape':
          drawShape(ctx, element);
          break;
        case 'image':
        case 'sticker':
          if (element.imageUrl) {
            const img = new Image();
            img.onload = () => {
              ctx.drawImage(img, 0, 0, element.width, element.height);
            };
            img.src = element.imageUrl;
          }
          break;
      }

      ctx.restore();

      // Selection
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
        ctx.beginPath();
        ctx.roundRect(0, 0, element.width, element.height, 10);
        ctx.fill();
        ctx.stroke();
        break;
      case 'cloud':
        drawCloudBubble(ctx, element);
        break;
      case 'jagged':
        drawJaggedBubble(ctx, element);
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

  const drawCloudBubble = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
    ctx.beginPath();
    const numBubbles = 8;
    for (let i = 0; i < numBubbles; i++) {
      const angle = (i / numBubbles) * Math.PI * 2;
      const x = element.width / 2 + Math.cos(angle) * element.width * 0.3;
      const y = element.height / 2 + Math.sin(angle) * element.height * 0.3;
      ctx.arc(x, y, element.width * 0.15, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
  };

  const drawJaggedBubble = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
    ctx.beginPath();
    const points = 20;
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const radius = i % 2 === 0 ? element.width * 0.5 : element.width * 0.4;
      const x = element.width / 2 + Math.cos(angle) * radius;
      const y = element.height / 2 + Math.sin(angle) * (element.height / element.width) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
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

  const drawShape = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
    ctx.fillStyle = element.style?.fillColor || '#000000';
    ctx.strokeStyle = element.style?.strokeColor || '#000000';
    ctx.lineWidth = element.style?.strokeWidth || 2;

    switch (element.style?.shape) {
      case 'rectangle':
        ctx.fillRect(0, 0, element.width, element.height);
        if (element.style?.strokeWidth > 0) {
          ctx.strokeRect(0, 0, element.width, element.height);
        }
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(element.width / 2, element.height / 2, Math.min(element.width, element.height) / 2, 0, Math.PI * 2);
        ctx.fill();
        if (element.style?.strokeWidth > 0) ctx.stroke();
        break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(element.width / 2, 0);
        ctx.lineTo(element.width, element.height);
        ctx.lineTo(0, element.height);
        ctx.closePath();
        ctx.fill();
        if (element.style?.strokeWidth > 0) ctx.stroke();
        break;
      case 'star':
        drawStar(ctx, element.width / 2, element.height / 2, Math.min(element.width, element.height) / 2);
        ctx.fill();
        if (element.style?.strokeWidth > 0) ctx.stroke();
        break;
    }
  };

  const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) => {
    const spikes = 5;
    const outerRadius = radius;
    const innerRadius = radius / 2;
    
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  const drawSelectionHandles = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
    ctx.strokeStyle = '#0096ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(element.x, element.y, element.width, element.height);
    ctx.setLineDash([]);

    const handleSize = 8;
    const handles = [
      { x: element.x - handleSize/2, y: element.y - handleSize/2 },
      { x: element.x + element.width - handleSize/2, y: element.y - handleSize/2 },
      { x: element.x + element.width - handleSize/2, y: element.y + element.height - handleSize/2 },
      { x: element.x - handleSize/2, y: element.y + element.height - handleSize/2 },
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
    const newElement: CanvasElement = {
      id: `${type}-${Date.now()}`,
      type: type as any,
      x: x - 100,
      y: y - 50,
      width: 200,
      height: 100,
      rotation: 0,
      zIndex: currentPage.elements.length,
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
        newElement.content = data?.text || '텍스트';
        newElement.style = {
          fontSize: 16,
          fontFamily: 'Noto Sans KR',
          fontWeight: 'normal',
          color: '#000000',
          textAlign: 'center',
        };
        newElement.height = 40;
        break;
      case 'shape':
        newElement.style = {
          shape: data?.shape || 'rectangle',
          fillColor: data?.fillColor || '#000000',
          strokeColor: '#000000',
          strokeWidth: 0,
        };
        break;
    }

    const updatedPages = [...pages];
    updatedPages[currentPageIndex].elements.push(newElement);
    setPages(updatedPages);
    setSelectedElement(newElement);
    saveToHistory();
  };

  // AI 이미지 생성 (컷별)
  const generatePageImage = async () => {
    if (!currentPage.prompt) return;
    
    setIsGenerating(true);
    try {
      // 캐릭터 레퍼런스 추가
      let enhancedPrompt = currentPage.prompt;
      const characterIds = characters.map(c => c.id);
      
      // 캐릭터가 언급되었는지 체크하고 설명 추가
      characters.forEach(char => {
        if (currentPage.prompt.includes(char.name) || 
            char.aliases.some(alias => currentPage.prompt.includes(alias))) {
          enhancedPrompt += `\n${char.name}: ${char.description}`;
        }
      });
      
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: enhancedPrompt + " (텍스트나 글자 없이 이미지만)",
          characterIds,
          settings: {
            style: 'korean_webtoon',
          }
        }),
      });
      
      const data = await response.json();
      if (data.success && data.imageUrl) {
        const updatedPages = [...pages];
        updatedPages[currentPageIndex].generatedImage = data.imageUrl;
        setPages(updatedPages);
        saveToHistory();
      }
    } catch (error) {
      console.error('AI generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // 페이지 추가
  const addPage = () => {
    const newPage: Page = {
      id: `page-${Date.now()}`,
      name: `${pages.length + 1}컷`,
      elements: [],
      prompt: '',
    };
    setPages([...pages, newPage]);
    setCurrentPageIndex(pages.length);
  };

  // 페이지 복제
  const duplicatePage = (index: number) => {
    const pageToDuplicate = pages[index];
    const newPage: Page = {
      ...pageToDuplicate,
      id: `page-${Date.now()}`,
      name: `${pages.length + 1}컷`,
      elements: pageToDuplicate.elements.map(el => ({
        ...el,
        id: `${el.type}-${Date.now()}-${Math.random()}`
      }))
    };
    const updatedPages = [...pages];
    updatedPages.splice(index + 1, 0, newPage);
    setPages(updatedPages);
  };

  // 페이지 삭제
  const deletePage = (index: number) => {
    if (pages.length > 1) {
      const updatedPages = pages.filter((_, i) => i !== index);
      setPages(updatedPages);
      if (currentPageIndex >= updatedPages.length) {
        setCurrentPageIndex(updatedPages.length - 1);
      }
    }
  };

  // 캐릭터 추가
  const addCharacter = () => {
    if (newCharacter.name && newCharacter.description) {
      const character: CharacterRef = {
        id: `char-${Date.now()}`,
        name: newCharacter.name,
        description: newCharacter.description,
        imageUrl: newCharacter.imageUrl || '',
        aliases: newCharacter.aliases?.toString().split(',').map(a => a.trim()) || [],
      };
      setCharacters([...characters, character]);
      setNewCharacter({});
      setShowCharacterDialog(false);
    }
  };

  // 히스토리
  const saveToHistory = () => {
    const newHistory = [...history.slice(0, historyIndex + 1), [...pages]];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setPages(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setPages(history[historyIndex + 1]);
    }
  };

  // 마우스 이벤트
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    const clickedElement = currentPage.elements.find(el => 
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

    const updatedPages = [...pages];
    const elementIndex = currentPage.elements.findIndex(el => el.id === selectedElement.id);
    if (elementIndex !== -1) {
      updatedPages[currentPageIndex].elements[elementIndex] = {
        ...selectedElement,
        x: elementStart.x + deltaX,
        y: elementStart.y + deltaY,
      };
      setPages(updatedPages);
    }
  };

  const handleCanvasMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      saveToHistory();
    }
  };

  // 내보내기
  const exportAllPages = () => {
    // 모든 페이지를 하나의 긴 이미지로 내보내기
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 800 * pages.length;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // 각 페이지 렌더링
    pages.forEach((page, index) => {
      // TODO: 각 페이지 렌더링 로직
    });
    
    const link = document.createElement('a');
    link.download = `${projectName}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* 상단 헤더 */}
      <div className="h-14 bg-white border-b flex items-center px-4 gap-3 shadow-sm">
        <Button variant="ghost" size="icon">
          <Home className="h-5 w-5" />
        </Button>
        
        <Input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="w-64 font-medium"
          placeholder="프로젝트 이름"
        />
        
        <div className="flex-1" />
        
        {/* 캐릭터 설정 */}
        <Dialog open={showCharacterDialog} onOpenChange={setShowCharacterDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <User className="h-4 w-4 mr-2" />
              캐릭터 ({characters.length})
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>캐릭터 레퍼런스 설정</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* 기존 캐릭터 목록 */}
              <div className="space-y-2">
                {characters.map(char => (
                  <div key={char.id} className="p-3 border rounded-lg flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">{char.name}</h4>
                      <p className="text-sm text-gray-600">{char.description}</p>
                      {char.aliases.length > 0 && (
                        <p className="text-xs text-gray-500">별칭: {char.aliases.join(', ')}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCharacters(characters.filter(c => c.id !== char.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              
              {/* 새 캐릭터 추가 */}
              <div className="border-t pt-4 space-y-3">
                <h4 className="font-semibold">새 캐릭터 추가</h4>
                <Input
                  placeholder="캐릭터 이름"
                  value={newCharacter.name || ''}
                  onChange={(e) => setNewCharacter({ ...newCharacter, name: e.target.value })}
                />
                <Textarea
                  placeholder="캐릭터 설명 (외모, 성격 등)"
                  value={newCharacter.description || ''}
                  onChange={(e) => setNewCharacter({ ...newCharacter, description: e.target.value })}
                  rows={3}
                />
                <Input
                  placeholder="별칭 (쉼표로 구분)"
                  value={newCharacter.aliases || ''}
                  onChange={(e) => setNewCharacter({ ...newCharacter, aliases: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                />
                <Button onClick={addCharacter} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  캐릭터 추가
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={undo}>
            <Undo className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={redo}>
            <Redo className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="h-6 w-px bg-gray-200" />
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[50px] text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="sm" onClick={() => setZoom(Math.min(2, zoom + 0.25))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="h-6 w-px bg-gray-200" />
        
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          공유
        </Button>
        <Button size="sm" onClick={exportAllPages}>
          <Download className="h-4 w-4 mr-2" />
          다운로드
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 왼쪽 사이드바 */}
        <div className="w-20 bg-white border-r flex flex-col items-center py-4 gap-3">
          <Tabs defaultValue="template" orientation="vertical" className="w-full">
            <TabsList className="flex flex-col h-auto bg-transparent">
              <TabsTrigger value="template" className="flex flex-col gap-1 p-2 data-[state=active]:bg-gray-100">
                <Grid className="h-5 w-5" />
                <span className="text-[10px]">템플릿</span>
              </TabsTrigger>
              <TabsTrigger value="elements" className="flex flex-col gap-1 p-2 data-[state=active]:bg-gray-100">
                <Layers className="h-5 w-5" />
                <span className="text-[10px]">요소</span>
              </TabsTrigger>
              <TabsTrigger value="text" className="flex flex-col gap-1 p-2 data-[state=active]:bg-gray-100">
                <Type className="h-5 w-5" />
                <span className="text-[10px]">텍스트</span>
              </TabsTrigger>
              <TabsTrigger value="ai" className="flex flex-col gap-1 p-2 data-[state=active]:bg-gray-100">
                <Wand2 className="h-5 w-5" />
                <span className="text-[10px]">AI 도구</span>
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex flex-col gap-1 p-2 data-[state=active]:bg-gray-100">
                <Upload className="h-5 w-5" />
                <span className="text-[10px]">업로드</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* 확장 패널 */}
        <div className="w-72 bg-white border-r overflow-hidden">
          <Tabs defaultValue="ai" className="h-full flex flex-col">
            <TabsContent value="template" className="flex-1 overflow-auto p-4">
              <h3 className="font-semibold mb-3">템플릿</h3>
              <div className="grid grid-cols-2 gap-2">
                {/* 템플릿 목록 */}
              </div>
            </TabsContent>
            
            <TabsContent value="elements" className="flex-1 overflow-auto p-4">
              <h3 className="font-semibold mb-3">요소</h3>
              
              {/* 도형 */}
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">도형</h4>
                <div className="grid grid-cols-3 gap-2">
                  <DraggableElement type="shape" data={{ shape: 'rectangle', fillColor: '#FF6B6B' }}>
                    <div className="p-3 border rounded hover:bg-gray-50 cursor-move flex flex-col items-center">
                      <div className="w-8 h-8 bg-red-400 rounded" />
                      <span className="text-xs mt-1">사각형</span>
                    </div>
                  </DraggableElement>
                  <DraggableElement type="shape" data={{ shape: 'circle', fillColor: '#4ECDC4' }}>
                    <div className="p-3 border rounded hover:bg-gray-50 cursor-move flex flex-col items-center">
                      <div className="w-8 h-8 bg-teal-400 rounded-full" />
                      <span className="text-xs mt-1">원</span>
                    </div>
                  </DraggableElement>
                  <DraggableElement type="shape" data={{ shape: 'star', fillColor: '#FFE66D' }}>
                    <div className="p-3 border rounded hover:bg-gray-50 cursor-move flex flex-col items-center">
                      <Star className="h-8 w-8 text-yellow-400 fill-yellow-400" />
                      <span className="text-xs mt-1">별</span>
                    </div>
                  </DraggableElement>
                </div>
              </div>
              
              {/* 화살표 */}
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">화살표</h4>
                <div className="grid grid-cols-4 gap-2">
                  {[ArrowUp, ArrowDown, ArrowLeft, ArrowRight].map((Icon, i) => (
                    <DraggableElement key={i} type="shape" data={{ shape: 'arrow' }}>
                      <div className="p-2 border rounded hover:bg-gray-50 cursor-move flex items-center justify-center">
                        <Icon className="h-5 w-5" />
                      </div>
                    </DraggableElement>
                  ))}
                </div>
              </div>
              
              {/* 말풍선 */}
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">말풍선</h4>
                <div className="grid grid-cols-2 gap-2">
                  {BUBBLE_TEMPLATES.slice(0, 6).map(template => (
                    <DraggableElement
                      key={template.id}
                      type="bubble"
                      data={{ bubbleStyle: template.style, hasTail: template.type === 'speech' }}
                    >
                      <div className="p-3 border rounded hover:bg-gray-50 cursor-move">
                        <div className="text-2xl text-center mb-1">{template.preview}</div>
                        <div className="text-xs text-center text-gray-600">{template.name}</div>
                      </div>
                    </DraggableElement>
                  ))}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="text" className="flex-1 overflow-auto p-4">
              <h3 className="font-semibold mb-3">텍스트</h3>
              <div className="space-y-2">
                <DraggableElement type="text" data={{ text: "제목", fontSize: 32, fontWeight: 'bold' }}>
                  <Button variant="outline" className="w-full justify-start">
                    <Type className="h-4 w-4 mr-2" />
                    제목 추가
                  </Button>
                </DraggableElement>
                <DraggableElement type="text" data={{ text: "부제목", fontSize: 24 }}>
                  <Button variant="outline" className="w-full justify-start">
                    <Type className="h-4 w-4 mr-2" />
                    부제목 추가
                  </Button>
                </DraggableElement>
                <DraggableElement type="text" data={{ text: "본문", fontSize: 16 }}>
                  <Button variant="outline" className="w-full justify-start">
                    <Type className="h-4 w-4 mr-2" />
                    본문 추가
                  </Button>
                </DraggableElement>
              </div>
            </TabsContent>
            
            <TabsContent value="ai" className="flex-1 overflow-auto p-4">
              <h3 className="font-semibold mb-3">AI 이미지 생성</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    {currentPage.name} 프롬프트
                  </label>
                  <Textarea
                    placeholder="이 컷에서 생성할 장면을 설명하세요"
                    value={currentPage.prompt}
                    onChange={(e) => {
                      const updatedPages = [...pages];
                      updatedPages[currentPageIndex].prompt = e.target.value;
                      setPages(updatedPages);
                    }}
                    rows={4}
                    className="text-sm"
                  />
                </div>
                
                {characters.length > 0 && (
                  <div className="p-2 bg-blue-50 rounded text-xs">
                    <p className="font-medium mb-1">등록된 캐릭터:</p>
                    {characters.map(char => (
                      <span key={char.id} className="inline-block mr-2">
                        • {char.name}
                      </span>
                    ))}
                  </div>
                )}
                
                <Button 
                  className="w-full"
                  onClick={generatePageImage}
                  disabled={!currentPage.prompt || isGenerating}
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  {isGenerating ? "생성 중..." : `${currentPage.name} AI 생성`}
                </Button>
                
                <div className="text-xs text-gray-500 bg-yellow-50 p-2 rounded">
                  💡 캐릭터 이름을 프롬프트에 포함하면 자동으로 레퍼런스가 적용됩니다
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="upload" className="flex-1 overflow-auto p-4">
              <h3 className="font-semibold mb-3">업로드</h3>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600 mb-2">이미지 업로드</p>
                <Button variant="outline" size="sm">
                  파일 선택
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* 중앙 캔버스 */}
        <div className="flex-1 flex flex-col">
          <div 
            ref={containerRef}
            className="flex-1 bg-gray-50 overflow-hidden relative"
          >
            <div
              ref={dropRef as any}
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: `scale(${zoom})` }}
            >
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZES[canvasRatio]?.width || 800}
                height={CANVAS_SIZES[canvasRatio]?.height || 1000}
                className={cn(
                  "bg-white shadow-xl",
                  isOver && "ring-4 ring-blue-400 ring-opacity-50"
                )}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
              />
            </div>
          </div>
          
          {/* 하단 페이지 네비게이션 */}
          <div className="h-32 bg-white border-t p-2 overflow-x-auto">
            <div className="flex gap-2 h-full">
              {pages.map((page, index) => (
                <div
                  key={page.id}
                  className={cn(
                    "relative group cursor-pointer",
                    currentPageIndex === index && "ring-2 ring-blue-500"
                  )}
                  onClick={() => setCurrentPageIndex(index)}
                >
                  <div className="w-20 h-full bg-gray-100 rounded flex items-center justify-center">
                    {page.generatedImage ? (
                      <img src={page.generatedImage} alt={page.name} className="w-full h-full object-cover rounded" />
                    ) : (
                      <div className="text-center">
                        <FileText className="h-6 w-6 mx-auto mb-1 text-gray-400" />
                        <span className="text-xs text-gray-600">{page.name}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* 페이지 액션 */}
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-1 bg-white rounded shadow-sm hover:bg-gray-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicatePage(index);
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    {pages.length > 1 && (
                      <button
                        className="p-1 bg-white rounded shadow-sm hover:bg-gray-100 ml-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePage(index);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              {/* 페이지 추가 버튼 */}
              <button
                onClick={addPage}
                className="w-20 h-full border-2 border-dashed rounded flex items-center justify-center hover:bg-gray-50"
              >
                <Plus className="h-6 w-6 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* 오른쪽 속성 패널 */}
        {selectedElement && (
          <div className="w-72 bg-white border-l">
            <div className="p-4 border-b">
              <h3 className="font-semibold">속성</h3>
            </div>
            
            <ScrollArea className="h-[calc(100vh-8rem)]">
              <div className="p-4 space-y-4">
                {/* 텍스트 속성 */}
                {selectedElement.type === 'text' && (
                  <>
                    <div>
                      <label className="text-sm font-medium mb-1 block">텍스트</label>
                      <Textarea
                        value={selectedElement.content || ''}
                        onChange={(e) => {
                          const updatedPages = [...pages];
                          const elementIndex = currentPage.elements.findIndex(el => el.id === selectedElement.id);
                          if (elementIndex !== -1) {
                            updatedPages[currentPageIndex].elements[elementIndex].content = e.target.value;
                            setPages(updatedPages);
                            setSelectedElement({ ...selectedElement, content: e.target.value });
                          }
                        }}
                        rows={3}
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
                          const updatedPages = [...pages];
                          const elementIndex = currentPage.elements.findIndex(el => el.id === selectedElement.id);
                          if (elementIndex !== -1) {
                            updatedPages[currentPageIndex].elements[elementIndex].style = {
                              ...updatedPages[currentPageIndex].elements[elementIndex].style,
                              fontSize: value
                            };
                            setPages(updatedPages);
                            setSelectedElement({ 
                              ...selectedElement, 
                              style: { ...selectedElement.style, fontSize: value }
                            });
                          }
                        }}
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant={selectedElement.style?.fontWeight === 'bold' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          const updatedPages = [...pages];
                          const elementIndex = currentPage.elements.findIndex(el => el.id === selectedElement.id);
                          if (elementIndex !== -1) {
                            const currentWeight = updatedPages[currentPageIndex].elements[elementIndex].style?.fontWeight;
                            updatedPages[currentPageIndex].elements[elementIndex].style = {
                              ...updatedPages[currentPageIndex].elements[elementIndex].style,
                              fontWeight: currentWeight === 'bold' ? 'normal' : 'bold'
                            };
                            setPages(updatedPages);
                            setSelectedElement({
                              ...selectedElement,
                              style: { ...selectedElement.style, fontWeight: currentWeight === 'bold' ? 'normal' : 'bold' }
                            });
                          }
                        }}
                      >
                        <Bold className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={selectedElement.style?.fontStyle === 'italic' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          const updatedPages = [...pages];
                          const elementIndex = currentPage.elements.findIndex(el => el.id === selectedElement.id);
                          if (elementIndex !== -1) {
                            const currentStyle = updatedPages[currentPageIndex].elements[elementIndex].style?.fontStyle;
                            updatedPages[currentPageIndex].elements[elementIndex].style = {
                              ...updatedPages[currentPageIndex].elements[elementIndex].style,
                              fontStyle: currentStyle === 'italic' ? 'normal' : 'italic'
                            };
                            setPages(updatedPages);
                            setSelectedElement({
                              ...selectedElement,
                              style: { ...selectedElement.style, fontStyle: currentStyle === 'italic' ? 'normal' : 'italic' }
                            });
                          }
                        }}
                      >
                        <Italic className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
                
                {/* 말풍선 속성 */}
                {selectedElement.type === 'bubble' && (
                  <>
                    <div>
                      <label className="text-sm font-medium mb-1 block">배경색</label>
                      <div className="grid grid-cols-4 gap-2">
                        {Object.entries(BUBBLE_COLORS).slice(0, 8).map(([name, colors]) => (
                          <button
                            key={name}
                            className="h-8 rounded border-2 border-gray-200"
                            style={{ backgroundColor: colors.background }}
                            onClick={() => {
                              const updatedPages = [...pages];
                              const elementIndex = currentPage.elements.findIndex(el => el.id === selectedElement.id);
                              if (elementIndex !== -1) {
                                updatedPages[currentPageIndex].elements[elementIndex].style = {
                                  ...updatedPages[currentPageIndex].elements[elementIndex].style,
                                  backgroundColor: colors.background,
                                  borderColor: colors.border
                                };
                                setPages(updatedPages);
                                setSelectedElement({
                                  ...selectedElement,
                                  style: { ...selectedElement.style, backgroundColor: colors.background, borderColor: colors.border }
                                });
                              }
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}
                
                {/* 공통 액션 */}
                <div className="pt-3 border-t space-y-2">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        const element = currentPage.elements.find(el => el.id === selectedElement.id);
                        if (element) {
                          const newElement = {
                            ...element,
                            id: `${element.type}-${Date.now()}`,
                            x: element.x + 20,
                            y: element.y + 20,
                          };
                          const updatedPages = [...pages];
                          updatedPages[currentPageIndex].elements.push(newElement);
                          setPages(updatedPages);
                          setSelectedElement(newElement);
                        }
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
                        const updatedPages = [...pages];
                        updatedPages[currentPageIndex].elements = currentPage.elements.filter(el => el.id !== selectedElement.id);
                        setPages(updatedPages);
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
          </div>
        )}
      </div>
    </div>
  );
}

// 메인 컴포넌트
interface WebtoonStudioProps {
  panelId?: string;
  backgroundImage?: string;
  canvasRatio: CanvasRatio;
  onSave?: (state: any) => void;
}

export function WebtoonStudio(props: WebtoonStudioProps) {
  // canvasRatio가 없거나 유효하지 않은 경우 기본값 설정
  const canvasRatio = props.canvasRatio && ['4:5', '1:1'].includes(props.canvasRatio) 
    ? props.canvasRatio 
    : '4:5' as CanvasRatio;
    
  return (
    <DndProvider backend={HTML5Backend}>
      <WebtoonStudioInner canvasRatio={canvasRatio} />
    </DndProvider>
  );
}