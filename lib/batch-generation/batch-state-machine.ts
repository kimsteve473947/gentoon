/**
 * 배치 생성 상태 머신
 * 안정적이고 재시작 가능한 배치 생성 시스템
 */

export type BatchJobStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type PanelStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface BatchGenerationJob {
  id: string;
  userId: string;
  projectId: string;
  status: BatchJobStatus;
  totalPanels: number;
  completedPanels: number;
  currentPanelIndex: number;
  canvasRatio: '1:1' | '4:5';
  scriptData: ScriptPanel[];
  generatedImages: GeneratedImage[];
  failedPanels: FailedPanel[];
  totalTokensUsed: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BatchPanelResult {
  id: string;
  batchJobId: string;
  panelOrder: number;
  panelId?: string;
  status: PanelStatus;
  imageUrl?: string;
  generationId?: string;
  tokensUsed: number;
  prompt: string;
  characters: string[];
  elements: string[];
  errorMessage?: string;
  retryCount: number;
  startedAt?: string;
  completedAt?: string;
}

export interface ScriptPanel {
  order: number;
  prompt: string;
  characters: string[];
  elements: string[];
}

export interface GeneratedImage {
  order: number;
  imageUrl: string;
  generationId: string;
  tokensUsed: number;
}

export interface FailedPanel {
  order: number;
  error: string;
  retryCount: number;
}

/**
 * 배치 생성 상태 전환 관리
 */
export class BatchGenerationStateMachine {
  
  /**
   * 새 배치 작업 생성
   */
  static async createBatchJob(
    userId: string,
    projectId: string,
    scriptData: ScriptPanel[],
    canvasRatio: '1:1' | '4:5'
  ): Promise<string> {
    const response = await fetch('/api/batch/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        projectId,
        scriptData,
        canvasRatio,
        totalPanels: scriptData.length
      })
    });
    
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }
    
    return result.jobId;
  }

  /**
   * 배치 작업 시작
   */
  static async startBatchJob(jobId: string): Promise<void> {
    const response = await fetch(`/api/batch/jobs/${jobId}/start`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
  }

  /**
   * 배치 작업 상태 조회
   */
  static async getBatchJobStatus(jobId: string): Promise<BatchGenerationJob> {
    const response = await fetch(`/api/batch/jobs/${jobId}`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    return result.job;
  }

  /**
   * 배치 작업 취소
   */
  static async cancelBatchJob(jobId: string): Promise<void> {
    const response = await fetch(`/api/batch/jobs/${jobId}/cancel`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
  }

  /**
   * 실패한 패널 재시도
   */
  static async retryFailedPanels(jobId: string): Promise<void> {
    const response = await fetch(`/api/batch/jobs/${jobId}/retry`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
  }

  /**
   * 배치 작업 진행률 계산
   */
  static calculateProgress(job: BatchGenerationJob): {
    percentage: number;
    current: number;
    total: number;
    status: string;
  } {
    const percentage = job.totalPanels > 0 
      ? Math.round((job.completedPanels / job.totalPanels) * 100)
      : 0;
    
    let status = '';
    switch (job.status) {
      case 'pending':
        status = '대기 중...';
        break;
      case 'in_progress':
        status = `패널 ${job.currentPanelIndex + 1}/${job.totalPanels} 생성 중...`;
        break;
      case 'completed':
        status = '완료됨';
        break;
      case 'failed':
        status = '실패함';
        break;
      case 'cancelled':
        status = '취소됨';
        break;
    }
    
    return {
      percentage,
      current: job.completedPanels,
      total: job.totalPanels,
      status
    };
  }
}