/**
 * 보안 로깅 유틸리티
 * 프로덕션 환경에서 민감한 정보 로깅 방지
 */

import fs from 'fs';
import path from 'path';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

export class SecureLogger {
  /**
   * 프로덕션에서 중요 로그를 파일에 저장
   */
  private static writeToFile(level: 'error' | 'warn' | 'security', message: string, data?: any) {
    if (!isProduction) return;

    try {
      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level,
        message,
        data: level === 'security' ? data : this.sanitizeContext(data || {}),
        pid: process.pid,
        memory: process.memoryUsage()
      };

      const logFile = path.join(logDir, `${level}-${new Date().toISOString().split('T')[0]}.log`);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      fs.appendFileSync(logFile, logLine);
    } catch (fileError) {
      // 파일 저장 실패 시 콘솔에만 출력 (무한 루프 방지)
      console.error('Log file write failed:', fileError);
    }
  }
  /**
   * 개발 모드에서만 로그 출력
   */
  static dev(message: string, ...args: any[]) {
    if (isDevelopment) {
      console.log(`[DEV] ${message}`, ...args);
    }
  }

  /**
   * 개발 모드에서만 경고 출력
   */
  static warn(message: string, ...args: any[]) {
    if (isDevelopment) {
      console.warn(`[DEV] ${message}`, ...args);
    }
  }

  /**
   * 에러는 항상 로그하되, 민감 정보 제거
   */
  static error(message: string, error?: any, context?: Record<string, any>) {
    const errorData = { error, context };
    
    if (isDevelopment) {
      console.error(`[ERROR] ${message}`, error, context);
    } else {
      // 프로덕션에서는 민감 정보 제거
      const sanitizedError = error ? {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n')[0] // 스택트레이스 첫 줄만
      } : undefined;
      
      const sanitizedContext = context ? 
        this.sanitizeContext(context) : undefined;
      
      console.error(`[ERROR] ${message}`, sanitizedError, sanitizedContext);
    }
    
    // 파일에 저장
    this.writeToFile('error', message, errorData);
  }

  /**
   * 프로덕션에서도 필요한 중요 정보 (민감 정보 제외)
   */
  static info(message: string, data?: Record<string, any>) {
    if (isDevelopment) {
      console.log(`[INFO] ${message}`, data);
    } else {
      // 프로덕션에서는 민감 정보 제거한 기본 정보만
      const sanitizedData = data ? this.sanitizeContext(data) : undefined;
      console.log(`[INFO] ${message}`, sanitizedData);
    }
  }

  /**
   * 민감 정보 제거
   */
  private static sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sensitiveKeys = [
      'email', 'password', 'token', 'key', 'secret', 'auth',
      'user_id', 'userId', 'metadata', 'personalData'
    ];

    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(context)) {
      const keyLower = key.toLowerCase();
      
      if (sensitiveKeys.some(sensitive => keyLower.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeContext(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * 토큰 사용량 등 중요 비즈니스 메트릭 (개발 모드에서만)
   */
  static metrics(message: string, data?: Record<string, any>) {
    if (isDevelopment) {
      console.log(`[METRICS] ${message}`, data);
    }
  }

  /**
   * 사용자 관련 로그 (개발 모드에서만)
   */
  static user(message: string, userInfo?: Record<string, any>) {
    if (isDevelopment && userInfo) {
      console.log(`[USER] ${message}`, {
        userId: userInfo.id || userInfo.userId,
        plan: userInfo.plan,
        // 이메일과 민감 정보는 제외
      });
    }
  }

  /**
   * 성능 측정용 로그
   */
  static performance(operation: string, duration: number, context?: Record<string, any>) {
    if (isDevelopment) {
      console.log(`[PERF] ${operation}: ${duration}ms`, context);
    } else {
      // 프로덕션에서는 성능 데이터만
      console.log(`[PERF] ${operation}: ${duration}ms`);
    }
  }

  /**
   * Lightning-Fast 최적화 로그 (개발 모드에서만)
   */
  static lightningFast(message: string) {
    if (isDevelopment) {
      console.log(message);
    }
  }

  /**
   * 보안 관련 로그 (프로덕션에서도 필요)
   */
  static security(message: string, ip?: string) {
    const logMessage = ip ? `🛡️ [Security] ${message} from ${ip}` : `🛡️ [Security] ${message}`;
    const securityData = { ip, message, timestamp: new Date().toISOString() };
    
    console.warn(logMessage);
    
    // 보안 로그는 프로덕션에서도 파일에 저장
    this.writeToFile('security', message, securityData);
  }

  /**
   * Elements 로딩 로그 (개발 모드에서만)
   */
  static elements(message: string, userId?: string) {
    if (isDevelopment) {
      const data = userId ? ` for user: ${userId}` : '';
      console.log(`${message}${data}`);
    }
  }
}

// 편의성을 위한 단축 함수들
export const devLog = SecureLogger.dev;
export const devWarn = SecureLogger.warn;
export const secureError = SecureLogger.error;
export const secureInfo = SecureLogger.info;