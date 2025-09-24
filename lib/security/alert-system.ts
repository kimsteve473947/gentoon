/**
 * 네이버급 실시간 알림 시스템
 * Slack, 이메일, 웹훅 등 다양한 채널로 보안 알림 전송
 */

interface AlertChannel {
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  send: (alert: SecurityAlert) => Promise<boolean>;
}

interface SecurityAlert {
  id: string;
  timestamp: number;
  title: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'SECURITY' | 'PERFORMANCE' | 'SYSTEM';
  data: Record<string, any>;
  source: string;
  ip?: string;
  userAgent?: string;
  path?: string;
}

interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: AlertCondition[];
  channels: string[];
  cooldown: number; // 쿨다운 시간 (분)
  lastTriggered?: number;
}

interface AlertCondition {
  field: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'contains' | 'regex';
  value: any;
}

class AlertSystem {
  private channels: Map<string, AlertChannel> = new Map();
  private rules: AlertRule[] = [];
  private alertHistory: SecurityAlert[] = [];
  private readonly maxHistorySize = 10000;

  constructor() {
    this.setupDefaultChannels();
    this.setupDefaultRules();
  }

  /**
   * 기본 알림 채널 설정
   */
  private setupDefaultChannels(): void {
    // 콘솔 로그 채널
    this.channels.set('console', {
      name: 'Console Log',
      enabled: true,
      config: {},
      send: async (alert: SecurityAlert) => {
        const emoji = this.getSeverityEmoji(alert.severity);
        const timestamp = new Date(alert.timestamp).toISOString();
        
        console.log(`${emoji} [ALERT] ${alert.title}`);
        console.log(`├─ Severity: ${alert.severity}`);
        console.log(`├─ Time: ${timestamp}`);
        console.log(`├─ Source: ${alert.source}`);
        if (alert.ip) console.log(`├─ IP: ${alert.ip}`);
        if (alert.path) console.log(`├─ Path: ${alert.path}`);
        console.log(`└─ Message: ${alert.message}`);
        
        return true;
      }
    });

    // 웹훅 채널 (Slack, Discord 등)
    this.channels.set('webhook', {
      name: 'Webhook',
      enabled: process.env.SECURITY_WEBHOOK_URL ? true : false,
      config: {
        url: process.env.SECURITY_WEBHOOK_URL,
        timeout: 5000
      },
      send: async (alert: SecurityAlert) => {
        const config = this.channels.get('webhook')?.config;
        if (!config?.url) return false;

        try {
          const payload = {
            text: `🚨 Security Alert: ${alert.title}`,
            attachments: [{
              color: this.getSeverityColor(alert.severity),
              fields: [
                { title: 'Severity', value: alert.severity, short: true },
                { title: 'Source', value: alert.source, short: true },
                { title: 'Time', value: new Date(alert.timestamp).toISOString(), short: false },
                { title: 'Message', value: alert.message, short: false },
                ...(alert.ip ? [{ title: 'IP', value: alert.ip, short: true }] : []),
                ...(alert.path ? [{ title: 'Path', value: alert.path, short: true }] : [])
              ]
            }]
          };

          const response = await fetch(config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(config.timeout)
          });

          return response.ok;
        } catch (error) {
          console.error('웹훅 알림 전송 실패:', error);
          return false;
        }
      }
    });

    // 이메일 채널 (실제 구현에서는 SendGrid, AWS SES 등 사용)
    this.channels.set('email', {
      name: 'Email',
      enabled: false, // 기본적으로 비활성화
      config: {
        to: process.env.ADMIN_EMAIL || 'admin@gentoon.io',
        from: 'security@gentoon.io'
      },
      send: async (alert: SecurityAlert) => {
        // 실제 구현에서는 이메일 서비스 연동
        console.log(`📧 [EMAIL] Would send alert to ${this.channels.get('email')?.config.to}`);
        return true;
      }
    });

