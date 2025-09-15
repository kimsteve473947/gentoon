"use client";

import { useState } from "react";
import { MiriCanvasSidebar } from "./MiriCanvasSidebar";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  MoreVertical,
  Edit3,
  Image as ImageIcon
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// 컷(페이지) 타입 정의
interface WebtoonCut {
  id: string;
  script: string;
  imageUrl?: string;
  isGenerating?: boolean;
}

export function NewMiriCanvasStudio() {
  const [canvasRatio, setCanvasRatio] = useState<CanvasRatio>('4:5');
  const [zoom, setZoom] = useState<number>(100);
  const [cuts, setCuts] = useState<WebtoonCut[]>([
    { id: '1', script: '' }
  ]);
  const [selectedCutId, setSelectedCutId] = useState<string>('1');

  // 줌 관련 함수
  const handleZoomChange = (value: number[]) => {
    setZoom(value[0]);
  };

  const handleZoomIn = () => {
    setZoom(Math.min(300, zoom + 10));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(10, zoom - 10));
  };

  const handleFitToScreen = () => {
    setZoom(100);
  };

  // 컷 관련 함수
  const addCut = () => {
    const newCut: WebtoonCut = {
      id: Date.now().toString(),
      script: ''
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
        id: Date.now().toString()
      };
      const cutIndex = cuts.findIndex(cut => cut.id === cutId);
      const newCuts = [...cuts];
      newCuts.splice(cutIndex + 1, 0, newCut);
      setCuts(newCuts);
    }
  };

  const updateCutScript = (cutId: string, script: string) => {
    setCuts(cuts.map(cut => 
      cut.id === cutId ? { ...cut, script } : cut
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

  const selectedCut = cuts.find(cut => cut.id === selectedCutId);
  const selectedCutIndex = cuts.findIndex(cut => cut.id === selectedCutId);

  return (
    <div className="h-screen w-full flex flex-col bg-gray-100">
      {/* 상단 헤더 */}
      <div className="h-14 bg-white border-b flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">GenToon 스튜디오</h1>
          
          {/* 캔버스 크기 선택 */}
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
            <button
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors text-sm",
                canvasRatio === '4:5' 
                  ? "bg-white shadow-sm text-blue-600 font-medium" 
                  : "text-gray-600 hover:text-gray-900"
              )}
              onClick={() => setCanvasRatio('4:5')}
            >
              <RectangleVertical className="h-4 w-4" />
              <span>891×1260 px</span>
            </button>
            <button
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors text-sm",
                canvasRatio === '1:1' 
                  ? "bg-white shadow-sm text-blue-600 font-medium" 
                  : "text-gray-600 hover:text-gray-900"
              )}
              onClick={() => setCanvasRatio('1:1')}
            >
              <Square className="h-4 w-4" />
              <span>800×800 px</span>
            </button>
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
          {/* 페이지 정보 바 */}
          <div className="h-10 bg-white border-b flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {selectedCutIndex + 1}컷 - 제목 입력
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                캐릭터 (0)
              </span>
            </div>
          </div>

          {/* 캔버스 컨테이너 */}
          <div className="flex-1 overflow-auto p-8">
            <div className="flex flex-col items-center gap-4">
              {cuts.map((cut, index) => (
                <div
                  key={cut.id}
                  className={cn(
                    "relative group",
                    "transition-all duration-200",
                    selectedCutId === cut.id && "ring-2 ring-blue-500 ring-offset-4"
                  )}
                  style={{
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'center top'
                  }}
                >
                  {/* 컷 번호 및 컨트롤 */}
                  <div className="absolute -left-16 top-0 flex flex-col items-center gap-2">
                    <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold">
                      {index + 1}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => moveCut(cut.id, 'up')}
                        disabled={index === 0}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => moveCut(cut.id, 'down')}
                        disabled={index === cuts.length - 1}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* 캔버스 */}
                  <div
                    className="bg-white shadow-lg rounded-lg overflow-hidden cursor-pointer"
                    style={{
                      width: CANVAS_SIZES[canvasRatio].width,
                      height: CANVAS_SIZES[canvasRatio].height
                    }}
                    onClick={() => setSelectedCutId(cut.id)}
                  >
                    {cut.imageUrl ? (
                      <img 
                        src={cut.imageUrl} 
                        alt={`${index + 1}컷`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                        <ImageIcon className="h-16 w-16 mb-4" />
                        <p className="text-sm font-medium">이곳에 생성할 장면을 설명하세요</p>
                        <p className="text-xs mt-2">AI 웹툰 생성을 클릭하여 시작</p>
                      </div>
                    )}
                  </div>

                  {/* 컷 액션 메뉴 */}
                  <div className="absolute -right-12 top-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
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

                  {/* 대본 입력 영역 */}
                  <div className="absolute -bottom-24 left-0 right-0 px-4">
                    <div className="bg-white rounded-lg shadow-sm border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-700">
                          {index + 1}컷 대본
                        </label>
                        <Edit3 className="h-3 w-3 text-gray-400" />
                      </div>
                      <Textarea
                        value={cut.script}
                        onChange={(e) => updateCutScript(cut.id, e.target.value)}
                        placeholder="이 컷의 대본을 입력하세요..."
                        className="min-h-[60px] text-sm resize-none"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* 페이지 추가 버튼 */}
              <button
                onClick={addCut}
                className="w-full max-w-[800px] h-32 border-2 border-dashed border-gray-300 rounded-lg 
                         flex items-center justify-center gap-2 text-gray-500 hover:border-blue-400 
                         hover:text-blue-600 hover:bg-blue-50 transition-colors mt-8"
                style={{
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'center top'
                }}
              >
                <Plus className="h-6 w-6" />
                <span className="font-medium">페이지 추가</span>
              </button>
            </div>
          </div>

          {/* 하단 줌 컨트롤 */}
          <div className="h-12 bg-white border-t flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                전체 {cuts.length}컷
              </span>
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
                  value={[zoom]}
                  onValueChange={handleZoomChange}
                  min={10}
                  max={300}
                  step={10}
                  className="w-32"
                />
                <span className="text-xs font-medium w-12 text-right">
                  {zoom}%
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
                className="h-7 px-2"
                onClick={handleFitToScreen}
              >
                <Maximize2 className="h-3 w-3 mr-1" />
                <span className="text-xs">화면 맞춤</span>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-xs">
                사용법
              </Button>
            </div>
          </div>
        </div>

        {/* 오른쪽 속성 패널 */}
        <div className="w-80 bg-white border-l flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm">속성</h3>
            {selectedCut && (
              <p className="text-xs text-gray-500 mt-1">
                {selectedCutIndex + 1}컷 편집 중
              </p>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {selectedCut && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    컷 대본
                  </label>
                  <Textarea
                    value={selectedCut.script}
                    onChange={(e) => updateCutScript(selectedCut.id, e.target.value)}
                    placeholder="이 컷의 대본을 입력하세요..."
                    className="min-h-[120px] text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    AI 프롬프트
                  </label>
                  <Textarea
                    placeholder="AI가 생성할 장면을 자세히 설명하세요..."
                    className="min-h-[100px] text-sm"
                  />
                </div>

                <Button className="w-full" size="sm">
                  <ImageIcon className="h-4 w-4 mr-2" />
                  이미지 생성
                </Button>

                {selectedCut.imageUrl && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-700">생성된 이미지</p>
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
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