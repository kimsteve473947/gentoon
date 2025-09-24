/**
 * 네이버급 실시간 보안 모니터링 시스템
 * 실시간 위협 탐지, 메트릭 수집, 자동 알림
 */

interface SecurityEvent {
  id: string;
  timestamp: number;
  type: SecurityEventType;
  severity: SecuritySeverity;
  ip: string;
  path?: string;
  userAgent?: string;
  data: Record<string, any>;
  handled: boolean;
}

type SecurityEventType = 
  | 'RATE_LIMIT_EXCEEDED'
  | 'IP_BLOCKED'
  | 'MALICIOUS_PATTERN'
  | 'SUSPICIOUS_ACTIVITY'
  | 'BRUTE_FORCE_ATTEMPT'
  | 'DDoS_DETECTED'
  | 'ADMIN_ACCESS_ATTEMPT'
  | 'API_ABUSE'
  | 'SECURITY_BYPASS_ATTEMPT';

type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface SecurityMetrics {
  // 실시간 통계
  realTime: {
    requestsPerSecond: number;
    blockedRequestsPerSecond: number;
    uniqueIPs: number;
    activeThreats: number;
    systemLoad: number;
  };
  
  // 누적 통계 (최근 1시간)
  hourly: {
    totalRequests: number;
    blockedRequests: number;
    rateLimitViolations: number;
    ipBlockCount: number;
    maliciousPatternCount: number;
    topAttackerIPs: Array<{ ip: string; count: number; lastSeen: number }>;
    topTargetPaths: Array<{ path: string; count: number; severity: SecuritySeverity }>;
  };

  // 일일 통계
  daily: {
    totalRequests: number;
    blockedRequests: number;
    uniqueAttackers: number;
    securityIncidents: number;
    averageResponseTime: number;
  };

  // 시스템 상태
  system: {
    memoryUsage: number;
    rateLimiterRecords: number;
    ipProtectionRecords: number;
    lastCleanup: number;
    uptime: number;
  };
}

interface ThreatAlert {
  id: string;
  timestamp: number;
  title: string;
  description: string;
  severity: SecuritySeverity;
  ip: string;
  affectedEndpoints: string[];
  recommendedAction: string;
  autoHandled: boolean;
}

class SecurityMonitoringSystem {
  private events: SecurityEvent[] = [];
  private metrics: SecurityMetrics;
  private alerts: ThreatAlert[] = [];
  private subscribers: Array<(event: SecurityEvent) => void> = [];
  private metricsSubscribers: Array<(metrics: SecurityMetrics) => void> = [];
  
  // 실시간 카운터
  private realTimeCounters = {
    requests: 0,
    blockedRequests: 0,
    uniqueIPs: new Set<string>(),
    lastReset: Date.now()
  };

  constructor() {
    this.metrics = this.initializeMetrics();
    
    // 1초마다 실시간 메트릭 업데이트
    setInterval(() => {
      this.updateRealTimeMetrics();
    }, 1000);

    // 5분마다 과거 이벤트 정리
    setInterval(() => {
      this.cleanupOldEvents();
    }, 5 * 60 * 1000);

    // 10분마다 일일/주간 메트릭 집계
    setInterval(() => {
      this.aggregateMetrics();
    }, 10 * 60 * 1000);
  }

  /**
   * 보안 이벤트 기록
   */
  recordEvent(
    type: SecurityEventType,
    severity: SecuritySeverity,
    ip: string,
    data: Record<string, any>,
    path?: string,
    userAgent?: string
  ): void {
    const event: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type,
      severity,
      ip,
      path,
      userAgent,
      data,
      handled: false
    };

    this.events.push(event);
    
    // 실시간 카운터 업데이트
    if (severity === 'HIGH' || severity === 'CRITICAL') {
      this.realTimeCounters.blockedRequests++;
    }
    this.realTimeCounters.requests++;
    this.realTimeCounters.uniqueIPs.add(ip);

    // 구독자들에게 알림
    this.notifySubscribers(event);

    // 자동 위협 분석 및 대응
    this.analyzeThreat(event);

