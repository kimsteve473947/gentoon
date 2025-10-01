/**
 * AI Generation Queue System
 * 
 * 동시 이미지 생성 요청을 안전하게 처리하기 위한 큐 시스템
 * - 요청 순서 보장 
 * - 동시 실행 제한 (rate limiting)
 * - 중복 요청 방지
 * - 자동 재시도 로직
 */

interface GenerationRequest {
  id: string;
  userId: string;
  panelId?: string;
  prompt: string;
  options: any;
  priority: number;
  createdAt: number;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  retryCount: number;
  maxRetries: number;
}

class GenerationQueue {
  private queue: GenerationRequest[] = [];
  private processing = new Map<string, GenerationRequest>();
  private completed = new Map<string, any>();
  private maxConcurrent = 2; // 동시 처리 가능한 요청 수 (Google AI 제한 고려)
  private currentlyProcessing = 0;
  private processingInterval: NodeJS.Timeout | null = null;
  private userRequestCounts = new Map<string, number>(); // 사용자별 동시 요청 수 제한
  
  // 🚀 메모리 관리 설정
  private readonly MAX_COMPLETED_CACHE_SIZE = 50; // 최대 캐시 크기
  private readonly MAX_USER_COUNT_ENTRIES = 100; // 최대 사용자 카운트 엔트리 수
  private readonly CACHE_CLEANUP_INTERVAL = 10 * 60 * 1000; // 10분마다 정리
  private memoryCleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startProcessing();
    this.startMemoryManagement();
  }

  /**
   * 생성 요청을 큐에 추가
   */
  async enqueue(
    userId: string,
    prompt: string,
    options: any,
    panelId?: string,
    priority: number = 0
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // 요청 ID 생성 (중복 방지용)
      const requestId = this.generateRequestId(userId, prompt, panelId);
      
      // 사용자별 동시 요청 수 제한 (사용자당 최대 4개로 증가)
      const userCurrentRequests = this.getUserRequestCount(userId);
      if (userCurrentRequests >= 4) {
        console.log(`⚠️ 사용자 ${userId}의 동시 요청 한도 초과 (${userCurrentRequests}/4)`);
        reject(new Error('동시 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'));
        return;
      }

      // 처리 중인 요청 확인 (패널별로 완전히 독립적)
      if (this.processing.has(requestId)) {
        console.log(`🔄 동일한 요청이 이미 처리 중: ${requestId}`);
        reject(new Error('동일한 요청이 이미 처리 중입니다'));
        return;
      }

      // 완료된 요청 캐시 확인 (선택적)
      if (this.completed.has(requestId)) {
        console.log(`✅ 캐시된 결과 반환: ${requestId}`);
        resolve(this.completed.get(requestId));
        return;
      }

      const request: GenerationRequest = {
        id: requestId,
        userId,
        panelId,
        prompt,
        options,
        priority,
        createdAt: Date.now(),
        resolve,
        reject,
        retryCount: 0,
        maxRetries: 2
      };

      // 우선순위에 따라 큐에 삽입
      this.insertByPriority(request);
      
      console.log(`📥 큐에 추가: ${requestId} (큐 크기: ${this.queue.length})`);
    });
  }

  /**
   * 우선순위에 따라 요청을 큐에 삽입
   */
  private insertByPriority(request: GenerationRequest) {
    let insertIndex = this.queue.length;
    
    // 높은 우선순위(숫자가 클수록)가 앞에 오도록 삽입
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].priority < request.priority) {
        insertIndex = i;
        break;
      }
    }
    
    this.queue.splice(insertIndex, 0, request);
  }

  /**
   * 요청 ID 생성 (패널별 독립적 처리)
   */
  private generateRequestId(userId: string, prompt: string, panelId?: string): string {
    // 패널별로 완전히 독립적인 ID 생성
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    
    if (panelId) {
      // 패널별 요청은 패널 ID를 포함하여 완전히 분리
      return `panel-${panelId}-${userId}-${timestamp}-${randomSuffix}`;
    } else {
      // 일반 요청은 사용자별로만 구분
      return `gen-${userId}-${timestamp}-${randomSuffix}`;
    }
  }

  /**
   * 큐 처리 시작
   */
  private startProcessing() {
    if (this.processingInterval) return;

    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 50); // 50ms마다 큐 확인 (더 빠른 처리)
  }

  /**
   * 큐 처리 메인 로직
   */
  private async processQueue() {
    // 동시 처리 한도 확인
    if (this.currentlyProcessing >= this.maxConcurrent) {
      return;
    }

    // 처리할 요청이 없으면 대기
    if (this.queue.length === 0) {
      return;
    }

    // 큐에서 다음 요청 가져오기
    const request = this.queue.shift();
    if (!request) return;

    // 처리 중 목록에 추가
    this.processing.set(request.id, request);
    this.currentlyProcessing++;
    this.incrementUserRequestCount(request.userId);

    console.log(`🚀 처리 시작: ${request.id} (동시 처리 중: ${this.currentlyProcessing}/${this.maxConcurrent})`);
    
    // 🚀 성능 최적화: Google AI API 동시 요청 지연 단축
    if (this.currentlyProcessing > 1) {
      console.log('⏱️ 동시 요청 감지 - 200ms 지연 (최적화됨)');
      await new Promise(resolve => setTimeout(resolve, 200)); // 500ms → 200ms로 단축
    }
    console.log(`👤 사용자 ${request.userId} 처리 중: ${this.getUserRequestCount(request.userId)}개`);

    try {
      // 실제 AI 생성 호출
      const result = await this.executeGeneration(request);
      
      // 성공 시 완료 캐시에 저장 (5분간) - 🚀 메모리 관리 적용
      if (!request.panelId) {
        // 일반 요청만 캐시 (패널 요청은 매번 새로 생성)
        this.addToCompletedCache(request.id, result);
      }

      // 성공 콜백 호출
      request.resolve(result);
      console.log(`✅ 처리 완료: ${request.id} (패널: ${request.panelId || 'N/A'})`);

    } catch (error) {
      console.error(`❌ 처리 실패: ${request.id}`, error);
      
      // 재시도 가능 여부 확인
      const isRetryableError = this.isRetryableError(error);
      const shouldRetry = request.retryCount < request.maxRetries && isRetryableError;
      
      if (shouldRetry) {
        request.retryCount++;
        // Google AI 동시 요청 제한의 경우 더 긴 지연
        const isGoogleAILimit = error.message.includes('동시 요청 제한');
        const baseDelay = isGoogleAILimit ? 3000 : 1000; // Google AI 제한의 경우 3초 기본 지연
        const delay = Math.min(baseDelay * Math.pow(2, request.retryCount), 15000); // 최대 15초
        
        console.log(`🔄 재시도 ${request.retryCount}/${request.maxRetries}: ${request.id} (${delay}ms 후)${isGoogleAILimit ? ' [Google AI 제한]' : ''}`);
        
        // 지연 후 재시도
        setTimeout(() => {
          request.priority += 5; // 재시도 요청 우선순위 증가
          this.insertByPriority(request);
        }, delay);
        
      } else {
        // 재시도 불가능하거나 최대 횟수 초과
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`💀 재시도 불가능한 오류 또는 최대 횟수 초과: ${request.id} - ${errorMessage}`);
        request.reject(error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      // 처리 완료 후 정리 (재시도인 경우는 카운터 유지)
      this.processing.delete(request.id);
      this.currentlyProcessing--;
      this.decrementUserRequestCount(request.userId);
    }
  }

  /**
   * 실제 AI 생성 실행 (강화된 에러 핸들링)
   */
  private async executeGeneration(request: GenerationRequest): Promise<any> {
    const startTime = Date.now();
    
    try {
      // 🔐 사용자별 격리된 nano-banana-service 동적 import
      const { NanoBananaServiceFactory } = await import('./nano-banana-service');
      
      console.log(`🎨 AI 생성 실행 시작: ${request.id} (패널: ${request.panelId || 'N/A'})`);
      
      // 🔐 사용자별 격리된 서비스 인스턴스 획득
      const userService = NanoBananaServiceFactory.getUserInstance(
        request.userId, 
        request.id // 요청별 세션 ID로 더 강한 격리
      );
      
      console.log(`🔐 사용자별 격리된 서비스 사용: ${request.userId}-${request.id}`);
      
      // 타임아웃 설정 (90초로 단축 - 성능 최적화)
      const generationPromise = userService.generateWebtoonPanel(
        request.prompt,
        {
          userId: request.userId,
          sessionId: request.id, // 세션 ID 전달
          panelId: request.panelId ? parseInt(request.panelId) : undefined, // 패널 ID 전달 (컨텍스트용)
          ...request.options
        }
      );

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`이미지 생성 타임아웃 (90초 초과): ${request.id}`));
        }, 90000);
      });

      const result = await Promise.race([generationPromise, timeoutPromise]);
      
      const executionTime = Date.now() - startTime;
      console.log(`✅ AI 생성 완료: ${request.id} (${executionTime}ms)`);
      
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ AI 생성 실패: ${request.id} (${executionTime}ms)`, error);
      
      // 에러 타입별 분류
      if (error instanceof Error) {
        if (error.message.includes('타임아웃')) {
          throw new Error(`이미지 생성 시간 초과 (패널: ${request.panelId})`);
        } else if (error.message.includes('토큰')) {
          throw new Error(`토큰 부족 (패널: ${request.panelId})`);
        } else if (error.message.includes('네트워크') || error.message.includes('fetch')) {
          throw new Error(`네트워크 오류 (패널: ${request.panelId}) - 재시도 가능`);
        }
      }
      
      throw error;
    }
  }

  /**
   * 재시도 가능한 오류인지 판단
   */
  private isRetryableError(error: any): boolean {
    if (!(error instanceof Error)) return false;
    
    const message = error.message.toLowerCase();
    
    // 재시도 가능한 오류들
    const retryableErrors = [
      '네트워크',
      'network',
      'timeout',
      'connection',
      'fetch',
      'abort',
      '일시적',
      'temporary',
      'rate limit',
      'too many requests',
      '동시 요청 제한',
      'concurrent request limit',
      '503',
      '502',
      '504'
    ];
    
    // 재시도 불가능한 오류들
    const nonRetryableErrors = [
      '토큰 부족',
      'insufficient',
      '401',
      '403',
      '404',
      'not found',
      'unauthorized',
      'forbidden',
      'invalid',
      '잘못된'
    ];
    
    // 재시도 불가능한 오류 먼저 확인
    for (const pattern of nonRetryableErrors) {
      if (message.includes(pattern)) {
        console.log(`🚫 재시도 불가능한 오류: ${pattern}`);
        return false;
      }
    }
    
    // 재시도 가능한 오류 확인
    for (const pattern of retryableErrors) {
      if (message.includes(pattern)) {
        console.log(`🔄 재시도 가능한 오류: ${pattern}`);
        return true;
      }
    }
    
    // 분류되지 않은 오류는 일단 재시도 시도
    console.log(`❓ 미분류 오류 - 재시도 시도: ${message.substring(0, 100)}`);
    return true;
  }

  /**
   * 사용자별 요청 수 추적 함수들
   */
  private getUserRequestCount(userId: string): number {
    return this.userRequestCounts.get(userId) || 0;
  }

  private incrementUserRequestCount(userId: string): void {
    const current = this.getUserRequestCount(userId);
    this.userRequestCounts.set(userId, current + 1);
  }

  private decrementUserRequestCount(userId: string): void {
    const current = this.getUserRequestCount(userId);
    if (current <= 1) {
      this.userRequestCounts.delete(userId);
    } else {
      this.userRequestCounts.set(userId, current - 1);
    }
  }

  /**
   * 🚀 메모리 관리 시작
   */
  private startMemoryManagement() {
    if (this.memoryCleanupInterval) return;

    this.memoryCleanupInterval = setInterval(() => {
      this.performMemoryCleanup();
    }, this.CACHE_CLEANUP_INTERVAL);

    console.log('🧹 메모리 관리 시스템 시작 (10분 간격)');
  }

  /**
   * 🚀 메모리 정리 수행
   */
  private performMemoryCleanup() {
    const initialStats = {
      completedCacheSize: this.completed.size,
      userCountsSize: this.userRequestCounts.size,
      queueLength: this.queue.length
    };

    // 1. 완료된 요청 캐시 정리 (LRU 방식으로 오래된 항목 삭제)
    this.cleanupCompletedCache();

    // 2. 사용자 요청 카운트 정리 (0인 항목들 삭제)
    this.cleanupUserRequestCounts();

    // 3. 오래된 큐 항목 정리 (5분 이상 대기한 항목들)
    this.cleanupOldQueueItems();

    const finalStats = {
      completedCacheSize: this.completed.size,
      userCountsSize: this.userRequestCounts.size,
      queueLength: this.queue.length
    };

    console.log('🧹 메모리 정리 완료:', {
      before: initialStats,
      after: finalStats,
      freed: {
        cache: initialStats.completedCacheSize - finalStats.completedCacheSize,
        userCounts: initialStats.userCountsSize - finalStats.userCountsSize,
        queue: initialStats.queueLength - finalStats.queueLength
      }
    });
  }

  /**
   * 🚀 완료된 요청 캐시에 안전하게 추가
   */
  private addToCompletedCache(requestId: string, result: any) {
    // 캐시 크기 제한 확인 및 정리
    if (this.completed.size >= this.MAX_COMPLETED_CACHE_SIZE) {
      this.cleanupCompletedCache(true);
    }

    // 결과 저장 및 만료 타이머 설정
    this.completed.set(requestId, result);
    setTimeout(() => {
      this.completed.delete(requestId);
    }, 5 * 60 * 1000);
  }

  /**
   * 🚀 완료된 요청 캐시 정리
   */
  private cleanupCompletedCache(force: boolean = false) {
    const targetSize = force ? Math.floor(this.MAX_COMPLETED_CACHE_SIZE * 0.7) : this.MAX_COMPLETED_CACHE_SIZE;
    
    if (this.completed.size <= targetSize) return;

    // Map의 insertion order를 이용한 LRU 삭제 (가장 오래된 항목부터)
    const keysToDelete = Array.from(this.completed.keys()).slice(0, this.completed.size - targetSize);
    keysToDelete.forEach(key => this.completed.delete(key));

    console.log(`🗑️ 캐시 정리: ${keysToDelete.length}개 항목 삭제 (${this.completed.size}/${this.MAX_COMPLETED_CACHE_SIZE})`);
  }

  /**
   * 🚀 사용자 요청 카운트 정리
   */
  private cleanupUserRequestCounts() {
    const initialSize = this.userRequestCounts.size;
    
    // 값이 0인 항목들 삭제
    for (const [userId, count] of this.userRequestCounts.entries()) {
      if (count <= 0) {
        this.userRequestCounts.delete(userId);
      }
    }

    // 크기 제한 확인 (너무 많은 사용자 카운트가 쌓이는 것 방지)
    if (this.userRequestCounts.size > this.MAX_USER_COUNT_ENTRIES) {
      // 가장 오래된 항목들 삭제 (Map의 insertion order 이용)
      const keysToDelete = Array.from(this.userRequestCounts.keys())
        .slice(0, this.userRequestCounts.size - Math.floor(this.MAX_USER_COUNT_ENTRIES * 0.8));
      
      keysToDelete.forEach(key => this.userRequestCounts.delete(key));
      console.log(`👥 사용자 카운트 정리: ${keysToDelete.length}개 항목 삭제`);
    }

    const cleaned = initialSize - this.userRequestCounts.size;
    if (cleaned > 0) {
      console.log(`🗑️ 사용자 카운트 정리: ${cleaned}개 항목 삭제`);
    }
  }

  /**
   * 🚀 오래된 큐 항목 정리 (5분 이상 대기)
   */
  private cleanupOldQueueItems() {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const initialLength = this.queue.length;
    
    this.queue = this.queue.filter(request => {
      if (request.createdAt < fiveMinutesAgo) {
        console.warn(`⏰ 오래된 요청 제거: ${request.id} (${Math.round((Date.now() - request.createdAt) / 60000)}분 대기)`);
        request.reject(new Error('요청 대기 시간 초과 (5분)'));
        return false;
      }
      return true;
    });

    const cleaned = initialLength - this.queue.length;
    if (cleaned > 0) {
      console.log(`🗑️ 오래된 큐 항목 정리: ${cleaned}개 항목 삭제`);
    }
  }

  /**
   * 큐 상태 조회
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.currentlyProcessing,
      maxConcurrent: this.maxConcurrent,
      completedCacheSize: this.completed.size,
      processingRequests: Array.from(this.processing.keys()),
      userRequestCounts: Object.fromEntries(this.userRequestCounts),
      queuedByUser: this.getQueuedRequestsByUser(),
      // 🚀 메모리 관리 정보 추가
      memoryInfo: {
        cacheSize: this.completed.size,
        maxCacheSize: this.MAX_COMPLETED_CACHE_SIZE,
        userCountSize: this.userRequestCounts.size,
        maxUserCountSize: this.MAX_USER_COUNT_ENTRIES,
        memoryManagement: this.memoryCleanupInterval !== null
      }
    };
  }

  private getQueuedRequestsByUser(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const request of this.queue) {
      counts[request.userId] = (counts[request.userId] || 0) + 1;
    }
    return counts;
  }

  /**
   * 특정 사용자의 요청 취소
   */
  cancelUserRequests(userId: string) {
    // 큐에서 해당 사용자의 요청 제거
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(req => {
      if (req.userId === userId) {
        req.reject(new Error('요청이 취소되었습니다'));
        return false;
      }
      return true;
    });
    
    const removedCount = initialLength - this.queue.length;
    console.log(`🗑️ 사용자 ${userId}의 요청 ${removedCount}개 취소`);
    
    return removedCount;
  }

  /**
   * 동시 처리 한도 조정
   */
  setMaxConcurrent(max: number) {
    this.maxConcurrent = Math.max(1, Math.min(10, max)); // 1-10 사이로 제한
    console.log(`⚙️ 동시 처리 한도 변경: ${this.maxConcurrent}`);
  }

  /**
   * 큐 정리 (개발용)
   */
  clear() {
    this.queue.forEach(req => req.reject(new Error('큐가 초기화되었습니다')));
    this.queue = [];
    this.completed.clear();
    console.log('🧹 큐 초기화 완료');
  }

  /**
   * 큐 시스템 종료 - 🚀 메모리 관리 정리 포함
   */
  shutdown() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // 🚀 메모리 관리 인터벌도 정리
    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
      this.memoryCleanupInterval = null;
    }
    
    // 마지막 메모리 정리 수행
    this.performMemoryCleanup();
    this.clear();
    
    console.log('🛑 큐 시스템 및 메모리 관리 종료');
  }
}

// 싱글톤 인스턴스 생성
export const generationQueue = new GenerationQueue();

// 개발 환경에서 글로벌 접근 가능하도록 설정
if (typeof globalThis !== 'undefined' && process.env.NODE_ENV === 'development') {
  (globalThis as any).generationQueue = generationQueue;
}