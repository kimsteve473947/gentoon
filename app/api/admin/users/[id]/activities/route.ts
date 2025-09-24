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

// GET: 특정 사용자의 활동 내역 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type') || '';
    
    const offset = (page - 1) * limit;

    // 사용자 존재 확인
    const { data: userData, error: userError } = await supabase
      .from('user')
      .select('id, name, email')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({
        success: false,
        error: '사용자를 찾을 수 없습니다'
      }, { status: 404 });
    }

    // 활동 내역 조회 쿼리 구성
    let query = supabase
      .from('user_activities')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    // 활동 타입 필터
    if (type) {
      query = query.eq('activity_type', type);
    }

    // 정렬 및 페이지네이션
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: activities, error: activitiesError, count } = await query;

    if (activitiesError) {
      throw activitiesError;
    }

    // 활동 통계 계산
    const { data: activityStats } = await supabase
      .from('user_activities')
      .select('activity_type')
      .eq('user_id', userId);

    const statsMap = (activityStats || []).reduce((acc, activity) => {
      acc[activity.activity_type] = (acc[activity.activity_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 최근 7일간 활동 통계
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentStats } = await supabase
      .from('user_activities')
      .select('activity_type, created_at')
      .eq('user_id', userId)
      .gte('created_at', sevenDaysAgo.toISOString());

    const dailyStats = (recentStats || []).reduce((acc, activity) => {
      const date = new Date(activity.created_at).toISOString().split('T')[0];
      if (!acc[date]) acc[date] = 0;
      acc[date]++;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      user: userData,
      activities: activities || [],
      stats: {
        total: count || 0,
        byType: statsMap,
        dailyStats
      },
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('사용자 활동 내역 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '활동 내역 조회 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}