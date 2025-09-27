import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isUserAdmin } from '@/lib/auth/api-middleware';

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

    // Mock 통계 데이터 (실제로는 데이터베이스에서 집계)
    // 실제 구현에서는 다음과 같은 쿼리들을 실행:
    // - COUNT(*) FROM audit_logs WHERE timestamp > now() - interval '24 hours'
    // - COUNT(*) FROM audit_logs WHERE severity = 'critical'
    // - COUNT(DISTINCT user_id) FROM audit_logs WHERE timestamp > now() - interval '24 hours'
    // - SELECT action, COUNT(*) FROM audit_logs GROUP BY action ORDER BY count DESC LIMIT 5

    const mockStats = {
      totalEvents: 15420,
      todayEvents: 156,
      criticalEvents: 3,
      failedAttempts: 12,
      uniqueUsers: 89,
      topActions: [
        { action: 'LOGIN_SUCCESS', count: 1250 },
        { action: 'PROJECT_CREATE', count: 890 },
        { action: 'AI_GENERATION', count: 567 },
        { action: 'PAYMENT_SUCCESS', count: 234 },
        { action: 'USER_REGISTER', count: 123 }
      ]
    };

    console.log('감사 통계 조회:', { userId: user.id, timestamp: new Date().toISOString() });

    return NextResponse.json(mockStats);

  } catch (error) {
    console.error('감사 통계 조회 오류:', error);
    return NextResponse.json(
      { error: '감사 통계를 불러오는데 실패했습니다' },
      { status: 500 }
    );
  }
}