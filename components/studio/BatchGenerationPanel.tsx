import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Zap
} from 'lucide-react';
import { useBatchGeneration } from '@/hooks/useBatchGeneration';
import { ScriptPanel } from '@/lib/batch-generation/batch-state-machine';

export interface BatchGenerationPanelProps {
  projectId: string;
  scriptData: ScriptPanel[];
  canvasRatio: '1:1' | '4:5';
  onComplete?: (generatedImages: any[]) => void;
  onCancel?: () => void;
  className?: string;
}

export function BatchGenerationPanel({
  projectId,
  scriptData,
  canvasRatio,
  onComplete,
  onCancel,
  className = ''
}: BatchGenerationPanelProps) {
  const [isStarted, setIsStarted] = useState(false);
  
  const {
    currentJob,
    isLoading,
    error,
    progress,
    startBatchGeneration,
    cancelBatchGeneration,
    retryFailedPanels,
    clearJob,
    isRunning,
    isCompleted,
    isFailed,
    isCancelled,
    hasFailedPanels
  } = useBatchGeneration({
    projectId,
    onProgress: (progressData) => {
      console.log('배치 생성 진행률:', progressData);
    },
    onComplete: (job) => {
      console.log('배치 생성 완료:', job);
      if (onComplete) {
        onComplete(job.generatedImages);
      }
    },
    onError: (errorMessage) => {
      console.error('배치 생성 오류:', errorMessage);
    }
  });
  
  // 배치 생성 시작
  const handleStart = async () => {
    setIsStarted(true);
    await startBatchGeneration(scriptData, canvasRatio);
  };
  
  // 배치 생성 취소
  const handleCancel = async () => {
    await cancelBatchGeneration();
    setIsStarted(false);
    if (onCancel) {
      onCancel();
    }
  };
  
  // 실패한 패널 재시도
  const handleRetry = async () => {
    await retryFailedPanels();
  };
  
  // 작업 클리어
  const handleClear = () => {
    clearJob();
    setIsStarted(false);
  };
  
  // 상태별 아이콘 및 색상
  const getStatusInfo = () => {
    if (isRunning) {
      return { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50', label: '생성 중' };
    }
    if (isCompleted) {
      return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', label: '완료' };
    }
    if (isFailed) {
      return { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50', label: '실패' };
    }
    if (isCancelled) {
      return { icon: X, color: 'text-gray-500', bg: 'bg-gray-50', label: '취소됨' };
    }
    return { icon: Zap, color: 'text-purple-500', bg: 'bg-purple-50', label: '대기 중' };
  };
  
  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;
  
  if (!isStarted && !currentJob) {
    // 시작 전 상태
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-500" />
            배치 생성
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-600">
            <p>{scriptData.length}개 패널을 순차적으로 생성합니다.</p>
            <p className="mt-1">예상 소요 시간: 약 {Math.ceil(scriptData.length * 1.5)}분</p>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>캔버스 비율</span>
              <span>{canvasRatio}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>예상 토큰 사용량</span>
              <span>{(scriptData.length * 2000).toLocaleString()}토큰</span>
            </div>
          </div>
          
          <Button 
            onClick={handleStart}
            disabled={isLoading}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? '시작 중...' : '배치 생성 시작'}
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
            배치 생성
          </div>
          <Badge variant="outline" className={`${statusInfo.bg} ${statusInfo.color} border-0`}>
            {statusInfo.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 진행률 표시 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">진행률</span>
            <span className="text-gray-600">
              {progress.current} / {progress.total} ({progress.percentage}%)
            </span>
          </div>
          <Progress value={progress.percentage} className="h-2" />
          <p className="text-xs text-gray-500">{progress.status}</p>
        </div>
        
        {/* 작업 정보 */}
        {currentJob && (
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">작업 ID</span>
              <span className="font-mono">{currentJob.id.substring(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">캔버스 비율</span>
              <span>{currentJob.canvasRatio}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">사용된 토큰</span>
              <span>{currentJob.totalTokensUsed.toLocaleString()}토큰</span>
            </div>
            {currentJob.startedAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">시작 시간</span>
                <span>{new Date(currentJob.startedAt).toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        )}
        
        {/* 오류 메시지 */}
        {error && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* 액션 버튼들 */}
        <div className="flex gap-2">
          {isRunning && (
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
              className="flex-1"
            >
              <Pause className="h-4 w-4 mr-2" />
              취소
            </Button>
          )}
          
          {(isFailed || hasFailedPanels) && (
            <Button
              variant="outline"
              onClick={handleRetry}
              disabled={isLoading}
              className="flex-1"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              재시도
            </Button>
          )}
          
          {(isCompleted || isFailed || isCancelled) && (
            <Button
              variant="outline"
              onClick={handleClear}
              className="flex-1"
            >
              <X className="h-4 w-4 mr-2" />
              닫기
            </Button>
          )}
          
          {!isStarted && !isRunning && (
            <Button
              onClick={handleStart}
              disabled={isLoading}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              <Play className="h-4 w-4 mr-2" />
              {isLoading ? '시작 중...' : '시작'}
            </Button>
          )}
        </div>
        
        {/* 완료 시 결과 요약 */}
        {isCompleted && currentJob && (
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <div className="text-sm font-medium text-green-800 mb-1">
              배치 생성 완료!
            </div>
            <div className="text-xs text-green-600 space-y-1">
              <p>✅ {currentJob.completedPanels}개 패널 생성 성공</p>
              <p>⚡ 총 {currentJob.totalTokensUsed.toLocaleString()}토큰 사용</p>
              {currentJob.completedAt && currentJob.startedAt && (
                <p>⏱️ 소요 시간: {Math.ceil(
                  (new Date(currentJob.completedAt).getTime() - 
                   new Date(currentJob.startedAt).getTime()) / 1000 / 60
                )}분</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}