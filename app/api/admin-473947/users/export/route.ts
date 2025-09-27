import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: 사용자 데이터 CSV 내보내기
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 1. 인증 및 관리자 권한 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: '로그인이 필요합니다'
      }, { status: 401 });
    }

    const { data: subscription } = await supabase
      .from('subscription')
      .select('plan')
      .eq('userId', user.id)
      .single();
    
    if (subscription?.plan !== 'ADMIN') {
      return NextResponse.json({
        success: false,
        error: '관리자 권한이 필요합니다'
      }, { status: 403 });
    }

    // 2. 모든 사용자 조회
    const { data: users, error: usersError } = await supabase
      .from('user')
      .select('*')
      .order('createdAt', { ascending: false });

    if (usersError) {
      throw usersError;
    }

    // 구독 정보 별도 조회
    const userIds = (users || []).map(user => user.id);
    const { data: subscriptions } = await supabase
      .from('subscription')
      .select('*')
      .in('userId', userIds);

    const subscriptionMap = (subscriptions || []).reduce((acc, sub) => {
      acc[sub.userId] = sub;
      return acc;
    }, {} as Record<string, any>);

    // 3. 각 사용자의 통계 데이터 수집 (캐시 사용)
    const { data: usageCache } = await supabase
      .from('user_usage_cache')
      .select('*')
      .in('user_id', userIds);

    const cacheMap = (usageCache || []).reduce((acc, cache) => {
      acc[cache.user_id] = cache;
      return acc;
    }, {} as Record<string, any>);

    const enrichedUsers = (users || []).map(user => {
      const subscription = subscriptionMap[user.id] || {
        plan: 'FREE',
        tokensTotal: 10,
        tokensUsed: 0,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false
      };

      const cache = cacheMap[user.id] || {
        total_projects: 0,
        total_characters: 0,
        current_month_images: 0
      };

      return {
        ...user,
        subscription,
        projectCount: cache.total_projects || 0,
        characterCount: cache.total_characters || 0,
        monthlyGenerations: cache.current_month_images || 0
      };
    });


    // 4. CSV 헤더
    const csvHeaders = [
      'ID',
      '이름',
      '이메일',
      '역할',
      '플랜',
      '토큰 총량',
      '토큰 사용량',
      '사용률(%)',
      '프로젝트 수',
      '캐릭터 수',
      '이번달 생성',
      '가입일',
      '구독 시작일',
      '구독 종료일',
      '자동갱신'
    ];

    // 5. CSV 데이터 생성
    const csvRows = [csvHeaders.join(',')];
    
    enrichedUsers.forEach(user => {
      const subscription = user.subscription || {};
      const tokensUsed = subscription.tokensUsed || 0;
      const tokensTotal = subscription.tokensTotal || 10;
      const usageRate = tokensTotal > 0 ? Math.round((tokensUsed / tokensTotal) * 100) : 0;

      const row = [
        `"${user.id}"`,
        `"${user.name || ''}"`,
        `"${user.email}"`,
        user.role === 'ADMIN' ? '관리자' : '사용자',
        subscription.plan || 'FREE',
        tokensTotal,
        tokensUsed,
        `${usageRate}%`,
        user.projectCount || 0,
        user.characterCount || 0,
        user.monthlyGenerations || 0,
        new Date(user.createdAt).toLocaleDateString('ko-KR'),
        subscription.currentPeriodStart ? new Date(subscription.currentPeriodStart).toLocaleDateString('ko-KR') : '-',
        subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('ko-KR') : '-',
        subscription.cancelAtPeriodEnd ? '해지 예약' : '자동갱신'
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    
    // 6. CSV 응답 반환
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="users_${new Date().toISOString().split('T')[0]}.csv"`,
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('사용자 내보내기 오류:', error);
    return NextResponse.json({
      success: false,
      error: '내보내기 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}