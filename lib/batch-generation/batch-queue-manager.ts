/**
 * 배치 생성 큐 관리자
 * 동시성 문제 해결 및 안정적인 배치 처리
 */

interface QueueItem {
  jobId: string;
  userId: string;
  projectId: string;
  priority: number;
  createdAt: Date;
  attempts: number;
  maxAttempts: number;
}

interface ProcessingJob {
  jobId: string;
  userId: string;
  startedAt: Date;
  sessionId: string;
}

export class BatchQueueManager {
  private static queue: QueueItem[] = [];
  private static processing = new Map<string, ProcessingJob>();
  private static readonly MAX_CONCURRENT_JOBS = 3; // 동시 처리 작업 수 제한
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly PROCESSING_TIMEOUT = 10 * 60 * 1000; // 10분 타임아웃
  
  /**
   * 배치 작업을 큐에 추가
   */
  static enqueue(jobId: string, userId: string, projectId: string, priority: number = 0): void {
    // 중복 작업 확인
    const existingItem = this.queue.find(item => item.jobId === jobId);
    if (existingItem) {
      console.log(`⚠️ 이미 큐에 있는 작업: ${jobId}`);
      return;
    }
    
    // 진행 중인 작업 확인
    if (this.processing.has(jobId)) {
      console.log(`⚠️ 이미 진행 중인 작업: ${jobId}`);
      return;
    }
    
    const item: QueueItem = {
      jobId,
      userId,
      projectId,
      priority,
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: this.MAX_ATTEMPTS
    };
    
    this.queue.push(item);
    this.queue.sort((a, b) => b.priority - a.priority); // 높은 우선순위 먼저
    
    console.log(`📥 배치 작업 큐 추가: ${jobId} (큐 크기: ${this.queue.length})`);
    
    // 즉시 처리 시도
    this.processQueue();
  }
  
  /**
   * 큐 처리 (동시성 제한)
   */
  static async processQueue(): Promise<void> {
    // 처리 중인 작업 수 확인
    if (this.processing.size >= this.MAX_CONCURRENT_JOBS) {
      console.log(`⏳ 동시 처리 한계 도달 (${this.processing.size}/${this.MAX_CONCURRENT_JOBS})`);
      return;
    }
    
    // 만료된 작업 정리
    this.cleanupTimeoutJobs();
    
    // 큐에서 다음 작업 가져오기
    const nextItem = this.queue.shift();
    if (!nextItem) {
      return;
    }
    
    try {
      await this.processJob(nextItem);
    } catch (error) {
      console.error(`❌ 배치 작업 처리 실패: ${nextItem.jobId}`, error);
      await this.handleJobFailure(nextItem, error);
    }
    
    // 큐에 더 작업이 있으면 계속 처리
    if (this.queue.length > 0) {
      setImmediate(() => this.processQueue());
    }
  }
  
  /**
   * 개별 작업 처리
   */
  private static async processJob(item: QueueItem): Promise<void> {
    const { jobId, userId, projectId } = item;
    
    console.log(`🚀 배치 작업 시작: ${jobId} (사용자: ${userId})`);
    
    // 세션 격리를 위한 세션 ID 생성
    const sessionId = `batch_${jobId}_${Date.now()}`;
    
    // 처리 중 상태로 변경
    this.processing.set(jobId, {
      jobId,
      userId,
      startedAt: new Date(),
      sessionId
    });
    
    try {
      // 실제 배치 처리 로직 호출
      await this.executeBatchGeneration(jobId, userId, projectId, sessionId);
      
      console.log(`✅ 배치 작업 완료: ${jobId}`);
      
    } finally {
      // 처리 완료 후 상태 정리
      this.processing.delete(jobId);
    }
  }
  
