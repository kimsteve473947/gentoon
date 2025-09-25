/**
 * 네이버급 IP 보호 시스템
 * 지역 필터링, 프록시 탐지, 패턴 분석
 */

interface IPRecord {
  ip: string;
  country?: string;
  region?: string;
  isProxy?: boolean;
  isVPN?: boolean;
  riskScore: number;
  requestCount: number;
  firstSeen: number;
  lastSeen: number;
  blocked: boolean;
  blockReason?: string;
  blockUntil?: number;
  suspiciousPatterns: string[];
}

interface SuspiciousPattern {
  type: 'RAPID_REQUESTS' | 'USER_AGENT_ROTATION' | 'PATH_TRAVERSAL' | 'SQL_INJECTION' | 'SCANNER' | 'BRUTE_FORCE';
  severity: number; // 1-10
  description: string;
}

export class IPProtectionSystem {
  private ipRecords = new Map<string, IPRecord>();
  private cleanupInterval: NodeJS.Timeout;
  
  // 한국 허용 IP 범위 (주요 ISP)
  private readonly KOREA_IP_RANGES = [
    '1.0.0.0/8',        // KT
    '14.0.0.0/8',       // KT  
    '27.0.0.0/8',       // KT
    '39.7.0.0/16',      // LG U+
    '58.0.0.0/8',       // SK Telecom
    '61.0.0.0/8',       // 한국 통신사 공통
    '106.0.0.0/8',      // SK Telecom
    '112.0.0.0/8',      // KT
    '118.0.0.0/8',      // SK/KT 공통
    '121.0.0.0/8',      // LG U+
    '175.0.0.0/8',      // 한국 ISP
    '203.0.0.0/8'       // 아시아 태평양 (한국 포함)
  ];

