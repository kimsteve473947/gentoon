import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// GET: 완전한 사용자 목록 조회 (검색, 필터링, 정렬, 페이지네이션, 실제 통계)
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

    // 2. 관리자 확인 후 Service Role 클라이언트로 전환 (RLS 우회)
    const adminSupabase = createServiceClient();

    // 2. 쿼리 파라미터 추출
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const plan = searchParams.get('plan') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    const offset = (page - 1) * limit;

    // 3. 기본 사용자 목록 조회 (외래 키 관계가 없으므로 별도 조회)
    let userQuery = adminSupabase
      .from('user')
      .select('*', { count: 'exact' });

    // 4. 검색 필터 적용
    if (search) {
      userQuery = userQuery.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
    }
    if (role) {
      userQuery = userQuery.eq('role', role);
    }

    // 5. 정렬 적용 (subscription 관련 정렬은 나중에 메모리에서 처리)
    const ascending = sortOrder === 'asc';
    if (sortBy !== 'subscription.plan' && sortBy !== 'tokensUsed') {
      userQuery = userQuery.order(sortBy, { ascending });
    }

    // 6. 페이지네이션 적용
    userQuery = userQuery.range(offset, offset + limit - 1);

    const { data: users, error: usersError, count } = await userQuery;
    
    if (usersError) {
      throw usersError;
    }

    // 7. 🚀 성능 최적화: 단일 쿼리로 모든 관련 데이터 조회
    const userIds = (users || []).map(user => user.id);
    
    // 8. 병렬 쿼리 실행으로 성능 향상 (DB 사용량 제외로 리소스 절약)
    const [
      { data: subscriptions },
      { data: usageCache },
      { data: recentActivities },
      { data: latestTransactions }
    ] = await Promise.all([
      // 구독 정보 조회
      adminSupabase
        .from('subscription')
        .select('*')
        .in('userId', userIds),

      // 캐시된 통계 정보 조회 (스토리지 사용량 제외)
      adminSupabase
        .from('user_usage_cache')
        .select('user_id, total_projects, total_characters, current_month_images')
        .in('user_id', userIds),

      // 최근 활동 조회 (사용자별 최신 1건만)
      adminSupabase
        .from('user_activities')
        .select('user_id, created_at')
        .in('user_id', userIds)
        .order('created_at', { ascending: false }),

      // 최근 거래 정보 조회 (사용자별 최신 결제만)
      adminSupabase
        .rpc('get_latest_transactions', { user_ids: userIds })
        .then(({ data }) => ({ data }))
        .catch(() =>
          // RPC 함수가 없으면 기본 쿼리 사용
          adminSupabase
            .from('transaction')
            .select('userId, id, amount, createdAt, tossPaymentKey, status')
            .in('userId', userIds)
            .eq('type', 'SUBSCRIPTION')
            .eq('status', 'COMPLETED')
            .order('createdAt', { ascending: false })
        )
    ]);

    // 12. 데이터 매핑 및 결합
    const subscriptionMap = (subscriptions || []).reduce((acc, sub) => {
      acc[sub.userId] = sub;
      return acc;
    }, {} as Record<string, any>);

    const cacheMap = (usageCache || []).reduce((acc, cache) => {
      acc[cache.user_id] = cache;
      return acc;
    }, {} as Record<string, any>);

    const activityMap = (recentActivities || []).reduce((acc, activity) => {
      if (!acc[activity.user_id]) {
        acc[activity.user_id] = activity.created_at;
      }
      return acc;
    }, {} as Record<string, string>);

    const transactionMap = (latestTransactions || []).reduce((acc, transaction) => {
      if (!acc[transaction.userId]) {
        acc[transaction.userId] = transaction;
      }
      return acc;
    }, {} as Record<string, any>);

    // 13. 플랜 필터 및 데이터 결합
    let enrichedUsers = (users || []).map((user: any) => {
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

      const latestTransaction = transactionMap[user.id] || null;

      return {
        ...user,
        subscription,
        stats: {
          projectCount: cache.total_projects || 0,
          characterCount: cache.total_characters || 0,
          thisMonthGenerations: cache.current_month_images || 0,
          lastActivity: activityMap[user.id] || null
          // 스토리지 사용량은 상세정보에서만 조회하도록 제거
        },
        latestTransaction: latestTransaction ? {
          id: latestTransaction.id,
          amount: latestTransaction.amount,
          createdAt: latestTransaction.createdAt,
          tossPaymentKey: latestTransaction.tossPaymentKey
        } : null
      };
    });

    // 14. 플랜 필터 적용
    if (plan) {
      enrichedUsers = enrichedUsers.filter(user => user.subscription?.plan === plan);
    }

    // 15. 메모리에서 정렬 적용 (subscription 관련 정렬의 경우)
    if (sortBy === 'subscription.plan' || sortBy === 'tokensUsed') {
      enrichedUsers.sort((a, b) => {
        let aValue, bValue;
        
        if (sortBy === 'subscription.plan') {
          aValue = a.subscription?.plan || 'FREE';
          bValue = b.subscription?.plan || 'FREE';
        } else if (sortBy === 'tokensUsed') {
          aValue = a.subscription?.tokensUsed || 0;
          bValue = b.subscription?.tokensUsed || 0;
        }
        
        if (ascending) {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });
    }

    return NextResponse.json({
      success: true,
      users: enrichedUsers,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '사용자 목록 조회 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}