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

// GET: 특정 사용자의 사용량 통계 조회
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
    const period = searchParams.get('period') || '30'; // 기본 30일
    
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

    // 구독 정보 별도 조회
    const { data: subscriptionData } = await supabase
      .from('subscription')
      .select('*')
      .eq('userId', userId)
      .single();

    // 기간 설정
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // 일별 사용량 통계 조회
    const { data: dailyStats, error: dailyError } = await supabase
      .from('daily_usage_stats')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (dailyError) {
      console.error('일별 통계 조회 오류:', dailyError);
    }

    // 토큰 사용 내역 조회
    const { data: tokenUsage, error: tokenError } = await supabase
      .from('token_usage')
      .select('*')
      .eq('userId', userId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (tokenError) {
      console.error('토큰 사용 내역 조회 오류:', tokenError);
    }

    // 생성 통계 조회
    const { data: generations, error: generationError } = await supabase
      .from('generation')
      .select('id, model, generationTime, createdAt, metadata')
      .eq('userId', userId)
      .gte('createdAt', startDate.toISOString())
      .lte('createdAt', endDate.toISOString())
      .order('createdAt', { ascending: false });

    if (generationError) {
      console.error('생성 통계 조회 오류:', generationError);
    }

    // 프로젝트 활동 통계
    const { data: projects, error: projectError } = await supabase
      .from('project')
      .select('id, title, createdAt, lastEditedAt, panelCount')
      .eq('userId', userId)
      .gte('createdAt', startDate.toISOString())
      .is('deletedAt', null)
      .order('lastEditedAt', { ascending: false });

    if (projectError) {
      console.error('프로젝트 통계 조회 오류:', projectError);
    }

    // 실시간 스토리지 사용량 조회 (user_storage 테이블 사용)
    const { data: storageData, error: storageError } = await supabase
      .from('user_storage')
      .select('*')
      .eq('userId', userId)
      .single();

    if (storageError && storageError.code !== 'PGRST116') {
      console.error('스토리지 사용량 조회 오류:', storageError);
    }

    // 스토리지 데이터가 없으면 기본값 생성
    const finalStorageData = storageData || {
      userId: userId,
      used_bytes: 0,
      max_bytes: 1073741824, // 1GB default
      file_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 캐시된 사용량 정보도 참고용으로 조회
    const { data: usageCache, error: cacheError } = await supabase
      .from('user_usage_cache')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (cacheError && cacheError.code !== 'PGRST116') {
      console.error('사용량 캐시 조회 오류:', cacheError);
    }

    // 통계 계산
    const totalTokensUsed = (tokenUsage || []).reduce((sum, usage) => sum + usage.total_tokens, 0);
    const totalGenerations = (generations || []).length;
    const averageGenerationTime = totalGenerations > 0 
      ? (generations || []).reduce((sum, gen) => sum + (gen.generationTime || 0), 0) / totalGenerations 
      : 0;

    // 서비스별 사용량 통계
    const serviceStats = (tokenUsage || []).reduce((acc, usage) => {
      const service = usage.service_type;
      if (!acc[service]) {
        acc[service] = {
          total_tokens: 0,
          prompt_tokens: 0,
          completion_tokens: 0,
          api_calls: 0
        };
      }
      acc[service].total_tokens += usage.total_tokens;
      acc[service].prompt_tokens += usage.prompt_tokens;
      acc[service].completion_tokens += usage.completion_tokens;
      acc[service].api_calls += 1;
      return acc;
    }, {} as Record<string, any>);

    // 일별 차트 데이터 준비
    const chartData = (dailyStats || []).map(stat => ({
      date: stat.date,
      tokensUsed: stat.tokens_used,
      imagesGenerated: stat.images_generated,
      apiCalls: stat.api_calls
    }));

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
        }
      },
      usage: {
        period: parseInt(period),
        summary: {
          totalTokensUsed,
          totalGenerations,
          averageGenerationTime: Math.round(averageGenerationTime),
          activeProjects: (projects || []).length,
          storageUsed: finalStorageData?.used_bytes || 0,
          storageLimit: finalStorageData?.max_bytes || 0,
          // 캐시 데이터는 참고용으로만 포함
          cachedStorageUsed: usageCache?.storage_used_bytes || 0,
          cachedStorageLimit: usageCache?.storage_limit_bytes || 0,
          // 데이터 소스 정보 추가  
          storageDataSource: 'user_storage_table'
        },
        serviceStats,
        dailyStats: dailyStats || [],
        chartData,
        recentTokenUsage: (tokenUsage || []).slice(0, 20),
        recentGenerations: (generations || []).slice(0, 10),
        recentProjects: (projects || []).slice(0, 5),
        cache: usageCache,
        storageData: storageData,
        finalStorageData: finalStorageData
      }
    });

  } catch (error) {
    console.error('사용자 사용량 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '사용량 조회 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}