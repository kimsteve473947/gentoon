"use client";

import { useState } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Sidebar } from "./Sidebar";
import { WebtoonCanvas } from "./WebtoonCanvas";
import { WebtoonEditorDynamic } from "./WebtoonEditorDynamic";
import { Toolbar } from "./Toolbar";
import { StatusBar } from "./StatusBar";
import { PromptEditor } from "./PromptEditor";
import { useStudioStore } from "@/lib/stores/studio-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CANVAS_SIZES, type CanvasRatio } from "@/types/editor";
import { Maximize2, Square } from "lucide-react";

export function StudioLayout() {
  const { activePanel, panels, tokenBalance } = useStudioStore();
  const [canvasRatio, setCanvasRatio] = useState<CanvasRatio>('4:5');

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50">
      {/* 상단 툴바 */}
      <Toolbar />
      
      {/* 메인 워크스페이스 */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* 왼쪽 사이드바 */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
            <Sidebar />
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          {/* 중앙 캔버스 영역 */}
          <ResizablePanel defaultSize={60} minSize={40}>
            <div className="h-full flex flex-col">
              <Tabs defaultValue="generator" className="h-full flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
                  <TabsList className="grid grid-cols-2">
                    <TabsTrigger value="generator">AI 생성</TabsTrigger>
                    <TabsTrigger value="editor">편집 스튜디오</TabsTrigger>
                  </TabsList>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">캔버스 크기:</span>
                    <Select value={canvasRatio} onValueChange={(value) => setCanvasRatio(value as CanvasRatio)}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4:5">
                          <div className="flex items-center gap-2">
                            <Maximize2 className="h-4 w-4" />
                            <span>세로형 (4:5)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="1:1">
                          <div className="flex items-center gap-2">
                            <Square className="h-4 w-4" />
                            <span>정사각형 (1:1)</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <TabsContent value="generator" className="flex-1 overflow-hidden">
                  <WebtoonCanvas canvasRatio={canvasRatio} />
                </TabsContent>
                <TabsContent value="editor" className="flex-1 overflow-hidden">
                  <WebtoonEditorDynamic 
                    panelId={activePanel !== null ? panels[activePanel]?.id : 'new'}
                    backgroundImage={activePanel !== null ? panels[activePanel]?.imageUrl : undefined}
                    canvasRatio={canvasRatio}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          {/* 오른쪽 편집 패널 */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
            <div className="h-full flex flex-col bg-white border-l">
              <div className="p-4 border-b bg-gray-50">
                <h3 className="font-semibold text-sm">편집 패널</h3>
                {activePanel !== null && (
                  <p className="text-xs text-muted-foreground">
                    패널 {activePanel + 1} / {panels.length}
                  </p>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto">
                <PromptEditor canvasRatio={canvasRatio} />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      
      {/* 하단 상태바 */}
      <StatusBar />
    </div>
  );
}