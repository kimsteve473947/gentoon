"use client";

import { useEffect, useState } from "react";
import { useStudioStore } from "@/lib/stores/studio-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Wifi,
  WifiOff,
  Zap,
  User,
  Image as ImageIcon,
  RefreshCw,
  X,
} from "lucide-react";

export function StatusBar() {
  const {
    panels,
    isGenerating,
    generationQueue,
    tokenBalance,
    characters,
    currentProject,
    cancelGeneration,
  } = useStudioStore();

  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline'>('online');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // 연결 상태 모니터링
  useEffect(() => {
    const handleOnline = () => setConnectionStatus('online');
    const handleOffline = () => setConnectionStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 프로젝트 저장 시간 추적
  useEffect(() => {
    if (currentProject?.updatedAt) {
      setLastSaved(new Date(currentProject.updatedAt));
    }
  }, [currentProject?.updatedAt]);

  // 통계 계산
  const completedPanels = panels.filter(p => p.imageUrl).length;
  const generatingPanels = panels.filter(p => p.isGenerating).length;
  const activeCharacters = characters.filter(c => c.isActive).length;
  const totalTokensUsed = panels.reduce((sum, p) => sum + (p.tokensUsed || 0), 0);

  // 생성 진행률 계산
  const generationProgress = generationQueue.length > 0 
    ? ((generationQueue.length - generatingPanels) / generationQueue.length) * 100
    : 0;

  return (
    <TooltipProvider>
      <div className="h-8 bg-gray-50 border-t flex items-center justify-between px-4 text-xs text-gray-600">
        {/* 왼쪽 영역 - 프로젝트 상태 */}
        <div className="flex items-center gap-4">
          {/* 연결 상태 */}
          <div className="flex items-center gap-1">
            {connectionStatus === 'online' ? (
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex items-center gap-1">
                    <Wifi className="h-3 w-3 text-green-500" />
                    <span className="text-green-600">온라인</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>서버 연결 상태: 정상</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex items-center gap-1">
                    <WifiOff className="h-3 w-3 text-red-500" />
                    <span className="text-red-600">오프라인</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>인터넷 연결을 확인해주세요</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* 마지막 저장 시간 */}
          {lastSaved && (
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span>
                    {new Date().getTime() - lastSaved.getTime() < 60000
                      ? '방금 저장됨'
                      : `${Math.floor((new Date().getTime() - lastSaved.getTime()) / 60000)}분 전 저장됨`
                    }
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>마지막 저장: {lastSaved.toLocaleString()}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* 생성 진행 상황 */}
          {isGenerating && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-blue-500 animate-pulse" />
                <span className="text-blue-600">
                  {generatingPanels}개 패널 생성 중...
                </span>
              </div>
              
              {generationQueue.length > 1 && (
                <div className="flex items-center gap-2">
                  <Progress value={generationProgress} className="w-20 h-2" />
                  <Button
                    variant="ghost"
                    size="sm" 
                    onClick={cancelGeneration}
                    className="h-5 w-5 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* 오류 상태 */}
          {connectionStatus === 'offline' && (
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-amber-500" />
              <span className="text-amber-600">오프라인 모드</span>
            </div>
          )}
        </div>

        {/* 중앙 영역 - 프로젝트 통계 */}
        <div className="flex items-center gap-4">
          {/* 패널 통계 */}
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center gap-1">
                <ImageIcon className="h-3 w-3" />
                <span>{completedPanels}/{panels.length} 패널</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>완성된 패널: {completedPanels}개</p>
              <p>전체 패널: {panels.length}개</p>
            </TooltipContent>
          </Tooltip>

          {/* 활성 캐릭터 */}
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>{activeCharacters}개 캐릭터</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>활성 캐릭터: {activeCharacters}개</p>
              <p>전체 캐릭터: {characters.length}개</p>
            </TooltipContent>
          </Tooltip>

          {/* 토큰 사용량 */}
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-yellow-500" />
                <span>{totalTokensUsed} 토큰 사용</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>이 프로젝트에서 사용한 토큰: {totalTokensUsed.toLocaleString()}개</p>
              <p>남은 토큰: {tokenBalance.toLocaleString()}개</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* 오른쪽 영역 - 시스템 정보 */}
        <div className="flex items-center gap-4">
          {/* 토큰 잔액 경고 */}
          {tokenBalance < 10 && (
            <Badge variant="destructive" className="text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />
              토큰 부족
            </Badge>
          )}

          {/* 현재 시간 */}
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{currentTime.toLocaleTimeString()}</span>
          </div>

          {/* 버전 정보 */}
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="text-xs">
                v1.0.0
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>GenToon 스튜디오 v1.0.0</p>
              <p>마지막 업데이트: 2024.01.15</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}