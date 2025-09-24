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

// GET: 특정 사용자 상세 정보 조회
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

    // 사용자 기본 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('user')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({
        success: false,
        error: '사용자를 찾을 수 없습니다'
      }, { status: 404 });
    }

    // 구독 정보 별도 조회
    const { data: subscriptionData } = await supabase
      .from('subscription')
      .select('*')
      .eq('userId', userId)
      .single();

    // 사용자 통계 조회
    const [
      { count: projectCount },
      { count: characterCount },
      { count: generationCount },
      { data: recentProjects },
      { data: recentActivities },
      { data: usageStats },
      { data: transactions }
    ] = await Promise.all([
      // 전체 프로젝트 수
      supabase
        .from('project')
        .select('*', { count: 'exact', head: true })
        .eq('userId', userId)
        .is('deletedAt', null),

      // 전체 캐릭터 수
      supabase
        .from('character')
        .select('*', { count: 'exact', head: true })
        .eq('userId', userId),

      // 전체 생성 수
      supabase
        .from('generation')
        .select('*', { count: 'exact', head: true })
        .eq('userId', userId),

      // 최근 프로젝트 5개
      supabase
        .from('project')
        .select('id, title, status, createdAt, lastEditedAt, panelCount')
        .eq('userId', userId)
        .is('deletedAt', null)
        .order('lastEditedAt', { ascending: false })
        .limit(5),

      // 최근 활동 10개
      supabase
        .from('user_activities')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),

      // 월별 사용량 통계
      supabase
        .from('user_usage_cache')
        .select('*')
        .eq('user_id', userId)
        .single(),

      // 최근 거래 내역 5개
      supabase
        .from('transaction')
        .select('*')
        .eq('userId', userId)
        .order('createdAt', { ascending: false })
        .limit(5)
    ]);

    // 이번 달 사용량 통계
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const { data: monthlyStats } = await supabase
      .from('daily_usage_stats')
      .select('*')
      .eq('user_id', userId)
      .gte('date', thisMonth.toISOString().split('T')[0]);

    const monthlyUsage = monthlyStats?.reduce((acc, stat) => ({
      tokens_used: acc.tokens_used + stat.tokens_used,
      images_generated: acc.images_generated + stat.images_generated,
      api_calls: acc.api_calls + stat.api_calls
    }), { tokens_used: 0, images_generated: 0, api_calls: 0 });

    return NextResponse.json({
      success: true,
      user: {
        ...userData,
        subscription: subscriptionData || {
          plan: 'FREE',
          tokensTotal: 10,
          tokensUsed: 0,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false
        },
        stats: {
          projectCount: projectCount || 0,
          characterCount: characterCount || 0,
          generationCount: generationCount || 0,
          monthlyUsage: monthlyUsage || { tokens_used: 0, images_generated: 0, api_calls: 0 }
        },
        recentProjects: recentProjects || [],
        recentActivities: recentActivities || [],
        usageStats: usageStats || null,
        transactions: transactions || []
      }
    });

  } catch (error) {
    console.error('사용자 상세 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '사용자 상세 조회 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}

// PATCH: 사용자 정보 수정
export async function PATCH(
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

    const body = await request.json();
    const { 
      name, 
      role, 
      plan, 
      tokensTotal, 
      tokensUsed, 
      maxCharacters, 
      maxProjects,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      storageLimit
    } = body;

    // 사용자 기본 정보 업데이트
    const userUpdates: any = {};
    if (name !== undefined) userUpdates.name = name;
    if (role !== undefined) userUpdates.role = role;
    
    if (Object.keys(userUpdates).length > 0) {
      userUpdates.updatedAt = new Date().toISOString();
      
      const { error: userUpdateError } = await supabase
        .from('user')
        .update(userUpdates)
        .eq('id', userId);

      if (userUpdateError) {
        throw userUpdateError;
      }
    }

    // 구독 정보 업데이트
    const subscriptionUpdates: any = {};
    if (plan !== undefined) subscriptionUpdates.plan = plan;
    if (tokensTotal !== undefined) subscriptionUpdates.tokensTotal = tokensTotal;
    if (tokensUsed !== undefined) subscriptionUpdates.tokensUsed = tokensUsed;
    if (maxCharacters !== undefined) subscriptionUpdates.maxCharacters = maxCharacters;
    if (maxProjects !== undefined) subscriptionUpdates.maxProjects = maxProjects;
    if (currentPeriodEnd !== undefined) subscriptionUpdates.currentPeriodEnd = new Date(currentPeriodEnd).toISOString();
    if (cancelAtPeriodEnd !== undefined) subscriptionUpdates.cancelAtPeriodEnd = cancelAtPeriodEnd;

    if (Object.keys(subscriptionUpdates).length > 0) {
      subscriptionUpdates.updatedAt = new Date().toISOString();
      
      const { error: subscriptionUpdateError } = await supabase
        .from('subscription')
        .update(subscriptionUpdates)
        .eq('userId', userId);

      if (subscriptionUpdateError) {
        throw subscriptionUpdateError;
      }
    }

    // 스토리지 제한 업데이트
    if (storageLimit !== undefined) {
      await supabase
        .from('user_storage')
        .upsert({
          userId,
          max_bytes: storageLimit,
          updated_at: new Date().toISOString()
        });

      // user_usage_cache도 업데이트
      await supabase
        .from('user_usage_cache')
        .upsert({
          user_id: userId,
          storage_limit_bytes: storageLimit,
          updated_at: new Date().toISOString()
        });
    }

    // 수정된 사용자 정보 재조회
    const { data: updatedUser, error: fetchError } = await supabase
      .from('user')
      .select(`
        *,
        subscription(*)
      `)
      .eq('id', userId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    // 활동 로그 추가
    await supabase
      .from('user_activities')
      .insert({
        user_id: userId,
        activity_type: 'admin_update',
        activity_title: '관리자에 의한 계정 정보 수정',
        activity_description: `관리자 ${user.email}에 의해 계정 정보가 수정되었습니다.`,
        metadata: {
          updated_fields: Object.keys({ ...userUpdates, ...subscriptionUpdates }),
          admin_user_id: user.id
        }
      });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: '사용자 정보가 수정되었습니다'
    });

  } catch (error) {
    console.error('사용자 정보 수정 오류:', error);
    return NextResponse.json({
      success: false,
      error: '사용자 정보 수정 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}