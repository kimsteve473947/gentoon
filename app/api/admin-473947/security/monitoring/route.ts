/**
 * 네이버급 실시간 보안 모니터링 API
 * 관리자 대시보드용 실시간 보안 데이터 제공
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { securityMonitor } from '@/lib/security/security-monitor';
import type { SecurityMetrics, SecurityEvent, ThreatAlert } from '@/lib/security/security-monitor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 실시간 보안 모니터링 데이터 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다'
      }, { status: 401 });
    }

    // 관리자 권한 확인 (실제 구현에서는 사용자 역할 확인)
    const isAdmin = user.email === process.env.ADMIN_EMAIL; // 임시: 실제로는 DB에서 role 확인
    if (!isAdmin) {
      return NextResponse.json({
        success: false,
        error: '관리자 권한이 필요합니다'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const limit = parseInt(searchParams.get('limit') || '50');

    let responseData: any;

    switch (type) {
      case 'metrics':
        // 실시간 메트릭 조회
        responseData = {
          metrics: securityMonitor.getMetrics(),
          timestamp: new Date().toISOString()
        };
        break;

      case 'events':
        // 최근 보안 이벤트 조회
        responseData = {
          events: securityMonitor.getRecentEvents(limit),
          total: securityMonitor.getRecentEvents().length
        };
        break;

      case 'alerts':
        // 활성 알림 조회
        responseData = {
          alerts: securityMonitor.getActiveAlerts(),
          total: securityMonitor.getActiveAlerts().length
        };
        break;

      case 'overview':
      default:
        // 종합 대시보드 데이터
        const metrics = securityMonitor.getMetrics();
        const recentEvents = securityMonitor.getRecentEvents(20);
        const activeAlerts = securityMonitor.getActiveAlerts();

        responseData = {
          overview: {
            // 실시간 상태
            status: getSecurityStatus(metrics),
            threatLevel: getThreatLevel(metrics, activeAlerts),
            
            // 핵심 지표
            keyMetrics: {
              requestsPerSecond: metrics.realTime.requestsPerSecond,
              blockedRequestsPerSecond: metrics.realTime.blockedRequestsPerSecond,
              uniqueIPs: metrics.realTime.uniqueIPs,
              activeThreats: metrics.realTime.activeThreats,
              systemLoad: getSystemLoadLabel(metrics.realTime.systemLoad)
            },

            // 시간별 통계
            hourlyStats: {
              totalRequests: metrics.hourly.totalRequests,
              blockedRequests: metrics.hourly.blockedRequests,
              blockRate: metrics.hourly.totalRequests > 0 
                ? ((metrics.hourly.blockedRequests / metrics.hourly.totalRequests) * 100).toFixed(2)
                : '0.00',
              rateLimitViolations: metrics.hourly.rateLimitViolations,
              ipBlocks: metrics.hourly.ipBlockCount,
              maliciousPatterns: metrics.hourly.maliciousPatternCount
            },

            // Top 위협
            topThreats: {
              attackerIPs: metrics.hourly.topAttackerIPs.slice(0, 5),
              targetPaths: metrics.hourly.topTargetPaths.slice(0, 5)
            },

            // 최근 이벤트 (요약)
            recentEvents: recentEvents.slice(0, 10).map(event => ({
              id: event.id,
              timestamp: event.timestamp,
              type: event.type,
              severity: event.severity,
              ip: event.ip,
              path: event.path,
              description: generateEventDescription(event)
            })),

            // 활성 알림
            alerts: activeAlerts.slice(0, 5).map(alert => ({
              id: alert.id,
              timestamp: alert.timestamp,
              title: alert.title,
              severity: alert.severity,
              ip: alert.ip,
              description: alert.description
            }))
          },
          timestamp: new Date().toISOString()
        };
        break;
    }

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('보안 모니터링 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '모니터링 데이터 조회 중 오류가 발생했습니다',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
}

/**
 * 수동 보안 액션 실행 (IP 차단, 알림 처리 등)
 */
