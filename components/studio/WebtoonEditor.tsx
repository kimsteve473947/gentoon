"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  EditorState, 
  EditorLayer, 
  BubbleLayer, 
  TextLayer,
  EditorTool,
  BubbleTemplate 
} from '@/types/editor';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
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
  Save
} from 'lucide-react';

// 말풍선 템플릿
const BUBBLE_TEMPLATES: BubbleTemplate[] = [
  {
    id: 'speech-round',
    name: '일반 대화',
    type: 'speech',
    style: 'round',
    preview: '💬',
    defaultSize: { width: 200, height: 100 }
  },
  {
    id: 'thought-cloud',
    name: '생각',
    type: 'thought',
    style: 'cloud',
    preview: '💭',
    defaultSize: { width: 200, height: 100 }
  },
  {
    id: 'shout-jagged',
    name: '외침',
    type: 'shout',
    style: 'jagged',
    preview: '💢',
    defaultSize: { width: 200, height: 120 }
  },
  {
    id: 'narration-rect',
    name: '나레이션',
    type: 'narration',
    style: 'rectangle',
    preview: '📝',
    defaultSize: { width: 300, height: 80 }
  }
];

interface WebtoonEditorProps {
  panelId: string;
  backgroundImage?: string;
  onSave?: (state: EditorState) => void;
}