    // 메트릭 업데이트
    this.updateMetricsFromEvent(event);

    console.log(`🚨 [SecurityMonitor] ${type} - ${severity} from ${ip}${path ? ` (${path})` : ''}`);

    // 알림 시스템에 이벤트 전송
    this.sendToAlertSystem(event);
  }

  /**
   * 위협 자동 분석 및 대응
   */
  private analyzeThreat(event: SecurityEvent): void {
    const now = Date.now();
    const recentEvents = this.events.filter(e => 
      e.ip === event.ip && 
      (now - e.timestamp) < 5 * 60 * 1000 // 최근 5분
    );

    // DDoS 공격 탐지
    if (recentEvents.length >= 50) {
      this.createAlert(
        'DDoS 공격 의심',
        `IP ${event.ip}에서 5분간 ${recentEvents.length}회 요청 탐지`,
        'CRITICAL',
        event.ip,
        [event.path || '/unknown'],
        'IP 자동 차단 권장'
      );
    }

    // 브루트 포스 공격 탐지
    const authEvents = recentEvents.filter(e => 
      e.type === 'RATE_LIMIT_EXCEEDED' && 
      (e.path?.includes('/auth') || e.path?.includes('/login'))
    );
    
    if (authEvents.length >= 10) {
      this.createAlert(
        '브루트 포스 공격 탐지',
        `IP ${event.ip}에서 인증 엔드포인트에 대한 반복 공격 탐지`,
        'HIGH',
        event.ip,
        authEvents.map(e => e.path || '').filter(Boolean),
        '계정 잠금 및 IP 차단 권장'
      );
    }

    // 관리자 페이지 접근 시도
    if (event.path?.includes('/admin') && event.severity === 'HIGH') {
      this.createAlert(
        '관리자 페이지 무단 접근 시도',
        `IP ${event.ip}에서 관리자 페이지 접근 시도`,
        'HIGH',
        event.ip,
        [event.path],
        'IP 차단 및 관리자 알림'
      );
    }
  }

  /**
   * 알림 생성
   */
  private createAlert(
    title: string,
    description: string,
    severity: SecuritySeverity,
    ip: string,
    endpoints: string[],
    recommendation: string,
    autoHandled: boolean = false
  ): void {
    const alert: ThreatAlert = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      title,
      description,
      severity,
      ip,
      affectedEndpoints: endpoints,
      recommendedAction: recommendation,
      autoHandled
    };

    this.alerts.push(alert);

    // 중요한 알림은 즉시 로그 출력
    if (severity === 'HIGH' || severity === 'CRITICAL') {
      console.error(`🔥 [SECURITY ALERT] ${title}: ${description}`);
    }

    // 실제 서비스에서는 여기서 Slack, 이메일, SMS 등으로 알림 전송
    // await this.sendExternalAlert(alert);
  }

  /**
   * 실시간 메트릭 업데이트
   */
  private updateRealTimeMetrics(): void {
    const now = Date.now();
    const timeDiff = (now - this.realTimeCounters.lastReset) / 1000;

    this.metrics.realTime = {
      requestsPerSecond: Math.round(this.realTimeCounters.requests / timeDiff),
      blockedRequestsPerSecond: Math.round(this.realTimeCounters.blockedRequests / timeDiff),
      uniqueIPs: this.realTimeCounters.uniqueIPs.size,
      activeThreats: this.getActiveThreatsCount(),
      systemLoad: this.getSystemLoad()
    };

    // 1분마다 카운터 리셋
    if (timeDiff >= 60) {
      this.realTimeCounters.requests = 0;
      this.realTimeCounters.blockedRequests = 0;
      this.realTimeCounters.uniqueIPs.clear();
      this.realTimeCounters.lastReset = now;
    }

    // 메트릭 구독자들에게 알림
    this.metricsSubscribers.forEach(callback => {
      try {
        callback(this.metrics);
      } catch (error) {
        console.error('메트릭 구독자 알림 오류:', error);
      }
    });
  }

  /**
   * 현재 활성 위협 수 계산
   */
  private getActiveThreatsCount(): number {
    const now = Date.now();
    const recentAlerts = this.alerts.filter(alert => 
      (now - alert.timestamp) < 30 * 60 * 1000 && // 최근 30분
      (alert.severity === 'HIGH' || alert.severity === 'CRITICAL')
    );
    return recentAlerts.length;
  }

  /**
   * 시스템 로드 계산
   */
  private getSystemLoad(): number {
    // 간단한 로드 계산 (실제로는 CPU, 메모리 사용량 등 고려)
    const eventCount = this.events.length;
    const alertCount = this.alerts.length;
    
    if (eventCount > 1000 || alertCount > 10) return 3; // HIGH
    if (eventCount > 500 || alertCount > 5) return 2;   // MEDIUM
    if (eventCount > 100 || alertCount > 0) return 1;   // LOW
    return 0; // NORMAL
  }

  /**
   * 이벤트로부터 메트릭 업데이트
   */
  private updateMetricsFromEvent(event: SecurityEvent): void {
    this.metrics.hourly.totalRequests++;
    
    if (event.severity === 'HIGH' || event.severity === 'CRITICAL') {
      this.metrics.hourly.blockedRequests++;
    }

    // 이벤트 타입별 통계 업데이트
    switch (event.type) {
      case 'RATE_LIMIT_EXCEEDED':
        this.metrics.hourly.rateLimitViolations++;
        break;
      case 'IP_BLOCKED':
        this.metrics.hourly.ipBlockCount++;
        break;
      case 'MALICIOUS_PATTERN':
        this.metrics.hourly.maliciousPatternCount++;
        break;
    }

    // Top Attacker IPs 업데이트
    this.updateTopAttackerIPs(event.ip);
    
    // Top Target Paths 업데이트
    if (event.path) {
      this.updateTopTargetPaths(event.path, event.severity);
    }
  }

  /**
   * Top Attacker IPs 업데이트
   */
  private updateTopAttackerIPs(ip: string): void {
    const existing = this.metrics.hourly.topAttackerIPs.find(item => item.ip === ip);
    if (existing) {
      existing.count++;
      existing.lastSeen = Date.now();
    } else {
      this.metrics.hourly.topAttackerIPs.push({
        ip,
        count: 1,
        lastSeen: Date.now()
      });
    }

    // Top 10만 유지
    this.metrics.hourly.topAttackerIPs.sort((a, b) => b.count - a.count);
    this.metrics.hourly.topAttackerIPs = this.metrics.hourly.topAttackerIPs.slice(0, 10);
  }

  /**
   * Top Target Paths 업데이트
   */
  private updateTopTargetPaths(path: string, severity: SecuritySeverity): void {
    const existing = this.metrics.hourly.topTargetPaths.find(item => item.path === path);
    if (existing) {
      existing.count++;
      // 더 높은 심각도로 업데이트
      if (this.getSeverityLevel(severity) > this.getSeverityLevel(existing.severity)) {
        existing.severity = severity;
      }
    } else {
      this.metrics.hourly.topTargetPaths.push({
        path,
        count: 1,
        severity
      });
    }

    // Top 10만 유지
    this.metrics.hourly.topTargetPaths.sort((a, b) => b.count - a.count);
    this.metrics.hourly.topTargetPaths = this.metrics.hourly.topTargetPaths.slice(0, 10);
  }

  /**
   * 심각도 레벨 변환
   */
  private getSeverityLevel(severity: SecuritySeverity): number {
    switch (severity) {
      case 'LOW': return 1;
      case 'MEDIUM': return 2;
      case 'HIGH': return 3;
      case 'CRITICAL': return 4;
      default: return 0;
    }
  }

  /**
   * 오래된 이벤트 정리
   */
  private cleanupOldEvents(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24시간
    
    const beforeCount = this.events.length;
    this.events = this.events.filter(event => (now - event.timestamp) < maxAge);
    const afterCount = this.events.length;
    
    // 알림도 정리 (7일)
    const alertMaxAge = 7 * 24 * 60 * 60 * 1000;
    this.alerts = this.alerts.filter(alert => (now - alert.timestamp) < alertMaxAge);

    if (beforeCount > afterCount) {
      console.log(`🧹 [SecurityMonitor] 이벤트 정리: ${beforeCount - afterCount}개 제거`);
    }
  }

  /**
   * 메트릭 집계
   */
  private aggregateMetrics(): void {
    // 시스템 메트릭 업데이트
    this.metrics.system = {
      memoryUsage: this.getMemoryUsage(),
      rateLimiterRecords: this.getRateLimiterRecordCount(),
      ipProtectionRecords: this.getIPProtectionRecordCount(),
      lastCleanup: Date.now(),
      uptime: process.uptime ? process.uptime() * 1000 : 0
    };
  }

  /**
   * 메트릭 초기화
   */
  private initializeMetrics(): SecurityMetrics {
    return {
      realTime: {
        requestsPerSecond: 0,
        blockedRequestsPerSecond: 0,
        uniqueIPs: 0,
        activeThreats: 0,
        systemLoad: 0
      },
      hourly: {
        totalRequests: 0,
        blockedRequests: 0,
        rateLimitViolations: 0,
        ipBlockCount: 0,
        maliciousPatternCount: 0,
        topAttackerIPs: [],
        topTargetPaths: []
      },
      daily: {
        totalRequests: 0,
        blockedRequests: 0,
        uniqueAttackers: 0,
        securityIncidents: 0,
        averageResponseTime: 0
      },
      system: {
        memoryUsage: 0,
        rateLimiterRecords: 0,
        ipProtectionRecords: 0,
        lastCleanup: Date.now(),
        uptime: 0
      }
    };
  }

  // ===== 공개 API =====

  /**
   * 현재 메트릭 조회
   */
  getMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  /**
   * 최근 보안 이벤트 조회
   */
  getRecentEvents(limit: number = 100): SecurityEvent[] {
    return this.events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * 활성 알림 조회
   */
  getActiveAlerts(): ThreatAlert[] {
    const now = Date.now();
    return this.alerts
      .filter(alert => (now - alert.timestamp) < 24 * 60 * 60 * 1000) // 24시간 이내
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 이벤트 구독
   */
  subscribe(callback: (event: SecurityEvent) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * 메트릭 구독
   */
  subscribeToMetrics(callback: (metrics: SecurityMetrics) => void): () => void {
    this.metricsSubscribers.push(callback);
    return () => {
      const index = this.metricsSubscribers.indexOf(callback);
      if (index > -1) {
        this.metricsSubscribers.splice(index, 1);
      }
    };
  }

  // ===== 유틸리티 메소드 =====

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private notifySubscribers(event: SecurityEvent): void {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('이벤트 구독자 알림 오류:', error);
      }
    });
  }

  private getMemoryUsage(): number {
    return JSON.stringify(this.events).length + JSON.stringify(this.alerts).length;
  }

  /**
   * 알림 시스템에 이벤트 전송
   */
  private sendToAlertSystem(event: SecurityEvent): void {
    try {
      const { alertSystem } = require('./alert-system');
      alertSystem.processSecurityEvent(
        event.type,
        event.severity,
        event.ip,
        event.data,
        event.path,
        event.userAgent
      );
    } catch (error) {
      // 알림 시스템 오류가 모니터링에 영향주지 않도록
      console.debug('알림 시스템 연동 오류:', error);
    }
  }

  private getRateLimiterRecordCount(): number {
    // rateLimiter에서 가져오기 (실제 구현에서는 rateLimiter.getStats() 사용)
    return 0;
  }

  private getIPProtectionRecordCount(): number {
    // ipProtection에서 가져오기 (실제 구현에서는 ipProtection.getStats() 사용)
    return 0;
  }
}

// 싱글톤 인스턴스
export const securityMonitor = new SecurityMonitoringSystem();

// 타입 내보내기
export type { SecurityEvent, SecurityEventType, SecuritySeverity, SecurityMetrics, ThreatAlert };