"use client";

import { useState } from "react";
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
  MessageSquare,
  Type,
  UserPlus,
  FileText,
  Image as ImageIcon,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

// 캔버스 크기 정의
const CANVAS_SIZES = {
  '4:5': { width: 320, height: 400, actualWidth: 1080, actualHeight: 1350, label: '세로형' },
  '1:1': { width: 320, height: 320, actualWidth: 1080, actualHeight: 1080, label: '정사각형' }
};

type CanvasRatio = '4:5' | '1:1';

interface WebtoonCut {
  id: string;
  prompt: string;
  imageUrl?: string;
}

export function MiriCanvasStudioSimple() {
  const [canvasRatio, setCanvasRatio] = useState<CanvasRatio>('4:5');
  const [zoom, setZoom] = useState<number>(100);
  const [cuts, setCuts] = useState<WebtoonCut[]>([
    { id: '1', prompt: '' }
  ]);
  const [selectedCutId, setSelectedCutId] = useState<string>('1');
  const [activeTab, setActiveTab] = useState<'bubble' | 'text' | 'ai-character' | 'ai-script'>('bubble');

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
      prompt: ''
    };
    setCuts([...cuts, newCut]);
    setSelectedCutId(newCut.id);
  };

  const updateCutPrompt = (cutId: string, prompt: string) => {
    setCuts(cuts.map(cut => 
      cut.id === cutId ? { ...cut, prompt } : cut
    ));
  };

  const selectedCut = cuts.find(cut => cut.id === selectedCutId);
  const selectedCutIndex = cuts.findIndex(cut => cut.id === selectedCutId);

  const menuItems = [
    { id: 'bubble', label: '말풍선', icon: MessageSquare },
    { id: 'text', label: '텍스트', icon: Type },
    { id: 'ai-character', label: 'AI 캐릭터', icon: UserPlus },
    { id: 'ai-script', label: 'AI 대본', icon: FileText }
  ];

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50">
      {/* 상단 헤더 */}
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
          
          {/* 캔버스 크기 선택 */}
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
        <div className="w-80 bg-white border-r border-slate-200 flex">
          {/* 메뉴 탭 */}
          <div className="w-20 bg-slate-50 border-r border-slate-200">
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

          {/* 컨텐츠 패널 */}
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-3">
                {menuItems.find(item => item.id === activeTab)?.label}
              </h3>
            </div>
            <div className="flex-1 p-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    {activeTab === 'bubble' ? '대사 입력' : 
                     activeTab === 'text' ? '텍스트 입력' : 
                     activeTab === 'ai-character' ? '캐릭터 설명' : '줄거리 입력'}
                  </label>
                  <Textarea 
                    placeholder={
                      activeTab === 'bubble' ? '말풍선에 들어갈 대사를 입력하세요...' :
                      activeTab === 'text' ? '추가할 텍스트를 입력하세요...' :
                      activeTab === 'ai-character' ? '캐릭터의 외모와 특징을 설명해주세요...' :
                      '간단한 줄거리를 입력하세요...'
                    }
                    className="min-h-[100px] text-sm resize-none border-slate-200"
                  />
                </div>
                
                <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  {activeTab === 'bubble' ? '말풍선 추가' : 
                   activeTab === 'text' ? '텍스트 추가' : 
                   activeTab === 'ai-character' ? '캐릭터 생성' : '대본 생성'}
                </Button>
              </div>
            </div>
          </div>
        </div>
        
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
          </div>

          {/* 캔버스 컨테이너 */}
          <div className="flex-1 overflow-auto p-8 flex justify-center">
            <div 
              className="flex flex-col items-center"
              style={{
                gap: `${Math.max(32, 32 * (zoom / 100))}px`
              }}
            >
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
                  {/* 컷 번호 */}
                  <div className="absolute -left-12 top-0 flex flex-col items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                  </div>

                  {/* 캔버스 */}
                  <div
                    className={cn(
                      "bg-white shadow-lg overflow-hidden cursor-pointer relative border-2",
                      selectedCutId === cut.id ? "border-purple-500 shadow-purple-200" : "border-slate-300 hover:border-slate-400"
                    )}
                    style={{
                      width: CANVAS_SIZES[canvasRatio].width,
                      height: CANVAS_SIZES[canvasRatio].height
                    }}
                    onClick={() => setSelectedCutId(cut.id)}
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
                  </div>
                </div>
              ))}

              {/* 페이지 추가 버튼 */}
              <button
                onClick={addCut}
                className="w-full max-w-[320px] h-20 border-2 border-dashed border-slate-300
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