export function WebtoonEditor({ panelId, backgroundImage, onSave }: WebtoonEditorProps) {
  const stageRef = useRef<any>(null);
  const [Stage, setStage] = useState<any>(null);
  const [Layer, setLayer] = useState<any>(null);
  const [Rect, setRect] = useState<any>(null);
  const [isKonvaLoaded, setIsKonvaLoaded] = useState(false);
  
  // Konva를 동적으로 로드
  useEffect(() => {
    import('react-konva').then((module) => {
      setStage(module.Stage);
      setLayer(module.Layer);
      setRect(module.Rect);
      setIsKonvaLoaded(true);
    });
  }, []);
  const [selectedTool, setSelectedTool] = useState<EditorTool['type']>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EditorState>({
    layers: backgroundImage ? [{
      id: 'background',
      type: 'background' as const,
      imageUrl: backgroundImage,
      visible: true,
      locked: true,
      opacity: 1,
      zIndex: 0,
      x: 0,
      y: 0
    }] : [],
    selectedLayerId: null,
    canvasRatio: '1:1' as CanvasRatio,
    canvasWidth: 800,
    canvasHeight: 800,
    zoom: 1,
    pan: { x: 0, y: 0 },
    isPlaying: false,
    history: [],
    historyIndex: -1
  });

  // 히스토리 관리
  const saveToHistory = useCallback(() => {
    setEditorState(prev => ({
      ...prev,
      history: [...prev.history.slice(0, prev.historyIndex + 1), prev.layers],
      historyIndex: prev.historyIndex + 1
    }));
  }, []);

  const undo = useCallback(() => {
    setEditorState(prev => {
      if (prev.historyIndex > 0) {
        return {
          ...prev,
          layers: prev.history[prev.historyIndex - 1],
          historyIndex: prev.historyIndex - 1
        };
      }
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setEditorState(prev => {
      if (prev.historyIndex < prev.history.length - 1) {
        return {
          ...prev,
          layers: prev.history[prev.historyIndex + 1],
          historyIndex: prev.historyIndex + 1
        };
      }
      return prev;
    });
  }, []);

  // 말풍선 추가
  const addBubble = useCallback((template: BubbleTemplate) => {
    const newBubble: BubbleLayer = {
      id: `bubble-${Date.now()}`,
      type: 'bubble',
      bubbleType: template.type,
      style: template.style,
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: editorState.layers.length,
      x: editorState.canvasWidth / 2 - template.defaultSize.width / 2,
      y: editorState.canvasHeight / 2 - template.defaultSize.height / 2,
      width: template.defaultSize.width,
      height: template.defaultSize.height,
      rotation: 0,
      backgroundColor: '#FFFFFF',
      borderColor: '#000000',
      borderWidth: 2
    };

    setEditorState(prev => ({
      ...prev,
      layers: [...prev.layers, newBubble],
      selectedLayerId: newBubble.id
    }));
    saveToHistory();
  }, [editorState.layers.length, editorState.canvasWidth, editorState.canvasHeight, saveToHistory]);

  // 텍스트 추가
  const addText = useCallback((bubbleId?: string) => {
    const bubble = bubbleId ? 
      editorState.layers.find(l => l.id === bubbleId) as BubbleLayer : 
      null;

    const newText: TextLayer = {
      id: `text-${Date.now()}`,
      type: 'text',
      text: '텍스트를 입력하세요',
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: editorState.layers.length,
      x: bubble ? bubble.x + 20 : editorState.canvasWidth / 2 - 50,
      y: bubble ? bubble.y + 20 : editorState.canvasHeight / 2,
      fontSize: 16,
      fontFamily: 'Noto Sans KR',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'center',
      color: '#000000',
      lineHeight: 1.2,
      letterSpacing: 0
    };

    setEditorState(prev => ({
      ...prev,
      layers: [...prev.layers, newText],
      selectedLayerId: newText.id
    }));
    saveToHistory();
  }, [editorState.layers.length, editorState.canvasWidth, editorState.canvasHeight, saveToHistory]);

  // 레이어 삭제
  const deleteLayer = useCallback((layerId: string) => {
    setEditorState(prev => ({
      ...prev,
      layers: prev.layers.filter(l => l.id !== layerId),
      selectedLayerId: null
    }));
    saveToHistory();
  }, [saveToHistory]);

  // 레이어 복제
  const duplicateLayer = useCallback((layerId: string) => {
    const layer = editorState.layers.find(l => l.id === layerId);
    if (!layer) return;

    const newLayer = {
      ...layer,
      id: `${layer.type}-${Date.now()}`,
      x: layer.x + 20,
      y: layer.y + 20,
      zIndex: editorState.layers.length
    };

    setEditorState(prev => ({
      ...prev,
      layers: [...prev.layers, newLayer],
      selectedLayerId: newLayer.id
    }));
    saveToHistory();
  }, [editorState.layers, saveToHistory]);

  // 레이어 가시성 토글
  const toggleLayerVisibility = useCallback((layerId: string) => {
    setEditorState(prev => ({
      ...prev,
      layers: prev.layers.map(l => 
        l.id === layerId ? { ...l, visible: !l.visible } : l
      )
    }));
  }, []);

  // 레이어 잠금 토글
  const toggleLayerLock = useCallback((layerId: string) => {
    setEditorState(prev => ({
      ...prev,
      layers: prev.layers.map(l => 
        l.id === layerId ? { ...l, locked: !l.locked } : l
      )
    }));
  }, []);

  // 내보내기
  const handleExport = useCallback(() => {
    if (!stageRef.current) return;
    
    const uri = stageRef.current.toDataURL();
    const link = document.createElement('a');
    link.download = `webtoon-panel-${panelId}.png`;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [panelId]);

  // 저장
  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(editorState);
    }
  }, [editorState, onSave]);

  return (
    <div className="flex h-full">
      {/* 왼쪽 툴바 */}
      <div className="w-16 bg-gray-900 flex flex-col items-center py-4 gap-2">
        <Button
          variant={selectedTool === 'select' ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => setSelectedTool('select')}
          title="선택 도구"
        >
          <MousePointer className="h-5 w-5" />
        </Button>
        <Button
          variant={selectedTool === 'hand' ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => setSelectedTool('hand')}
          title="손 도구"
        >
          <Hand className="h-5 w-5" />
        </Button>
        <Button
          variant={selectedTool === 'bubble' ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => setSelectedTool('bubble')}
          title="말풍선"
        >
          <MessageCircle className="h-5 w-5" />
        </Button>
        <Button
          variant={selectedTool === 'text' ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => setSelectedTool('text')}
          title="텍스트"
        >
          <Type className="h-5 w-5" />
        </Button>
        <Button
          variant={selectedTool === 'effect' ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => setSelectedTool('effect')}
          title="효과"
        >
          <Sparkles className="h-5 w-5" />
        </Button>
        
        <div className="flex-1" />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={undo}
          title="실행 취소"
        >
          <Undo className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={redo}
          title="다시 실행"
        >
          <Redo className="h-5 w-5" />
        </Button>
      </div>

      {/* 메인 캔버스 영역 */}
      <div className="flex-1 bg-gray-100 relative">
        {/* 상단 툴바 */}
        <div className="absolute top-0 left-0 right-0 h-12 bg-white border-b flex items-center px-4 gap-2 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditorState(prev => ({ ...prev, zoom: Math.max(0.1, prev.zoom - 0.1) }))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{Math.round(editorState.zoom * 100)}%</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditorState(prev => ({ ...prev, zoom: Math.min(3, prev.zoom + 0.1) }))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          <div className="flex-1" />
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
          >
            <Save className="h-4 w-4 mr-2" />
            저장
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
          >
            <Download className="h-4 w-4 mr-2" />
            내보내기
          </Button>
        </div>

        {/* Konva 캔버스 */}
        <div className="absolute inset-0 top-12 overflow-hidden">
          {isKonvaLoaded && Stage ? (
          <Stage
            ref={stageRef}
            width={window.innerWidth - 400}
            height={window.innerHeight - 48}
            scaleX={editorState.zoom}
            scaleY={editorState.zoom}
            x={editorState.pan.x}
            y={editorState.pan.y}
            draggable={selectedTool === 'hand'}
            onWheel={(e) => {
              e.evt.preventDefault();
              const scaleBy = 1.05;
              const stage = e.target.getStage();
              if (!stage) return;
              
              const oldScale = stage.scaleX();
              const pointer = stage.getPointerPosition();
              if (!pointer) return;

              const mousePointTo = {
                x: (pointer.x - stage.x()) / oldScale,
                y: (pointer.y - stage.y()) / oldScale,
              };

              const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
              
              setEditorState(prev => ({
                ...prev,
                zoom: newScale,
                pan: {
                  x: pointer.x - mousePointTo.x * newScale,
                  y: pointer.y - mousePointTo.y * newScale,
                }
              }));
            }}
          >
            <Layer>
              {/* 배경 */}
              <Rect
                x={0}
                y={0}
                width={editorState.canvasWidth}
                height={editorState.canvasHeight}
                fill="white"
                stroke="#ddd"
                strokeWidth={1}
              />
              
              {/* 레이어 렌더링 - 추후 구현 */}
              {editorState.layers
                .filter(layer => layer.visible)
                .sort((a, b) => a.zIndex - b.zIndex)
                .map(layer => {
                  // 각 레이어 타입별 렌더링 로직
                  return null; // 임시
                })}
            </Layer>
          </Stage>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm text-gray-600">캔버스 로딩 중...</p>
              </div>
            </div>
          )}
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
                {editorState.layers
                  .sort((a, b) => b.zIndex - a.zIndex)
                  .map(layer => (
                    <div
                      key={layer.id}
                      className={`flex items-center gap-2 p-2 rounded border ${
                        selectedId === layer.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                      onClick={() => setSelectedId(layer.id)}
                    >
                      <span className="flex-1 text-sm">
                        {layer.type === 'bubble' ? '말풍선' : 
                         layer.type === 'text' ? '텍스트' : 
                         layer.type === 'background' ? '배경' : '효과'}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLayerVisibility(layer.id);
                        }}
                      >
                        {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLayerLock(layer.id);
                        }}
                      >
                        {layer.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateLayer(layer.id);
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
                          deleteLayer(layer.id);
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
                      onClick={() => addBubble(template)}
                    >
                      <span className="text-2xl mb-1">{template.preview}</span>
                      <span className="text-xs">{template.name}</span>
                    </Button>
                  ))}
                </div>
                
                <h3 className="font-semibold mt-6 mb-3">텍스트</h3>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => addText()}
                >
                  <Type className="h-4 w-4 mr-2" />
                  텍스트 추가
                </Button>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}