export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다'
      }, { status: 401 });
    }

    const isAdmin = user.email === 'kimjh473947@gmail.com';
    if (!isAdmin) {
      return NextResponse.json({
        success: false,
        error: '관리자 권한이 필요합니다'
      }, { status: 403 });
    }

    const body = await request.json();
    const { action, data } = body;

    let result: any;

    switch (action) {
      case 'block_ip':
        // IP 수동 차단
        if (!data.ip || !data.duration) {
          return NextResponse.json({
            success: false,
            error: 'IP 주소와 차단 시간이 필요합니다'
          }, { status: 400 });
        }

        // IP 보호 시스템에 차단 요청
        const { ipProtection } = await import('@/lib/security/ip-protection');
        ipProtection.blockIP(
          data.ip, 
          data.reason || '관리자 수동 차단', 
          data.duration * 60 * 1000 // 분을 밀리초로 변환
        );

        result = {
          message: `IP ${data.ip}이(가) ${data.duration}분간 차단되었습니다`,
          ip: data.ip,
          duration: data.duration
        };
        break;

      case 'unblock_ip':
        // IP 차단 해제
        if (!data.ip) {
          return NextResponse.json({
            success: false,
            error: 'IP 주소가 필요합니다'
          }, { status: 400 });
        }

        const { ipProtection: ipProtectionUnblock } = await import('@/lib/security/ip-protection');
        ipProtectionUnblock.unblockIP(data.ip);

        result = {
          message: `IP ${data.ip} 차단이 해제되었습니다`,
          ip: data.ip
        };
        break;

      case 'clear_rate_limit':
        // Rate limit 초기화
        if (!data.identifier) {
          return NextResponse.json({
            success: false,
            error: '식별자가 필요합니다'
          }, { status: 400 });
        }

        const { rateLimiter } = await import('@/lib/security/rate-limiter');
        rateLimiter.unblockIdentifier(data.identifier, data.securityLevel || 'NORMAL');

        result = {
          message: `${data.identifier}의 rate limit이 초기화되었습니다`,
          identifier: data.identifier
        };
        break;

      case 'test_alert':
        // 테스트 알림 생성
        securityMonitor.recordEvent(
          'SUSPICIOUS_ACTIVITY',
          'LOW',
          '127.0.0.1',
          { test: true, message: '테스트 알림' },
          '/test',
          'Admin Test'
        );

        result = {
          message: '테스트 알림이 생성되었습니다'
        };
        break;

      default:
        return NextResponse.json({
          success: false,
          error: `알 수 없는 액션: ${action}`
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('보안 액션 실행 오류:', error);
    return NextResponse.json({
      success: false,
      error: '보안 액션 실행 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}

// ===== 유틸리티 함수 =====

/**
 * 전체 보안 상태 계산
 */
function getSecurityStatus(metrics: SecurityMetrics): 'NORMAL' | 'WARNING' | 'CRITICAL' {
  const { realTime } = metrics;
  
  if (realTime.activeThreats > 5 || realTime.systemLoad >= 3) {
    return 'CRITICAL';
  }
  
  if (realTime.activeThreats > 0 || realTime.systemLoad >= 2 || realTime.blockedRequestsPerSecond > 10) {
    return 'WARNING';
  }
  
  return 'NORMAL';
}

/**
 * 위협 레벨 계산
 */
function getThreatLevel(metrics: SecurityMetrics, alerts: ThreatAlert[]): number {
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL').length;
  const highAlerts = alerts.filter(a => a.severity === 'HIGH').length;
  
  let level = 0;
  level += criticalAlerts * 4;
  level += highAlerts * 2;
  level += metrics.realTime.activeThreats;
  
  return Math.min(10, level); // 0-10 스케일
}

/**
 * 시스템 로드 라벨
 */
function getSystemLoadLabel(load: number): string {
  switch (load) {
    case 0: return 'NORMAL';
    case 1: return 'LOW';
    case 2: return 'MEDIUM';
    case 3: return 'HIGH';
    default: return 'UNKNOWN';
  }
}

/**
 * 이벤트 설명 생성
 */
function generateEventDescription(event: SecurityEvent): string {
  switch (event.type) {
    case 'RATE_LIMIT_EXCEEDED':
      return `API 요청 한도 초과 (${event.data.identifier || event.ip})`;
    case 'IP_BLOCKED':
      return `IP 자동 차단 (위험도: ${event.data.riskScore || 'N/A'})`;
    case 'MALICIOUS_PATTERN':
      return `악성 패턴 탐지 (${event.path})`;
    case 'SUSPICIOUS_ACTIVITY':
      return `의심스러운 활동 감지`;
    case 'BRUTE_FORCE_ATTEMPT':
      return `브루트 포스 공격 시도`;
    case 'DDoS_DETECTED':
      return `DDoS 공격 탐지`;
    case 'ADMIN_ACCESS_ATTEMPT':
      return `관리자 페이지 무단 접근 시도`;
    case 'API_ABUSE':
      return `API 남용 탐지`;
    case 'SECURITY_BYPASS_ATTEMPT':
      return `보안 우회 시도`;
    default:
      return `보안 이벤트 (${event.type})`;
  }
}