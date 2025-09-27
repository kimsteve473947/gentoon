import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: 사용자의 실시간 스토리지 사용량 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
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

    // 2. 실시간 스토리지 사용량 조회 (user_storage에서 직접)
    const { data: actualStorage, error: storageError } = await supabase
      .from('user_storage')
      .select('used_bytes, max_bytes, file_count, updated_at')
      .eq('userId', userId)
      .single();

    // 3. 캐시된 데이터도 함께 조회 (비교용)
    const { data: cachedStorage, error: cacheError } = await supabase
      .from('user_usage_cache')
      .select('storage_used_bytes, storage_limit_bytes, updated_at')
      .eq('user_id', userId)
      .single();

    // 4. 스토리지 사용량 세부 분석 (파일별 분석)
    const { data: fileAnalysis, error: fileError } = await supabase.rpc(
      'get_user_storage_breakdown',
      { target_user_id: userId }
    ).then(result => {
      if (result.error) {
        // RPC 함수가 없으면 기본 분석 수행
        return { data: null, error: null };
      }
      return result;
    });

    if (storageError) {
      console.error('스토리지 데이터 조회 오류:', storageError);
      return NextResponse.json({
        success: false,
        error: '스토리지 정보를 조회할 수 없습니다'
      }, { status: 404 });
    }

    // 5. 응답 데이터 구성
    const response = {
      success: true,
      storage: {
        // 실제 데이터
        actual: {
          usedBytes: actualStorage?.used_bytes || 0,
          maxBytes: actualStorage?.max_bytes || 314572800, // 300MB 기본값
          fileCount: actualStorage?.file_count || 0,
          usagePercentage: actualStorage ? 
            Math.round((actualStorage.used_bytes / actualStorage.max_bytes) * 100) : 0,
          lastUpdated: actualStorage?.updated_at,
          usedMB: actualStorage ? Math.round(actualStorage.used_bytes / 1024 / 1024 * 10) / 10 : 0,
          maxMB: actualStorage ? Math.round(actualStorage.max_bytes / 1024 / 1024 * 10) / 10 : 300
        },
        // 캐시된 데이터
        cached: {
          usedBytes: cachedStorage?.storage_used_bytes || 0,
          maxBytes: cachedStorage?.storage_limit_bytes || 314572800,
          lastUpdated: cachedStorage?.updated_at,
          usedMB: cachedStorage ? Math.round(Number(cachedStorage.storage_used_bytes) / 1024 / 1024 * 10) / 10 : 0,
          maxMB: cachedStorage ? Math.round(Number(cachedStorage.storage_limit_bytes) / 1024 / 1024 * 10) / 10 : 300
        },
        // 차이 분석
        difference: {
          byteDiff: (actualStorage?.used_bytes || 0) - (Number(cachedStorage?.storage_used_bytes) || 0),
          mbDiff: Math.round(((actualStorage?.used_bytes || 0) - (Number(cachedStorage?.storage_used_bytes) || 0)) / 1024 / 1024 * 10) / 10,
          isOutOfSync: Math.abs((actualStorage?.used_bytes || 0) - (Number(cachedStorage?.storage_used_bytes) || 0)) > 1024 * 1024 // 1MB 이상 차이
        },
        // 파일 분석 (가능한 경우)
        breakdown: fileAnalysis || null
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('스토리지 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '스토리지 정보 조회 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}

// POST: 캐시 동기화 (실제 사용량으로 캐시 업데이트)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
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

    // 2. 실제 스토리지 사용량 조회
    const { data: actualStorage, error: storageError } = await supabase
      .from('user_storage')
      .select('used_bytes, max_bytes')
      .eq('userId', userId)
      .single();

    if (storageError || !actualStorage) {
      return NextResponse.json({
        success: false,
        error: '스토리지 정보를 찾을 수 없습니다'
      }, { status: 404 });
    }

    // 3. 캐시 업데이트
    const { error: updateError } = await supabase
      .from('user_usage_cache')
      .upsert({
        user_id: userId,
        storage_used_bytes: actualStorage.used_bytes,
        storage_limit_bytes: actualStorage.max_bytes,
        updated_at: new Date().toISOString()
      });

    if (updateError) {
      console.error('캐시 업데이트 오류:', updateError);
      return NextResponse.json({
        success: false,
        error: '캐시 업데이트에 실패했습니다'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '스토리지 캐시가 동기화되었습니다',
      storage: {
        usedBytes: actualStorage.used_bytes,
        maxBytes: actualStorage.max_bytes,
        usedMB: Math.round(actualStorage.used_bytes / 1024 / 1024 * 10) / 10,
        syncedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('캐시 동기화 오류:', error);
    return NextResponse.json({
      success: false,
      error: '캐시 동기화 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}