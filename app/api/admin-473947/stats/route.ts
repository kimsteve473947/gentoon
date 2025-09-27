import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 관리자 권한 확인
async function checkAdminAccess(supabase: any, user: any) {
  if (!user) return false;
  
  const { data: subscription } = await supabase
    .from('subscription')
    .select('plan')
    .eq('userId', user.id)
    .single();
  
  return subscription?.plan === 'ADMIN';
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: '로그인이 필요합니다'
      }, { status: 401 });
    }

    // 관리자 권한 확인
    const hasAdminAccess = await checkAdminAccess(supabase, user);
    if (!hasAdminAccess) {
      return NextResponse.json({
        success: false,
        error: '관리자 권한이 필요합니다'
      }, { status: 403 });
    }

    // 사용자 수 조회
    const { count: totalUsers } = await supabase
      .from('subscription')
      .select('*', { count: 'exact', head: true });

    // 전체 쿠폰 수 조회
    const { count: totalCoupons } = await supabase
      .from('coupon')
      .select('*', { count: 'exact', head: true });

    // 활성 쿠폰 수 조회
    const { count: activeCoupons } = await supabase
      .from('coupon')
      .select('*', { count: 'exact', head: true })
      .eq('isactive', true);

    // 총 매출 계산 (실제 결제 데이터)
    const { data: transactions } = await supabase
      .from('transaction')
      .select('amount, status')
      .eq('status', 'COMPLETED')
      .in('type', ['SUBSCRIPTION', 'TOKEN_PURCHASE']);

    const totalRevenue = (transactions || []).reduce((sum, transaction) => sum + (transaction.amount || 0), 0);

    // 이번 달 신규 사용자 수
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const { count: newUsersThisMonth } = await supabase
      .from('user')
      .select('*', { count: 'exact', head: true })
      .gte('createdAt', thisMonth.toISOString());

    // 활성 사용자 수 (이번 달 활동이 있는 사용자)
    const { count: activeUsers } = await supabase
      .from('user_activities')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', thisMonth.toISOString());

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      totalCoupons: totalCoupons || 0,
      activeCoupons: activeCoupons || 0,
      totalRevenue: totalRevenue || 0,
      newUsersThisMonth: newUsersThisMonth || 0,
      activeUsers: activeUsers || 0
    });

  } catch (error) {
    console.error('통계 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '통계 조회 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}