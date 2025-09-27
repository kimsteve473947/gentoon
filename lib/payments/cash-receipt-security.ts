// 현금영수증 시스템 보안 강화 모듈

import crypto from 'crypto';

// 보안 설정
export const SECURITY_CONFIG = {
  // API 호출 제한 (분당 호출 수)
  RATE_LIMIT_PER_MINUTE: 60,
  
  // 재시도 설정
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
  
  // 타임아웃 설정
  API_TIMEOUT_MS: 30000,
  
  // 개인정보 보호
  PERSONAL_DATA_ENCRYPTION: true,
  LOG_SENSITIVE_DATA: false,
  
  // 검증 설정
  VALIDATE_SSL_CERTIFICATES: true,
  REQUIRE_HTTPS: true
};

// Rate Limiting 클래스
export class CashReceiptRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs = 60000; // 1분
  
  isAllowed(userId: string): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    
    // 1분 이전 요청들 제거
    const recentRequests = userRequests.filter(time => now - time < this.windowMs);
    
    if (recentRequests.length >= SECURITY_CONFIG.RATE_LIMIT_PER_MINUTE) {
      return false;
    }
    
    recentRequests.push(now);
    this.requests.set(userId, recentRequests);
    return true;
  }
  
  getRemainingRequests(userId: string): number {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    const recentRequests = userRequests.filter(time => now - time < this.windowMs);
    
    return Math.max(0, SECURITY_CONFIG.RATE_LIMIT_PER_MINUTE - recentRequests.length);
  }
}

// 현금영수증 데이터 암호화 (선택적)
export class CashReceiptDataSecurity {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  
  constructor(private secretKey: string) {
    if (!secretKey || secretKey.length < 32) {
      throw new Error('Secret key must be at least 32 characters long');
    }
  }
  
  /**
   * 현금영수증 식별자 암호화 (데이터베이스 저장용)
   */
  encryptCashReceiptKey(data: string): { encrypted: string; iv: string; tag: string } {
    if (!SECURITY_CONFIG.PERSONAL_DATA_ENCRYPTION) {
      return { encrypted: data, iv: '', tag: '' };
    }
    
    const key = crypto.scryptSync(this.secretKey, 'salt', this.keyLength);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipherGCM(this.algorithm, key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }
  
  /**
   * 현금영수증 식별자 복호화
   */
  decryptCashReceiptKey(encrypted: string, iv: string, tag: string): string {
    if (!SECURITY_CONFIG.PERSONAL_DATA_ENCRYPTION || !iv || !tag) {
      return encrypted;
    }
    
    const key = crypto.scryptSync(this.secretKey, 'salt', this.keyLength);
    const decipher = crypto.createDecipherGCM(this.algorithm, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  /**
   * 데이터 해시 생성 (무결성 검증용)
   */
  generateDataHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * 데이터 해시 검증
   */
  verifyDataHash(data: string, hash: string): boolean {
    const computedHash = this.generateDataHash(data);
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash));
  }
}

// 보안 로깅 유틸리티
export class SecureLogger {
  /**
   * 민감한 데이터를 안전하게 로깅
   */
  static logSafely(message: string, data: any, options: { 
    level?: 'info' | 'warn' | 'error';
    maskPersonalData?: boolean;
    includeStack?: boolean;
  } = {}) {
    const { level = 'info', maskPersonalData = true, includeStack = false } = options;
    
    let safeData = data;
    
    if (maskPersonalData && data) {
      safeData = this.maskSensitiveData(data);
    }
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      message,
      data: safeData,
      ...(includeStack && { stack: new Error().stack })
    };
    
    console[level](`🔒 [SECURE] ${message}`, logEntry);
  }
  
