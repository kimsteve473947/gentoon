"use client";

import { useState } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { MiriCanvasSidebar } from "./MiriCanvasSidebar";
import { WebtoonCanvas } from "./WebtoonCanvas";
import { WebtoonEditorDynamic } from "./WebtoonEditorDynamic";
import { PromptEditor } from "./PromptEditor";
import { useStudioStore } from "@/lib/stores/studio-store";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { CANVAS_SIZES, type CanvasRatio } from "@/types/editor";
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
  Grid3X3
} from "lucide-react";

export function MiriCanvasLayout() {
  const { activePanel, panels, canvasZoom, setCanvasZoom } = useStudioStore();
  const [canvasRatio, setCanvasRatio] = useState<CanvasRatio>('4:5');
  const [activeTab, setActiveTab] = useState<'generator' | 'editor'>('generator');

  const handleZoomChange = (value: number[]) => {
    setCanvasZoom(value[0] / 100);
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(3, canvasZoom * 1.2);
    setCanvasZoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.1, canvasZoom / 1.2);
    setCanvasZoom(newZoom);
  };

  const handleFitToScreen = () => {
    setCanvasZoom(1);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-gray-100">
      {/* 상단 헤더 - 미리캔버스 스타일 */}
      <div className="h-14 bg-white border-b flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">GenToon 스튜디오</h1>
          
          {/* 캔버스 크기 선택 - 미리캔버스 스타일 */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
            <Button
              variant={canvasRatio === '4:5' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => setCanvasRatio('4:5')}
            >
              <RectangleVertical className="h-4 w-4 mr-1" />
              <span className="text-xs">891×1260 px</span>
            </Button>
            <Button
              variant={canvasRatio === '1:1' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => setCanvasRatio('1:1')}
            >
              <Square className="h-4 w-4 mr-1" />
              <span className="text-xs">800×800 px</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <Undo className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Redo className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-gray-200 mx-1" />
          <Button variant="ghost" size="sm">
            <Share2 className="h-4 w-4" />
          </Button>
          <Button variant="default" size="sm">
            <Download className="h-4 w-4 mr-1" />
            다운로드
          </Button>
        </div>
      </div>

      {/* 메인 워크스페이스 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 왼쪽 사이드바 */}
        <MiriCanvasSidebar />
        
        {/* 중앙 캔버스 영역 */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {/* 캔버스 탭 */}
          <div className="h-10 bg-white border-b flex items-center px-4">
            <div className="flex gap-4">
              <button
                className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                  activeTab === 'generator' 
                    ? 'text-blue-600 border-blue-600' 
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('generator')}
              >
                AI 생성
              </button>
              <button
                className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                  activeTab === 'editor' 
                    ? 'text-blue-600 border-blue-600' 
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('editor')}
              >
                편집 스튜디오
              </button>
            </div>
          </div>

          {/* 캔버스 컨텐츠 */}
          <div className="flex-1 overflow-hidden relative">
            {activeTab === 'generator' ? (
              <WebtoonCanvas canvasRatio={canvasRatio} />
            ) : (
              <WebtoonEditorDynamic 
                panelId={activePanel !== null ? panels[activePanel]?.id : 'new'}
                backgroundImage={activePanel !== null ? panels[activePanel]?.imageUrl : undefined}
                canvasRatio={canvasRatio}
              />
            )}
          </div>

          {/* 하단 줌 컨트롤 - 미리캔버스 스타일 */}
          <div className="h-12 bg-white border-t flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('generator')}>
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <span className="text-xs text-gray-500">페이지 추가</span>
            </div>

            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 w-7 p-0"
                onClick={handleZoomOut}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-2">
                <Slider
                  value={[canvasZoom * 100]}
                  onValueChange={handleZoomChange}
                  min={10}
                  max={300}
                  step={10}
                  className="w-32"
                />
                <span className="text-xs font-medium w-10 text-right">
                  {Math.round(canvasZoom * 100)}%
                </span>
              </div>

              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 w-7 p-0"
                onClick={handleZoomIn}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>

              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 w-7 p-0"
                onClick={handleFitToScreen}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {CANVAS_SIZES[canvasRatio].width} × {CANVAS_SIZES[canvasRatio].height} px
              </span>
            </div>
          </div>
        </div>

        {/* 오른쪽 속성 패널 */}
        <div className="w-80 bg-white border-l flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm">속성</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            <PromptEditor canvasRatio={canvasRatio} />
          </div>
        </div>
      </div>
    </div>
  );
}