"use client";

import { useEffect, useRef, useState } from "react";
import { useStudioStore } from "@/lib/stores/studio-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  ZoomIn, 
  ZoomOut, 
  Grid3X3, 
  Move3D,
  RotateCcw,
  Plus,
  Trash2,
  Copy,
  Play
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PanelContainer } from "./PanelContainer";
import { CANVAS_SIZES, type CanvasRatio } from "@/types/editor";

interface WebtoonCanvasProps {
  canvasRatio: CanvasRatio;
}

export function WebtoonCanvas({ canvasRatio }: WebtoonCanvasProps) {
  const {
    panels,
    activePanel,
    canvasZoom,
    canvasGrid,
    isGenerating,
    setCanvasZoom,
    toggleGrid,
    selectPanel,
    addPanel,
    removePanel,
    duplicatePanel,
    generatePanel,
    editPanel,
    generateBatch,
  } = useStudioStore();

  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPanelIndex, setEditingPanelIndex] = useState<number | null>(null);
  const [editPrompt, setEditPrompt] = useState("");

  // 캔버스 줌 조절
  const handleZoomIn = () => setCanvasZoom(canvasZoom * 1.2);
  const handleZoomOut = () => setCanvasZoom(canvasZoom / 1.2);
  const handleResetZoom = () => setCanvasZoom(1);

  // 캔버스 드래그
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setCanvasOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '=':
          case '+':
            e.preventDefault();
            handleZoomIn();
            break;
          case '-':
            e.preventDefault();
            handleZoomOut();
            break;
          case '0':
            e.preventDefault();
            handleResetZoom();
            break;
          case 'g':
            e.preventDefault();
            toggleGrid();
            break;
        }
      }
      
      // 방향키로 패널 이동
      if (!e.ctrlKey && !e.metaKey && activePanel !== null) {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            selectPanel(Math.max(0, activePanel - 1));
            break;
          case 'ArrowDown':
            e.preventDefault();
            selectPanel(Math.min(panels.length - 1, activePanel + 1));
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePanel, panels.length, canvasZoom]);

  // 모든 패널 생성
  const handleGenerateAll = async () => {
    const indicesToGenerate = panels
      .map((_, index) => index)
      .filter(index => panels[index].prompt && !panels[index].imageUrl);
    
    if (indicesToGenerate.length > 0) {
      await generateBatch(indicesToGenerate, canvasRatio);
    }
  };

  // 패널 수정 핸들러
  const handleEditPanel = (index: number) => {
    const panel = panels[index];
    if (!panel?.imageUrl) return;

    setEditingPanelIndex(index);
    setEditPrompt("");
    setEditModalOpen(true);
  };

  // 수정 실행
  const handleEditSubmit = async () => {
    if (editingPanelIndex === null || !editPrompt.trim()) return;
    
    setEditModalOpen(false);
    await editPanel(editingPanelIndex, editPrompt, canvasRatio);
    setEditingPanelIndex(null);
    setEditPrompt("");
  };

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* 캔버스 툴바 */}
      <div className="flex items-center justify-between p-3 bg-white border-b">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            disabled={canvasZoom <= 0.1}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <span className="text-sm font-medium min-w-[60px] text-center">
            {Math.round(canvasZoom * 100)}%
          </span>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            disabled={canvasZoom >= 3}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetZoom}
            title="Fit to view (Ctrl+0)"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          
          <div className="w-px h-6 bg-gray-200 mx-2" />
          
          <Button
            variant={canvasGrid ? "default" : "ghost"}
            size="sm"
            onClick={toggleGrid}
            title="Toggle grid (Ctrl+G)"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={addPanel}
          >
            <Plus className="h-4 w-4 mr-1" />
            패널 추가
          </Button>
          
          <Button
            variant="default"
            size="sm"
            onClick={handleGenerateAll}
            disabled={isGenerating || panels.every(p => !p.prompt || p.imageUrl)}
          >
            <Play className="h-4 w-4 mr-1" />
            모두 생성
          </Button>
        </div>
      </div>

      {/* 캔버스 영역 */}
      <div 
        className="flex-1 overflow-hidden relative cursor-move"
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{
          backgroundImage: canvasGrid 
            ? `radial-gradient(circle, #e5e5e5 1px, transparent 1px)`
            : 'none',
          backgroundSize: canvasGrid ? '20px 20px' : 'auto',
        }}
      >
        <div 
          className="absolute inset-0 flex flex-col items-center justify-start p-8 space-y-4"
          style={{
            transform: `scale(${canvasZoom}) translate(${canvasOffset.x / canvasZoom}px, ${canvasOffset.y / canvasZoom}px)`,
            transformOrigin: 'center top',
          }}
        >
          {panels.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-4 bg-gray-200 rounded-lg flex items-center justify-center">
                <Plus className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                첫 패널을 만들어보세요
              </h3>
              <p className="text-gray-500 mb-4">
                웹툰 제작을 시작하려면 패널을 추가하세요
              </p>
              <Button onClick={addPanel}>
                <Plus className="h-4 w-4 mr-2" />
                패널 추가하기
              </Button>
            </div>
          ) : (
            <div 
              className="space-y-4"
              style={{
                width: `${CANVAS_SIZES[canvasRatio].width}px`,
                maxWidth: '100%'
              }}
            >
              {panels.map((panel, index) => (
                <PanelContainer
                  key={panel.id}
                  panel={panel}
                  index={index}
                  isActive={activePanel === index}
                  canvasRatio={canvasRatio}
                  onSelect={() => selectPanel(index)}
                  onGenerate={() => generatePanel(index, canvasRatio)}
                  onEdit={() => handleEditPanel(index)}
                  onDuplicate={() => duplicatePanel(index)}
                  onDelete={() => removePanel(index)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 우하단 미니맵 (선택사항) */}
        {panels.length > 3 && (
          <div className="absolute bottom-4 right-4 w-32 h-40 bg-white/90 backdrop-blur-sm border rounded-lg shadow-lg p-2">
            <div className="text-xs font-medium mb-2 text-gray-600">미니맵</div>
            <div className="space-y-1">
              {panels.map((panel, index) => (
                <div
                  key={panel.id}
                  className={cn(
                    "h-3 rounded cursor-pointer transition-colors",
                    activePanel === index 
                      ? "bg-blue-500" 
                      : panel.imageUrl 
                      ? "bg-green-300" 
                      : "bg-gray-200"
                  )}
                  onClick={() => selectPanel(index)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 편집 모달 */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>이미지 수정하기</DialogTitle>
            <DialogDescription>
              기존 이미지를 참조하여 수정할 내용을 입력하세요. 구체적으로 어떤 부분을 어떻게 바꿀지 설명해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="edit-prompt" className="text-sm font-medium">
                수정 사항
              </label>
              <Textarea
                id="edit-prompt"
                placeholder="예: 캐릭터의 표정을 웃는 얼굴로 바꿔주세요, 배경을 밤 풍경으로 변경해주세요..."
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                className="mt-1 min-h-[100px]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setEditModalOpen(false)}
              >
                취소
              </Button>
              <Button 
                onClick={handleEditSubmit}
                disabled={!editPrompt.trim()}
              >
                수정하기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}