    // 브라우저 알림 채널 (실시간 대시보드용)
    this.channels.set('browser', {
      name: 'Browser Notification',
      enabled: true,
      config: {},
      send: async (alert: SecurityAlert) => {
        // 실제 구현에서는 WebSocket이나 SSE로 브라우저에 실시간 전송
        // 현재는 로그만 출력
        console.log(`🔔 [BROWSER] Real-time alert: ${alert.title}`);
        return true;
      }
    });
  }

  /**
   * 기본 알림 규칙 설정
   */
  private setupDefaultRules(): void {
    this.rules = [
      {
        id: 'critical-security-events',
        name: 'Critical Security Events',
        enabled: true,
        conditions: [
          { field: 'severity', operator: 'eq', value: 'CRITICAL' }
        ],
        channels: ['console', 'webhook', 'browser'],
        cooldown: 1 // 1분 쿨다운
      },
      {
        id: 'high-severity-events',
        name: 'High Severity Events',
        enabled: true,
        conditions: [
          { field: 'severity', operator: 'eq', value: 'HIGH' }
        ],
        channels: ['console', 'webhook'],
        cooldown: 5 // 5분 쿨다운
      },
      {
        id: 'admin-access-attempts',
        name: 'Admin Access Attempts',
        enabled: true,
        conditions: [
          { field: 'category', operator: 'eq', value: 'SECURITY' },
          { field: 'path', operator: 'contains', value: '/admin' }
        ],
        channels: ['console', 'webhook', 'browser'],
        cooldown: 1
      },
      {
        id: 'rate-limit-violations',
        name: 'Multiple Rate Limit Violations',
        enabled: true,
        conditions: [
          { field: 'data.rateLimitViolations', operator: 'gt', value: 10 }
        ],
        channels: ['console'],
        cooldown: 15 // 15분 쿨다운
      },
      {
        id: 'system-overload',
        name: 'System Overload Detection',
        enabled: true,
        conditions: [
          { field: 'data.systemLoad', operator: 'gte', value: 3 }
        ],
        channels: ['console', 'webhook'],
        cooldown: 10
      }
    ];
  }

  /**
   * 알림 전송
   */
  async sendAlert(
    title: string,
    message: string,
    severity: SecurityAlert['severity'],
    category: SecurityAlert['category'] = 'SECURITY',
    data: Record<string, any> = {},
    source: string = 'SecuritySystem',
    ip?: string,
    userAgent?: string,
    path?: string
  ): Promise<void> {
    const alert: SecurityAlert = {
      id: this.generateAlertId(),
      timestamp: Date.now(),
      title,
      message,
      severity,
      category,
      data,
      source,
      ip,
      userAgent,
      path
    };

    // 알림 이력에 추가
    this.addToHistory(alert);

    // 매칭되는 규칙 찾기
    const matchingRules = this.findMatchingRules(alert);

    // 규칙별로 알림 전송
    for (const rule of matchingRules) {
      await this.processRuleAlert(rule, alert);
    }
  }

  /**
   * 보안 이벤트로부터 알림 생성
   */
  async processSecurityEvent(
    eventType: string,
    severity: SecurityAlert['severity'],
    ip: string,
    data: Record<string, any>,
    path?: string,
    userAgent?: string
  ): Promise<void> {
    const alertInfo = this.getAlertInfoFromEventType(eventType);
    
    await this.sendAlert(
      alertInfo.title,
      alertInfo.message,
      severity,
      'SECURITY',
      { ...data, eventType },
      'SecurityMonitor',
      ip,
      userAgent,
      path
    );
  }

  /**
   * 이벤트 타입별 알림 정보 생성
   */
  private getAlertInfoFromEventType(eventType: string): { title: string; message: string } {
    const alertMap: Record<string, { title: string; message: string }> = {
      RATE_LIMIT_EXCEEDED: {
        title: 'API Rate Limit Exceeded',
        message: 'API 요청 한도가 초과되어 자동 차단되었습니다.'
      },
      IP_BLOCKED: {
        title: 'IP Address Blocked',
        message: '의심스러운 활동으로 인해 IP가 자동 차단되었습니다.'
      },
      MALICIOUS_PATTERN: {
        title: 'Malicious Pattern Detected',
        message: '악성 패턴이 탐지되어 요청이 차단되었습니다.'
      },
      SUSPICIOUS_ACTIVITY: {
        title: 'Suspicious Activity Detected',
        message: '의심스러운 활동이 감지되었습니다.'
      },
      BRUTE_FORCE_ATTEMPT: {
        title: 'Brute Force Attack Detected',
        message: '브루트 포스 공격이 탐지되었습니다.'
      },
      DDoS_DETECTED: {
        title: 'DDoS Attack Detected',
        message: 'DDoS 공격이 감지되어 긴급 대응이 필요합니다.'
      },
      ADMIN_ACCESS_ATTEMPT: {
        title: 'Unauthorized Admin Access Attempt',
        message: '관리자 페이지에 무단 접근 시도가 감지되었습니다.'
      },
      API_ABUSE: {
        title: 'API Abuse Detected',
        message: 'API 남용 패턴이 탐지되었습니다.'
      },
      SECURITY_BYPASS_ATTEMPT: {
        title: 'Security Bypass Attempt',
        message: '보안 시스템 우회 시도가 감지되었습니다.'
      }
    };

    return alertMap[eventType] || {
      title: 'Security Event Detected',
      message: `보안 이벤트가 탐지되었습니다: ${eventType}`
    };
  }

  /**
   * 매칭되는 규칙 찾기
   */
  private findMatchingRules(alert: SecurityAlert): AlertRule[] {
    return this.rules.filter(rule => {
      if (!rule.enabled) return false;
      
      // 쿨다운 체크
      if (rule.lastTriggered && 
          (Date.now() - rule.lastTriggered) < (rule.cooldown * 60 * 1000)) {
        return false;
      }
      
      // 조건 체크
      return rule.conditions.every(condition => 
        this.evaluateCondition(alert, condition)
      );
    });
  }

  /**
   * 조건 평가
   */
  private evaluateCondition(alert: SecurityAlert, condition: AlertCondition): boolean {
    const value = this.getNestedValue(alert, condition.field);
    
    switch (condition.operator) {
      case 'gt': return value > condition.value;
      case 'gte': return value >= condition.value;
      case 'lt': return value < condition.value;
      case 'lte': return value <= condition.value;
      case 'eq': return value === condition.value;
      case 'contains': return String(value).includes(condition.value);
      case 'regex': return new RegExp(condition.value).test(String(value));
      default: return false;
    }
  }

  /**
   * 중첩된 객체에서 값 추출
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * 규칙에 따른 알림 처리
   */
  private async processRuleAlert(rule: AlertRule, alert: SecurityAlert): Promise<void> {
    rule.lastTriggered = Date.now();
    
    const results = await Promise.all(
      rule.channels.map(async (channelName) => {
        const channel = this.channels.get(channelName);
        if (!channel || !channel.enabled) return false;
        
        try {
          return await channel.send(alert);
        } catch (error) {
          console.error(`알림 채널 '${channelName}' 전송 실패:`, error);
          return false;
        }
      })
    );

    const successCount = results.filter(r => r).length;
    console.log(`📤 [AlertSystem] Rule '${rule.name}' executed: ${successCount}/${rule.channels.length} channels succeeded`);
  }

  /**
   * 알림 이력 추가
   */
  private addToHistory(alert: SecurityAlert): void {
    this.alertHistory.unshift(alert);
    
    // 이력 크기 제한
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory = this.alertHistory.slice(0, this.maxHistorySize);
    }
  }

  // ===== 공개 API =====

  /**
   * 알림 이력 조회
   */
  getAlertHistory(limit: number = 100): SecurityAlert[] {
    return this.alertHistory.slice(0, limit);
  }

  /**
   * 채널 상태 조회
   */
  getChannelStatus(): Array<{ name: string; enabled: boolean; config: any }> {
    return Array.from(this.channels.values()).map(channel => ({
      name: channel.name,
      enabled: channel.enabled,
      config: channel.config
    }));
  }

  /**
   * 규칙 상태 조회
   */
  getRuleStatus(): AlertRule[] {
    return [...this.rules];
  }

  /**
   * 채널 활성화/비활성화
   */
  toggleChannel(channelName: string, enabled: boolean): boolean {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * 테스트 알림 전송
   */
  async sendTestAlert(): Promise<void> {
    await this.sendAlert(
      'Test Alert',
      '보안 알림 시스템 테스트입니다.',
      'LOW',
      'SYSTEM',
      { test: true },
      'AlertSystem',
      '127.0.0.1'
    );
  }

  // ===== 유틸리티 메소드 =====

  private getSeverityEmoji(severity: SecurityAlert['severity']): string {
    const emojiMap = {
      LOW: '🟡',
      MEDIUM: '🟠', 
      HIGH: '🔴',
      CRITICAL: '🚨'
    };
    return emojiMap[severity];
  }

  private getSeverityColor(severity: SecurityAlert['severity']): string {
    const colorMap = {
      LOW: '#36a3f7',
      MEDIUM: '#ffb946',
      HIGH: '#f56565',
      CRITICAL: '#e53e3e'
    };
    return colorMap[severity];
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 싱글톤 인스턴스
export const alertSystem = new AlertSystem();

// 타입 내보내기
export type { SecurityAlert, AlertChannel, AlertRule, AlertCondition };