import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaymentHistory } from "@/lib/payments/toss-billing-supabase";
import { checkAndResetTokensIfNeeded } from "@/lib/subscription/token-reset";
import { logSubscriptionActivity } from "@/lib/logging/activity-logger";

// 통합 설정 데이터 조회 (성능 최적화됨)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    // 토큰 초기화 체크 먼저 수행
    await checkAndResetTokensIfNeeded(user.id);

    const { searchParams } = new URL(request.url);
    const includeDetails = searchParams.get('details') !== 'false';
    const period = searchParams.get('period') || 'month';

    // 🚀 Phase 1: 필수 데이터 (병렬 로딩)
    const [subscriptionResult, usageCacheResult] = await Promise.all([
      // 구독 정보
      supabase
        .from('subscription')
        .select('*')
        .eq('userId', user.id)
        .single(),
      
      // 캐시된 사용량 정보 (빠른 조회)
      supabase
        .from('user_usage_cache')
        .select('*')
        .eq('user_id', user.id)
        .single()
    ]);

    // 사용자 구독 정보 가져오기 - 없으면 FREE 플랜 기본값 사용
    let subscription = subscriptionResult.data;
    
    // 구독이 없으면 FREE 플랜으로 DB에 생성
    if (!subscription) {
      const { data: freePlan } = await supabase
        .from('plan_config')
        .select('*')
        .eq('id', 'FREE')
        .single();

      if (freePlan) {
        const newSubscription = {
          userId: user.id,
          plan: 'FREE',
          tokensTotal: freePlan.monthly_tokens,
          tokensUsed: 0,
          maxCharacters: freePlan.max_characters,
          maxProjects: freePlan.max_projects,
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          cancelAtPeriodEnd: false
        };

        const { data: createdSub } = await supabase
          .from('subscription')
          .insert(newSubscription)
          .select()
          .single();

        subscription = createdSub || newSubscription;
      }
    }

    // 캐시된 사용량 정보
    let usageCache = usageCacheResult.data;

    // 캐시가 없거나 오래된 경우 생성/업데이트
    if (!usageCache || isStale(usageCache.last_calculated)) {
      usageCache = await refreshUserUsageCache(supabase, user.id);
    }

    // 구독 정보에 실제 사용량 반영
    if (subscription && usageCache) {
      subscription.tokensUsed = usageCache.current_month_tokens;
    }

    // 🚀 Phase 1 응답 (즉시 반환용)
    const quickResponse = {
      success: true,
      data: {
        subscription,
        usage: {
          summary: {
            totalTokens: usageCache?.current_month_tokens || 0,
            totalImages: usageCache?.current_month_images || 0,
            totalCharacters: usageCache?.total_characters || 0,
            totalProjects: usageCache?.total_projects || 0,
            storageUsed: usageCache?.storage_used_bytes || 0,
            storageLimit: usageCache?.storage_limit_bytes || 1073741824
          }
        },
        paymentHistory: [],
        cached: true,
        lastUpdated: usageCache?.last_calculated || new Date().toISOString()
      }
    };

    // 빠른 응답 모드일 경우
    if (!includeDetails) {
      return NextResponse.json(quickResponse);
    }

    // 🚀 Phase 2: 상세 데이터 (백그라운드에서 로딩)
    const [paymentHistory, dailyStats, recentActivities] = await Promise.all([
      // 결제 내역
      getPaymentHistory(user.id, 10).catch(() => []),
      
      // 일별 사용량 통계
      getDailyUsageStats(supabase, user.id, period).catch(() => []),
      
      // 최근 활동 내역
      getRecentActivities(supabase, user.id, 10).catch(() => [])
    ]);

    // 최종 완전한 응답
    return NextResponse.json({
      success: true,
      data: {
        subscription,
        usage: {
          summary: {
            totalTokens: usageCache?.current_month_tokens || 0,
            totalImages: usageCache?.current_month_images || 0,
            totalCharacters: usageCache?.total_characters || 0,
            totalProjects: usageCache?.total_projects || 0,
            storageUsed: usageCache?.storage_used_bytes || 0,
            storageLimit: usageCache?.storage_limit_bytes || 1073741824
          },
          dailyStats: dailyStats || [],
          period
        },
        paymentHistory: paymentHistory || [],
        recentActivities: recentActivities || [],
        cached: false,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Settings API error:", error);
    return NextResponse.json(
      { success: false, error: "설정 정보 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 🚀 실제 데이터 기반 사용량 캐시 갱신
async function refreshUserUsageCache(supabase: any, userId: string) {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // 🚀 실제 데이터에서 사용량 집계
    const [monthlyTokenUsage, totalCharacters, totalProjects, storageInfo] = await Promise.all([
      // 이번 달 토큰 사용량 (token_usage 테이블에서)
      supabase
        .from('token_usage')
        .select('total_tokens')
        .eq('userId', userId)
        .gte('created_at', startOfMonth.toISOString()),
      
      // 총 캐릭터 수
      supabase
        .from('character')
        .select('id', { count: 'exact', head: true })
        .eq('userId', userId),
      
      // 총 프로젝트 수 (삭제되지 않은)
      supabase
        .from('project')
        .select('id', { count: 'exact', head: true })
        .eq('userId', userId)
        .is('deletedAt', null),
      
      // 스토리지 정보
      supabase
        .from('user_storage')
        .select('used_bytes, max_bytes')
        .eq('userId', userId)
        .single()
    ]);

    // 월간 토큰 사용량 집계
    const currentMonthTokens = monthlyTokenUsage.data?.reduce((sum: number, usage: any) => 
      sum + (usage.total_tokens || 0), 0) || 0;
    
    // 이번 달 이미지 생성 수 (generation 테이블에서)
    const { count: monthlyImages } = await supabase
      .from('generation')
      .select('id', { count: 'exact', head: true })
      .eq('userId', userId)
      .gte('createdAt', startOfMonth.toISOString());

    // 캐시 데이터 구성
    const cacheData = {
      user_id: userId,
      current_month_tokens: currentMonthTokens,
      current_month_images: monthlyImages || 0,
      total_characters: totalCharacters.count || 0,
      total_projects: totalProjects.count || 0,
      storage_used_bytes: storageInfo.data?.used_bytes || 0,
      storage_limit_bytes: storageInfo.data?.max_bytes || 1073741824,
      last_calculated: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 캐시 업데이트
    await supabase
      .from('user_usage_cache')
      .upsert(cacheData, { onConflict: 'user_id' });

    // 일별 통계도 함께 업데이트
    await updateDailyUsageStats(supabase, userId);

    return cacheData;
  } catch (error) {
    console.error('Cache refresh error:', error);
    return null;
  }
}

// 🚀 실제 데이터 기반 일별 사용량 통계
async function getDailyUsageStats(supabase: any, userId: string, period: string) {
  let days = 30;
  
  switch (period) {
    case 'week': days = 7; break;
    case 'day': days = 1; break;
    case 'month': default: days = 30; break;
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const { data } = await supabase
    .from('daily_usage_stats')
    .select('date, tokens_used, images_generated')
    .eq('user_id', userId)
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', { ascending: true });

  // 날짜 범위 채우기
  const result = [];
  const currentDate = new Date(startDate);
  const endDate = new Date();

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayData = data?.find(d => d.date === dateStr) || {
      date: dateStr,
      tokens_used: 0,
      images_generated: 0
    };
    
    result.push({
      date: dateStr,
      tokens: dayData.tokens_used || 0,
      images: dayData.images_generated || 0
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
}

// 🚀 실제 사용자 활동 내역 조회
async function getRecentActivities(supabase: any, userId: string, limit: number = 10) {
  const { data } = await supabase
    .from('user_activities')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data?.map((activity: any) => ({
    id: activity.id,
    type: activity.activity_type,
    title: activity.activity_title,
    description: activity.activity_description,
    status: activity.status,
    amount: activity.tokens_used > 0 ? `${activity.tokens_used} 토큰` : null,
    timestamp: new Date(activity.created_at).toLocaleString('ko-KR')
  })) || [];
}

// 🚀 일별 사용량 통계 업데이트
async function updateDailyUsageStats(supabase: any, userId: string) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = new Date(today + 'T00:00:00.000Z');
    const endOfDay = new Date(today + 'T23:59:59.999Z');

    // 오늘의 토큰 사용량
    const { data: todayTokens } = await supabase
      .from('token_usage')
      .select('total_tokens')
      .eq('userId', userId)
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());

    const todayTokenUsage = todayTokens?.reduce((sum: number, usage: any) => 
      sum + (usage.total_tokens || 0), 0) || 0;

    // 오늘의 이미지 생성 수
    const { count: todayImages } = await supabase
      .from('generation')
      .select('id', { count: 'exact', head: true })
      .eq('userId', userId)
      .gte('createdAt', startOfDay.toISOString())
      .lte('createdAt', endOfDay.toISOString());

    // 일별 통계 업데이트
    await supabase
      .from('daily_usage_stats')
      .upsert({
        user_id: userId,
        date: today,
        tokens_used: todayTokenUsage,
        images_generated: todayImages || 0,
        api_calls: todayTokens?.length || 0
      }, { onConflict: 'user_id,date' });

  } catch (error) {
    console.error('Daily stats update error:', error);
  }
}

// 캐시 만료 확인 (5분)
function isStale(lastCalculated: string): boolean {
  if (!lastCalculated) return true;
  const now = new Date();
  const lastUpdate = new Date(lastCalculated);
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  return lastUpdate < fiveMinutesAgo;
}

// 구독 해지 API
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const { data: subscription } = await supabase
      .from('subscription')
      .select('*')
      .eq('userId', user.id)
      .single();

    if (!subscription || subscription.plan === 'FREE') {
      return NextResponse.json(
        { success: false, error: "해지할 구독이 없습니다" },
        { status: 400 }
      );
    }

    // 구독 해지 마킹
    await supabase
      .from('subscription')
      .update({ 
        cancelAtPeriodEnd: true,
        updatedAt: new Date().toISOString()
      })
      .eq('userId', user.id);

    // 🚀 활동 로깅 - 구독 해지
    await logSubscriptionActivity(user.id, 'cancelled', `${subscription.plan} 플랜`);

    return NextResponse.json({
      success: true,
      message: "구독이 해지되었습니다. 현재 결제 기간 종료 후 무료 플랜으로 전환됩니다."
    });

  } catch (error) {
    console.error("Cancel subscription error:", error);
    return NextResponse.json(
      { success: false, error: "구독 해지 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}