  /**
   * 실제 배치 생성 실행
   */
  private static async executeBatchGeneration(
    jobId: string, 
    userId: string, 
    projectId: string,
    sessionId: string
  ): Promise<void> {
    // 이 부분은 기존 배치 생성 로직을 호출
    // /app/api/batch/jobs/[jobId]/start/route.ts의 processBatchJobAsync 함수와 연동
    
    const response = await fetch(`/api/batch/jobs/${jobId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId,
        'X-User-ID': userId
      },
      body: JSON.stringify({
        projectId,
        sessionId
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '배치 생성 실행 실패');
    }
  }
  
  /**
   * 작업 실패 처리
   */
  private static async handleJobFailure(item: QueueItem, error: any): Promise<void> {
    item.attempts++;
    
    if (item.attempts < item.maxAttempts) {
      // 재시도
      console.log(`🔄 배치 작업 재시도: ${item.jobId} (${item.attempts}/${item.maxAttempts})`);
      
      // 우선순위를 낮춰서 큐 뒤로 보내기
      item.priority = Math.max(0, item.priority - 1);
      this.queue.push(item);
      this.queue.sort((a, b) => b.priority - a.priority);
      
    } else {
      // 최대 재시도 횟수 초과 - 실패 처리
      console.error(`💀 배치 작업 최종 실패: ${item.jobId}`);
      
      try {
        // DB에 실패 상태 기록
        await fetch(`/api/batch/jobs/${item.jobId}/fail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: error?.message || '알 수 없는 오류',
            attempts: item.attempts
          })
        });
      } catch (dbError) {
        console.error('실패 상태 DB 기록 실패:', dbError);
      }
    }
  }
  
  /**
   * 타임아웃된 작업 정리
   */
  private static cleanupTimeoutJobs(): void {
    const now = Date.now();
    const timeoutJobs = [];
    
    for (const [jobId, job] of this.processing.entries()) {
      if (now - job.startedAt.getTime() > this.PROCESSING_TIMEOUT) {
        timeoutJobs.push(jobId);
      }
    }
    
    timeoutJobs.forEach(jobId => {
      const job = this.processing.get(jobId);
      console.error(`⏰ 배치 작업 타임아웃: ${jobId} (사용자: ${job?.userId})`);
      
      this.processing.delete(jobId);
      
      // 타임아웃된 작업을 큐에 다시 추가 (우선순위 낮춤)
      this.enqueue(jobId, job!.userId, '', -1);
    });
  }
  
  /**
   * 특정 사용자의 작업 취소
   */
  static cancelUserJobs(userId: string): number {
    // 큐에서 제거
    const initialQueueLength = this.queue.length;
    this.queue = this.queue.filter(item => item.userId !== userId);
    const removedFromQueue = initialQueueLength - this.queue.length;
    
    // 진행 중인 작업 취소
    const processingJobs = Array.from(this.processing.entries())
      .filter(([_, job]) => job.userId === userId);
    
    processingJobs.forEach(([jobId, _]) => {
      this.processing.delete(jobId);
    });
    
    const totalCancelled = removedFromQueue + processingJobs.length;
    console.log(`🚫 사용자 작업 취소: ${userId} (${totalCancelled}개 작업)`);
    
    return totalCancelled;
  }
  
  /**
   * 큐 상태 조회
   */
  static getQueueStatus(): {
    queueLength: number;
    processingCount: number;
    availableSlots: number;
  } {
    return {
      queueLength: this.queue.length,
      processingCount: this.processing.size,
      availableSlots: this.MAX_CONCURRENT_JOBS - this.processing.size
    };
  }
  
  /**
   * 사용자별 큐 상태 조회
   */
  static getUserQueueStatus(userId: string): {
    queuedJobs: number;
    processingJobs: number;
    estimatedWaitTime: number; // 분 단위
  } {
    const queuedJobs = this.queue.filter(item => item.userId === userId).length;
    const processingJobs = Array.from(this.processing.values())
      .filter(job => job.userId === userId).length;
    
    // 대기 시간 추정 (매우 단순한 계산)
    const avgJobTime = 5; // 분 단위 (패널당 1분 * 평균 5패널)
    const jobsAhead = this.queue.findIndex(item => item.userId === userId);
    const estimatedWaitTime = jobsAhead >= 0 ? 
      Math.ceil((jobsAhead * avgJobTime) / this.MAX_CONCURRENT_JOBS) : 0;
    
    return {
      queuedJobs,
      processingJobs,
      estimatedWaitTime
    };
  }
}