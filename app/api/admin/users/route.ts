import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    let userQuery = supabase
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

    // 7. 사용자 ID 목록 추출
    const userIds = (users || []).map(user => user.id);
    
    // 8. 구독 정보 별도 조회
    const { data: subscriptions } = await supabase
      .from('subscription')
      .select('*')
      .in('userId', userIds);
    
    // 9. 캐시된 통계 정보 조회 (실시간 계산 대신 캐시 사용)
    const { data: usageCache } = await supabase
      .from('user_usage_cache')
      .select('*')
      .in('user_id', userIds);

    // 10. 최근 활동 조회 (한 번에)
    const { data: recentActivities } = await supabase
      .from('user_activities')
      .select('user_id, created_at')
      .in('user_id', userIds)
      .order('created_at', { ascending: false });

    // 11. 데이터 매핑 및 결합
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

    // 12. 플랜 필터 및 데이터 결합
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
        current_month_images: 0,
        storage_used_bytes: 0,
        storage_limit_bytes: 1073741824 // 1GB default
      };

      return {
        ...user,
        subscription,
        stats: {
          projectCount: cache.total_projects || 0,
          characterCount: cache.total_characters || 0,
          thisMonthGenerations: cache.current_month_images || 0,
          lastActivity: activityMap[user.id] || null,
          storageUsedBytes: cache.storage_used_bytes || 0,
          storageLimitBytes: cache.storage_limit_bytes || 1073741824
        }
      };
    });

    // 13. 플랜 필터 적용
    if (plan) {
      enrichedUsers = enrichedUsers.filter(user => user.subscription?.plan === plan);
    }

    // 14. 메모리에서 정렬 적용 (subscription 관련 정렬의 경우)
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