  // 의심스러운 User-Agent 패턴
  private readonly SUSPICIOUS_USER_AGENTS = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /curl/i, /wget/i, /python/i, /php/i,
    /scanner/i, /test/i, /monitor/i
  ];

  // 의심스러운 경로 패턴
  private readonly SUSPICIOUS_PATHS = [
    /\/admin/i, /\/config/i, /\/env/i, /\/backup/i,
    /\.env/i, /\.config/i, /\.git/i, /\/api\/admin/i,
    /sql/i, /union/i, /select/i, /drop/i, /insert/i,
    /%27/i, /%22/i, /%3C/i, /%3E/i // URL 인코딩된 특수문자
  ];

  constructor() {
    // 5분마다 정리 작업
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * IP 검사 및 위험도 평가
   */
  async analyzeIP(
    ip: string, 
    userAgent?: string, 
    path?: string,
    method?: string
  ): Promise<{
    allowed: boolean;
    riskScore: number;
    reason?: string;
    blockUntil?: number;
    patterns: string[];
  }> {
    // 로컬/개발 환경 예외
    if (this.isLocalIP(ip)) {
      return { allowed: true, riskScore: 0, patterns: [] };
    }

    let record = this.ipRecords.get(ip);
    const now = Date.now();

    // 새로운 IP 레코드 생성
    if (!record) {
      record = {
        ip,
        riskScore: 0,
        requestCount: 0,
        firstSeen: now,
        lastSeen: now,
        blocked: false,
        suspiciousPatterns: []
      };
    }

    // 기본 정보 업데이트
    record.lastSeen = now;
    record.requestCount++;

    // 차단 상태 확인
    if (record.blocked && record.blockUntil && now < record.blockUntil) {
      return {
        allowed: false,
        riskScore: record.riskScore,
        reason: record.blockReason,
        blockUntil: record.blockUntil,
        patterns: record.suspiciousPatterns
      };
    }

    // 차단 해제
    if (record.blocked && record.blockUntil && now >= record.blockUntil) {
      record.blocked = false;
      record.blockReason = undefined;
      record.blockUntil = undefined;
      record.riskScore = Math.max(0, record.riskScore - 2); // 위험도 감소
    }

    // 위험도 분석
    const patterns = await this.analyzePatterns(record, userAgent, path, method);
    record.suspiciousPatterns = [...new Set([...record.suspiciousPatterns, ...patterns])];

    // 위험도 계산
    const newRiskScore = this.calculateRiskScore(record, patterns);
    record.riskScore = newRiskScore;

    // 자동 차단 결정 (임계값 대폭 완화)
    if (newRiskScore >= 15) {  // 8 → 15로 완화
      record.blocked = true;
      record.blockReason = '고위험 활동 탐지';
      record.blockUntil = now + (1 * 60 * 60 * 1000); // 24시간 → 1시간으로 완화
      
      this.logSecurityEvent('AUTO_BLOCK_HIGH_RISK', {
        ip,
        riskScore: newRiskScore,
        patterns,
        reason: record.blockReason
      });
    } else if (newRiskScore >= 12) { // 6 → 12로 완화
      record.blocked = true;
      record.blockReason = '의심스러운 활동 패턴';
      record.blockUntil = now + (10 * 60 * 1000); // 2시간 → 10분으로 완화

      this.logSecurityEvent('AUTO_BLOCK_SUSPICIOUS', {
        ip,
        riskScore: newRiskScore,
        patterns
      });
    }

    this.ipRecords.set(ip, record);

    return {
      allowed: !record.blocked,
      riskScore: record.riskScore,
      reason: record.blockReason,
      blockUntil: record.blockUntil,
      patterns: record.suspiciousPatterns
    };
  }

  /**
   * 의심스러운 패턴 분석
   */
  private async analyzePatterns(
    record: IPRecord,
    userAgent?: string,
    path?: string,
    method?: string
  ): Promise<string[]> {
    const patterns: string[] = [];
    const now = Date.now();

    // 1. 급속 요청 패턴 (1분에 30회 이상)
    if (record.requestCount > 30 && (now - record.firstSeen) < 60000) {
      patterns.push('RAPID_REQUESTS');
    }

    // 2. 의심스러운 User-Agent
    if (userAgent) {
      for (const pattern of this.SUSPICIOUS_USER_AGENTS) {
        if (pattern.test(userAgent)) {
          patterns.push('SUSPICIOUS_USER_AGENT');
          break;
        }
      }

      // 빈 또는 비정상적인 User-Agent
      if (!userAgent.trim() || userAgent.length < 10) {
        patterns.push('INVALID_USER_AGENT');
      }
    }

    // 3. 의심스러운 경로 접근
    if (path) {
      for (const pattern of this.SUSPICIOUS_PATHS) {
        if (pattern.test(path)) {
          patterns.push('SUSPICIOUS_PATH');
          break;
        }
      }
    }

    // 4. 지역 기반 필터링 (한국 외 지역 - 옵션)
    if (record.country && record.country !== 'KR') {
      // 개발 환경에서는 비활성화
      if (process.env.NODE_ENV === 'production' && process.env.ENABLE_GEO_FILTER === 'true') {
        patterns.push('NON_KOREA_ACCESS');
      }
    }

    // 5. 프록시/VPN 탐지 (기본 패턴)
    if (this.detectProxyPattern(record.ip)) {
      patterns.push('PROXY_VPN_DETECTED');
    }

    return patterns;
  }

  /**
   * 위험도 점수 계산
   */
  private calculateRiskScore(record: IPRecord, newPatterns: string[]): number {
    let score = record.riskScore;

    // 패턴별 점수 증가 (대폭 완화)
    for (const pattern of newPatterns) {
      switch (pattern) {
        case 'RAPID_REQUESTS':
          score += 1; // 3 → 1
          break;
        case 'SUSPICIOUS_USER_AGENT':
          score += 1; // 4 → 1
          break;
        case 'SUSPICIOUS_PATH':
          score += 2; // 5 → 2
          break;
        case 'PROXY_VPN_DETECTED':
          score += 1; // 3 → 1
          break;
        case 'NON_KOREA_ACCESS':
          score += 0; // 2 → 0 (완전 허용)
          break;
        case 'INVALID_USER_AGENT':
          score += 0; // 2 → 0 (완전 허용)
          break;
        default:
          score += 0; // 1 → 0
      }
    }

    // 요청 빈도 기반 점수 증가 (대폭 완화)
    const requestsPerHour = record.requestCount / ((Date.now() - record.firstSeen) / (60 * 60 * 1000));
    if (requestsPerHour > 500) score += 1; // 100 → 500으로 완화
    if (requestsPerHour > 1000) score += 2; // 200 → 1000으로 완화

    // 최대 점수 제한
    return Math.min(10, Math.max(0, score));
  }

  /**
   * 프록시/VPN 패턴 탐지 (기본)
   */
  private detectProxyPattern(ip: string): boolean {
    // 알려진 프록시 IP 범위 (예시)
    const proxyRanges = [
      '10.0.0.0/8',     // 사설망
      '172.16.0.0/12',  // 사설망
      '192.168.0.0/16', // 사설망
      // 실제 서비스에서는 프록시 DB 사용
    ];

    return false; // 기본적으로 false, 실제 구현 시 프록시 DB 연동
  }

  /**
   * 로컬 IP 확인
   */
  private isLocalIP(ip: string): boolean {
    return ip === '127.0.0.1' || 
           ip === '::1' || 
           ip.startsWith('192.168.') ||
           ip.startsWith('10.') ||
           ip.startsWith('172.16.') ||
           ip === 'localhost';
  }

  /**
   * 수동 IP 차단
   */
  blockIP(ip: string, reason: string, durationMs: number): void {
    const now = Date.now();
    let record = this.ipRecords.get(ip) || {
      ip,
      riskScore: 10,
      requestCount: 0,
      firstSeen: now,
      lastSeen: now,
      blocked: false,
      suspiciousPatterns: []
    };

    record.blocked = true;
    record.blockReason = reason;
    record.blockUntil = now + durationMs;
    record.riskScore = 10;

    this.ipRecords.set(ip, record);

    this.logSecurityEvent('MANUAL_IP_BLOCK', {
      ip,
      reason,
      duration: durationMs
    });
  }

  /**
   * IP 차단 해제
   */
  unblockIP(ip: string): void {
    const record = this.ipRecords.get(ip);
    if (record) {
      record.blocked = false;
      record.blockReason = undefined;
      record.blockUntil = undefined;
      record.riskScore = Math.max(0, record.riskScore - 5);
      
      this.ipRecords.set(ip, record);
      
      this.logSecurityEvent('MANUAL_IP_UNBLOCK', { ip });
    }
  }

  /**
   * 통계 조회
   */
  getStats(): {
    totalIPs: number;
    blockedIPs: number;
    highRiskIPs: number;
    memoryUsage: number;
  } {
    const records = Array.from(this.ipRecords.values());
    
    return {
      totalIPs: records.length,
      blockedIPs: records.filter(r => r.blocked).length,
      highRiskIPs: records.filter(r => r.riskScore >= 7).length,
      memoryUsage: JSON.stringify(Array.from(this.ipRecords.entries())).length
    };
  }

  /**
   * 메모리 정리
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [ip, record] of this.ipRecords.entries()) {
      // 24시간 이상 비활성 & 차단되지 않은 레코드 삭제
      const inactive = (now - record.lastSeen) > (24 * 60 * 60 * 1000);
      const notBlocked = !record.blocked;
      const lowRisk = record.riskScore < 3;

      if (inactive && notBlocked && lowRisk) {
        this.ipRecords.delete(ip);
        cleaned++;
      }

      // 차단 해제된 레코드의 패턴 정리
      if (!record.blocked && record.suspiciousPatterns.length > 0) {
        record.suspiciousPatterns = record.suspiciousPatterns.slice(-3); // 최근 3개만 보관
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 [IPProtection] 메모리 정리: ${cleaned}개 IP 레코드 삭제`);
    }
  }

  /**
   * 보안 이벤트 로그
   */
  private logSecurityEvent(event: string, data: any): void {
    console.warn(`🚨 [IPProtection] ${event}:`, {
      timestamp: new Date().toISOString(),
      ...data
    });

    // 실시간 모니터링 시스템에 이벤트 전송
    try {
      const { securityMonitor } = require('./security-monitor');
      
      let eventType: any = 'SUSPICIOUS_ACTIVITY';
      let severity: any = 'MEDIUM';

      // 이벤트 타입에 따른 분류
      if (event.includes('BLOCK')) {
        eventType = 'IP_BLOCKED';
        severity = 'HIGH';
      } else if (event.includes('MALICIOUS')) {
        eventType = 'MALICIOUS_PATTERN';
        severity = 'HIGH';
      } else if (event.includes('PROXY')) {
        eventType = 'SUSPICIOUS_ACTIVITY';
        severity = 'MEDIUM';
      }

      securityMonitor.recordEvent(
        eventType,
        severity,
        data.ip || 'unknown',
        data,
        data.path,
        data.userAgent
      );
    } catch (error) {
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
    this.ipRecords.clear();
  }
}

// 싱글톤 인스턴스
export const ipProtection = new IPProtectionSystem();

// Edge Runtime에서는 process.on이 지원되지 않음
// 프로덕션 환경에서는 서버 종료 시 자동으로 메모리 해제됨