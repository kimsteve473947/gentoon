import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isUserAdmin } from '@/lib/auth/api-middleware';

// Mock 감사 로그 데이터 (실제로는 데이터베이스에서 조회)
const mockAuditLogs = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10분 전
    userId: 'admin-123',
    userEmail: 'admin@gentoon.ai',
    action: 'LOGIN_SUCCESS',
    resource: 'authentication_system',
    details: '관리자 로그인 성공',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    severity: 'low',
    category: 'auth',
    success: true
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30분 전
    userId: 'admin-123',
    userEmail: 'admin@gentoon.ai',
    action: 'BACKUP_CREATE',
    resource: 'backup_system',
    details: '전체 데이터베이스 백업 생성',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    severity: 'medium',
    category: 'admin',
    success: true
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45분 전
    userId: 'user-456',
    userEmail: 'user@example.com',
    action: 'PAYMENT_FAILED',
    resource: 'toss_payments',
    details: '결제 실패 - 카드 한도 초과',
    ipAddress: '203.104.123.45',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    severity: 'high',
    category: 'payment',
    success: false
  },
  {
    id: '4',
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1시간 전
    userId: 'user-789',
    userEmail: 'creator@webtoon.com',
    action: 'PROJECT_CREATE',
    resource: 'projects',
    details: '새 웹툰 프로젝트 생성: "판타지 모험"',
    ipAddress: '121.78.234.56',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    severity: 'low',
    category: 'user',
    success: true
  },
  {
    id: '5',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2시간 전
    userId: 'unknown',
    userEmail: 'unknown',
    action: 'LOGIN_ATTEMPT_FAILED',
    resource: 'authentication_system',
    details: '로그인 시도 실패 - 잘못된 비밀번호 (5회 연속)',
    ipAddress: '185.220.101.45',
    userAgent: 'Python-requests/2.28.1',
    severity: 'critical',
    category: 'security',
    success: false
  },
  {
    id: '6',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3시간 전
    userId: 'admin-123',
    userEmail: 'admin@gentoon.ai',
    action: 'SYSTEM_CONFIG_UPDATE',
    resource: 'system_settings',
    details: 'AI 생성 토큰 한도 설정 변경',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    severity: 'medium',
    category: 'admin',
    success: true
  }
];

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // 관리자 권한 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const isAdmin = await isUserAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // URL 파라미터에서 필터 조건 추출
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || 'all';
    const severity = searchParams.get('severity') || 'all';
    const dateRange = searchParams.get('dateRange') || '7d';
    const success = searchParams.get('success') || 'all';

    console.log('감사 로그 필터링:', { search, category, severity, dateRange, success });

    // 날짜 범위 계산
    const now = new Date();
    let startDate = new Date();
    switch (dateRange) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // 필터링 적용
    let filteredLogs = mockAuditLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      
      // 날짜 범위 필터
      if (logDate < startDate) return false;
      
      // 검색어 필터 (이메일, 액션, 상세내용)
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch = 
          log.userEmail.toLowerCase().includes(searchLower) ||
          log.action.toLowerCase().includes(searchLower) ||
          log.details.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }
      
      // 카테고리 필터
      if (category !== 'all' && log.category !== category) return false;
      
      // 심각도 필터
      if (severity !== 'all' && log.severity !== severity) return false;
      
      // 성공/실패 필터
      if (success !== 'all') {
        const isSuccess = success === 'true';
        if (log.success !== isSuccess) return false;
      }
      
      return true;
    });

    // 최신순으로 정렬
    filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      success: true,
      logs: filteredLogs,
      totalCount: filteredLogs.length,
      filters: { search, category, severity, dateRange, success }
    });

  } catch (error) {
    console.error('감사 로그 조회 오류:', error);
    return NextResponse.json(
      { error: '감사 로그를 불러오는데 실패했습니다' },
      { status: 500 }
    );
  }
}