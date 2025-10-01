import { useState, useEffect, useCallback, useRef } from 'react';
import { BatchGenerationJob, BatchGenerationStateMachine, ScriptPanel } from '@/lib/batch-generation/batch-state-machine';

export interface UseBatchGenerationOptions {
  projectId: string;
  onProgress?: (progress: { percentage: number; current: number; total: number; status: string }) => void;
  onComplete?: (job: BatchGenerationJob) => void;
  onError?: (error: string) => void;
  pollInterval?: number; // 폴링 간격 (ms), 기본값: 2000
}

export interface UseBatchGenerationReturn {
  // 상태
  currentJob: BatchGenerationJob | null;
  isLoading: boolean;
  error: string | null;
  
  // 진행 상황
  progress: {
    percentage: number;
    current: number;
    total: number;
    status: string;
  };
  
  // 액션
  startBatchGeneration: (scriptData: ScriptPanel[], canvasRatio: '1:1' | '4:5') => Promise<void>;
  cancelBatchGeneration: () => Promise<void>;
  retryFailedPanels: () => Promise<void>;
  clearJob: () => void;
  
  // 상태 확인
  isRunning: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  isCancelled: boolean;
  hasFailedPanels: boolean;
}

export function useBatchGeneration(options: UseBatchGenerationOptions): UseBatchGenerationReturn {
  const { projectId, onProgress, onComplete, onError, pollInterval = 2000 } = options;
  
  const [currentJob, setCurrentJob] = useState<BatchGenerationJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldPollRef = useRef(false);
  
  // 진행 상황 계산
  const progress = currentJob 
    ? BatchGenerationStateMachine.calculateProgress(currentJob)
    : { percentage: 0, current: 0, total: 0, status: '대기 중...' };
  
  // 상태 확인
  const isRunning = currentJob?.status === 'in_progress';
  const isCompleted = currentJob?.status === 'completed';
  const isFailed = currentJob?.status === 'failed';
  const isCancelled = currentJob?.status === 'cancelled';
  const hasFailedPanels = false; // TODO: 실패한 패널 수 계산
  
  // 배치 작업 상태 폴링
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const job = await BatchGenerationStateMachine.getBatchJobStatus(jobId);
      setCurrentJob(job);
      
      // 진행 상황 콜백 호출
      if (onProgress) {
        const progressData = BatchGenerationStateMachine.calculateProgress(job);
        onProgress(progressData);
      }
      
      // 완료 또는 실패 시 폴링 중단
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        shouldPollRef.current = false;
        
        if (job.status === 'completed' && onComplete) {
          onComplete(job);
        } else if (job.status === 'failed' && onError) {
          onError(job.errorMessage || '배치 생성이 실패했습니다');
        }
        
        return;
      }
      
      // 계속 폴링
      if (shouldPollRef.current) {
        pollTimeoutRef.current = setTimeout(() => {
          pollJobStatus(jobId);
        }, pollInterval);
      }
      
    } catch (error) {
      console.error('배치 작업 상태 조회 실패:', error);
      setError(error instanceof Error ? error.message : '상태 조회에 실패했습니다');
      shouldPollRef.current = false;
    }
  }, [onProgress, onComplete, onError, pollInterval]);
  
  // 폴링 시작
  const startPolling = useCallback((jobId: string) => {
    shouldPollRef.current = true;
    pollJobStatus(jobId);
  }, [pollJobStatus]);
  
  // 폴링 중단
  const stopPolling = useCallback(() => {
    shouldPollRef.current = false;
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);
  
  // 배치 생성 시작
  const startBatchGeneration = useCallback(async (
    scriptData: ScriptPanel[], 
    canvasRatio: '1:1' | '4:5'
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 1. 배치 작업 생성
      const jobId = await BatchGenerationStateMachine.createBatchJob(
        '', // userId는 서버에서 자동으로 가져옴
        projectId,
        scriptData,
        canvasRatio
      );
      
      // 2. 배치 작업 시작
      await BatchGenerationStateMachine.startBatchJob(jobId);
      
      // 3. 폴링 시작
      startPolling(jobId);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '배치 생성 시작에 실패했습니다';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, startPolling, onError]);
  
  // 배치 생성 취소
  const cancelBatchGeneration = useCallback(async () => {
    if (!currentJob) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await BatchGenerationStateMachine.cancelBatchJob(currentJob.id);
      stopPolling();
      
      // 즉시 상태 업데이트
      setCurrentJob(prev => prev ? { ...prev, status: 'cancelled' } : null);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '배치 생성 취소에 실패했습니다';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentJob, stopPolling, onError]);
  
  // 실패한 패널 재시도
  const retryFailedPanels = useCallback(async () => {
    if (!currentJob) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await BatchGenerationStateMachine.retryFailedPanels(currentJob.id);
      
      // 배치 작업 재시작
      await BatchGenerationStateMachine.startBatchJob(currentJob.id);
      
      // 폴링 재시작
      startPolling(currentJob.id);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '재시도에 실패했습니다';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentJob, startPolling, onError]);
  
  // 작업 클리어
  const clearJob = useCallback(() => {
    stopPolling();
    setCurrentJob(null);
    setError(null);
  }, [stopPolling]);
  
  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);
  
  return {
    // 상태
    currentJob,
    isLoading,
    error,
    
    // 진행 상황
    progress,
    
    // 액션
    startBatchGeneration,
    cancelBatchGeneration,
    retryFailedPanels,
    clearJob,
    
    // 상태 확인
    isRunning,
    isCompleted,
    isFailed,
    isCancelled,
    hasFailedPanels
  };
}