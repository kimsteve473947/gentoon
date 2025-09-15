"use client";

import { useState } from "react";
import { useStudioStore } from "@/lib/stores/studio-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Save,
  Download,
  Settings,
  Share2,
  Undo2,
  Redo2,
  Coins,
  User,
  LogOut,
  FileText,
  Image as ImageIcon,
  Package,
  Zap,
  Crown,
} from "lucide-react";

export function Toolbar() {
  const {
    currentProject,
    tokenBalance,
    isGenerating,
    saveProject,
    panels,
  } = useStudioStore();

  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  // 프로젝트 저장
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveProject();
    } catch (error) {
    } finally {
      setIsSaving(false);
    }
  };

  // 프로젝트 내보내기
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/export/webtoon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProject?.id,
          format: 'instagram', // 인스타그램 최적화
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${currentProject?.name || '웹툰'}_인스타그램.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // 완성된 패널 개수 계산
  const completedPanels = panels.filter(p => p.imageUrl).length;
  const totalPanels = panels.length;

  return (
    <div className="h-14 bg-white border-b flex items-center justify-between px-4">
      {/* 왼쪽 영역 - 프로젝트 정보 및 저장 */}
      <div className="flex items-center gap-4">
        {/* 프로젝트 이름 */}
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-500" />
          <span className="font-medium text-gray-900">
            {currentProject?.name || '제목 없음'}
          </span>
          {currentProject?.isAutoSaving && (
            <Badge variant="secondary" className="text-xs">
              저장 중...
            </Badge>
          )}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* 저장/실행취소/다시실행 */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !currentProject}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? '저장 중...' : '저장'}
          </Button>
          
          <Button variant="ghost" size="sm" disabled>
            <Undo2 className="h-4 w-4" />
          </Button>
          
          <Button variant="ghost" size="sm" disabled>
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 중앙 영역 - 진행 상황 */}
      <div className="flex items-center gap-4">
        {/* 패널 진행 상황 */}
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600">
            {completedPanels}/{totalPanels} 완성
          </span>
          {isGenerating && (
            <Badge variant="secondary" className="text-xs animate-pulse">
              <Zap className="h-3 w-3 mr-1" />
              생성 중
            </Badge>
          )}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* 토큰 잔액 */}
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium text-gray-900">
            {tokenBalance.toLocaleString()}
          </span>
          <span className="text-xs text-gray-500">토큰</span>
        </div>
      </div>

      {/* 오른쪽 영역 - 액션 버튼들 */}
      <div className="flex items-center gap-2">
        {/* 공유하기 */}
        <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              공유
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>프로젝트 공유</DialogTitle>
              <DialogDescription>
                다른 사람과 웹툰 프로젝트를 공유하세요
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <code className="flex-1 text-sm">
                  https://insta-toon.com/share/{currentProject?.id}
                </code>
                <Button size="sm" variant="outline">
                  복사
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                공유 링크를 통해 다른 사람이 당신의 웹툰을 볼 수 있습니다
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* 내보내기 */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={isExporting || completedPanels === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? '내보내는 중...' : '내보내기'}
        </Button>

        <Separator orientation="vertical" className="h-6" />

        {/* 사용자 메뉴 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="text-sm">계정</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem>
              <User className="h-4 w-4 mr-2" />
              프로필 설정
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Crown className="h-4 w-4 mr-2" />
              구독 관리
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Coins className="h-4 w-4 mr-2" />
              토큰 충전
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Settings className="h-4 w-4 mr-2" />
              환경 설정
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">
              <LogOut className="h-4 w-4 mr-2" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}