  /**
   * 민감한 데이터 마스킹
   */
  private static maskSensitiveData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }
    
    const sensitiveKeys = [
      'cashReceiptKey', 'customerName', 'identityNum', 'apiKey',
      'phone', 'phoneNumber', 'businessNumber', 'cardNumber',
      'password', 'token', 'secret', 'authorization'
    ];
    
    const masked = { ...data };
    
    for (const key in masked) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive.toLowerCase()))) {
        if (typeof masked[key] === 'string' && masked[key].length > 0) {
          masked[key] = masked[key].substring(0, 2) + '***';
        }
      } else if (typeof masked[key] === 'object') {
        masked[key] = this.maskSensitiveData(masked[key]);
      }
    }
    
    return masked;
  }
}

// API 요청 보안 검증
export class ApiSecurityValidator {
  /**
   * 요청 유효성 검사
   */
  static validateRequest(request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // HTTPS 필수 검증
    if (SECURITY_CONFIG.REQUIRE_HTTPS && !request.url.startsWith('https://')) {
      errors.push('HTTPS is required for all API requests');
    }
    
    // Authorization 헤더 검증
    if (!request.headers.authorization || !request.headers.authorization.startsWith('Basic ')) {
      errors.push('Valid Basic Authorization header is required');
    }
    
    // Content-Type 검증
    if (request.method === 'POST' && request.headers['content-type'] !== 'application/json') {
      errors.push('Content-Type must be application/json for POST requests');
    }
    
    // User-Agent 검증 (봇 차단)
    const userAgent = request.headers['user-agent'] || '';
    if (!userAgent.includes('GenToon-CashReceipt-System')) {
      errors.push('Valid User-Agent header is required');
    }
    
    // Body 크기 제한 (8KB)
    if (request.body && JSON.stringify(request.body).length > 8192) {
      errors.push('Request body exceeds 8KB limit');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * 응답 보안 검증
   */
  static validateResponse(response: {
    status: number;
    headers: Record<string, string>;
    body: any;
  }): { isSecure: boolean; warnings: string[] } {
    const warnings: string[] = [];
    
    // 보안 헤더 확인
    if (!response.headers['strict-transport-security']) {
      warnings.push('Missing Strict-Transport-Security header');
    }
    
    if (!response.headers['x-content-type-options']) {
      warnings.push('Missing X-Content-Type-Options header');
    }
    
    // 민감한 정보 노출 확인
    const bodyStr = JSON.stringify(response.body || {});
    if (bodyStr.includes('password') || bodyStr.includes('secret')) {
      warnings.push('Response may contain sensitive information');
    }
    
    return {
      isSecure: warnings.length === 0,
      warnings
    };
  }
}

// 현금영수증 데이터 검증
export class CashReceiptDataValidator {
  /**
   * 입력 데이터 사전 검증 (XSS, SQL Injection 방지)
   */
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }
    
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // XSS 방지
      .replace(/[<>'"&]/g, '') // HTML 태그 제거
      .replace(/[\x00-\x1f\x7f]/g, '') // 제어 문자 제거
      .trim()
      .substring(0, 1000); // 길이 제한
  }
  
  /**
   * 현금영수증 키 안전성 검증
   */
  static validateKeysSafety(keys: string[]): { isSafe: boolean; issues: string[] } {
    const issues: string[] = [];
    
    for (const key of keys) {
      // 길이 검증
      if (key.length < 3 || key.length > 20) {
        issues.push(`Invalid key length: ${key.length}`);
      }
      
      // 패턴 검증 (숫자와 하이픈만 허용)
      if (!/^[\d-]+$/.test(key)) {
        issues.push('Key contains invalid characters');
      }
      
      // 연속된 같은 숫자 방지 (예: 1111111111)
      if (/(.)\1{6,}/.test(key.replace(/-/g, ''))) {
        issues.push('Key contains too many consecutive identical digits');
      }
    }
    
    return {
      isSafe: issues.length === 0,
      issues
    };
  }
}

// 글로벌 인스턴스
export const cashReceiptRateLimiter = new CashReceiptRateLimiter();

// 환경변수 기반 보안 설정
if (process.env.CASH_RECEIPT_ENCRYPTION_KEY) {
  export const cashReceiptDataSecurity = new CashReceiptDataSecurity(
    process.env.CASH_RECEIPT_ENCRYPTION_KEY
  );
}