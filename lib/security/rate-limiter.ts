/**
 * 네이버급 Rate Limiting 시스템
 * 메모리 기반, Redis 불필요
 */

interface RateLimitConfig {
  windowMs: number;        // 시간 창 (밀리초)
  maxRequests: number;     // 최대 요청수
  blockDuration: number;   // 차단 지속시간 (밀리초)
  skipSuccessfulRequests: boolean; // 성공 요청 제외 여부
}

interface RequestRecord {
  count: number;
  resetTime: number;
  blocked: boolean;
  blockUntil: number;
  firstRequest: number;
}

export enum SecurityLevel {
  CRITICAL = 'CRITICAL',    // AI 생성 API
  HIGH = 'HIGH',           // 관리자, 결제 API  
  MEDIUM = 'MEDIUM',       // 파일 업로드
  NORMAL = 'NORMAL'        // 일반 API
}

// API별 보안 수준 설정 (네이버 수준)
export const RATE_LIMIT_CONFIG: Record<SecurityLevel, RateLimitConfig> = {
  [SecurityLevel.CRITICAL]: {
    windowMs: 60 * 1000,      // 1분
    maxRequests: 3,           // 분당 3회
    blockDuration: 15 * 60 * 1000, // 15분 차단
    skipSuccessfulRequests: false
  },
  [SecurityLevel.HIGH]: {
    windowMs: 60 * 1000,      // 1분  
    maxRequests: 10,          // 분당 10회
    blockDuration: 5 * 60 * 1000,  // 5분 차단
    skipSuccessfulRequests: false
  },
  [SecurityLevel.MEDIUM]: {
    windowMs: 60 * 1000,      // 1분
    maxRequests: 20,          // 분당 20회
    blockDuration: 2 * 60 * 1000,  // 2분 차단
    skipSuccessfulRequests: true   // 성공 요청은 카운트 제외
  },
  [SecurityLevel.NORMAL]: {
    windowMs: 60 * 1000,      // 1분
    maxRequests: 60,          // 분당 60회
    blockDuration: 30 * 1000, // 30초 차단
    skipSuccessfulRequests: true
  }
};

class RateLimiter {
  private records = new Map<string, RequestRecord>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // 메모리 정리 (5분마다)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Rate limit 검사
   * @param identifier 식별자 (IP 또는 사용자ID)
   * @param securityLevel 보안 수준
   * @param isSuccess 요청 성공 여부 (선택사항)
   */
  checkLimit(
    identifier: string, 
    securityLevel: SecurityLevel,
    isSuccess?: boolean
  ): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    blockUntil?: number;
  } {
    const config = RATE_LIMIT_CONFIG[securityLevel];
    const now = Date.now();
    const key = `${securityLevel}:${identifier}`;
    
    let record = this.records.get(key);
    
    // 첫 요청 또는 창 리셋
    if (!record || now >= record.resetTime) {
      record = {
        count: 0,
        resetTime: now + config.windowMs,
        blocked: false,
        blockUntil: 0,
        firstRequest: now
      };
    }

    // 차단 상태 확인
    if (record.blocked && now < record.blockUntil) {
      this.records.set(key, record);
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
        blockUntil: record.blockUntil
      };
    }

    // 차단 해제
    if (record.blocked && now >= record.blockUntil) {
      record.blocked = false;
      record.blockUntil = 0;
      record.count = 0;
      record.resetTime = now + config.windowMs;
    }

    // 요청 카운트 (성공 요청 제외 설정 고려)
    const shouldCount = !config.skipSuccessfulRequests || !isSuccess;
    if (shouldCount) {
      record.count++;
    }

    // 한도 초과 확인
    if (record.count > config.maxRequests) {
      record.blocked = true;
      record.blockUntil = now + config.blockDuration;
      
      // 보안 로그 기록
      this.logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        identifier,
        securityLevel,
        count: record.count,
        blockDuration: config.blockDuration
      });

      this.records.set(key, record);
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
        blockUntil: record.blockUntil
      };
    }

    this.records.set(key, record);
    return {
      allowed: true,
      remaining: config.maxRequests - record.count,
      resetTime: record.resetTime
    };
  }

  /**
   * 수동 차단
   */
  blockIdentifier(
    identifier: string, 
    securityLevel: SecurityLevel, 
    duration: number,
    reason: string
  ): void {
    const now = Date.now();
    const key = `${securityLevel}:${identifier}`;
    
    this.records.set(key, {
      count: 999999,
      resetTime: now + duration,
      blocked: true,
      blockUntil: now + duration,
      firstRequest: now
    });

    this.logSecurityEvent('MANUAL_BLOCK', {
      identifier,
      securityLevel,
      reason,
      duration
    });
  }

  /**
   * 차단 해제
   */
  unblockIdentifier(identifier: string, securityLevel: SecurityLevel): void {
    const key = `${securityLevel}:${identifier}`;
    this.records.delete(key);

    this.logSecurityEvent('MANUAL_UNBLOCK', {
      identifier,
      securityLevel
    });
  }

  /**
   * 통계 조회
   */
  getStats(): {
    totalRecords: number;
    blockedCount: number;
    memoryUsage: number;
  } {
    const blocked = Array.from(this.records.values())
      .filter(record => record.blocked).length;

    return {
      totalRecords: this.records.size,
      blockedCount: blocked,
      memoryUsage: JSON.stringify(Array.from(this.records.entries())).length
    };
  }

  /**
   * 메모리 정리
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, record] of this.records.entries()) {
      // 만료된 레코드 삭제
      if (now >= record.resetTime && !record.blocked) {
        this.records.delete(key);
        cleaned++;
      }
      // 차단 해제된 레코드 삭제
      else if (record.blocked && now >= record.blockUntil) {
        this.records.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 [RateLimiter] 메모리 정리 완료: ${cleaned}개 레코드 삭제`);
    }
  }

  /**
   * 보안 이벤트 로그
   */
  private logSecurityEvent(event: string, data: any): void {
    console.warn(`🚨 [Security] ${event}:`, {
      timestamp: new Date().toISOString(),
      ...data
    });

    // 실시간 모니터링 시스템에 이벤트 전송
    try {
      const { securityMonitor } = require('./security-monitor');
      securityMonitor.recordEvent(
        'RATE_LIMIT_EXCEEDED',
        data.blockDuration > 5 * 60 * 1000 ? 'HIGH' : 'MEDIUM',
        data.identifier || 'unknown',
        data
      );
    } catch (error) {
      // 모니터링 시스템 오류가 서비스에 영향주지 않도록
      console.debug('모니터링 시스템 연동 오류:', error);
    }
  }

  /**
   * 정리 작업
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.records.clear();
  }
}

// 싱글톤 인스턴스
export const rateLimiter = new RateLimiter();

// Edge Runtime에서는 process.on이 지원되지 않음
// 프로덕션 환경에서는 서버 종료 시 자동으로 메모리 해제됨