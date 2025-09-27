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

// POST: 스토리지 사용량 동기화 (관리자 전용)
export async function POST(request: NextRequest) {
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

    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '사용자 ID가 필요합니다'
      }, { status: 400 });
    }

    // 1. user_storage 테이블에서 실시간 사용량 조회
    const { data: storageData } = await supabase
      .from('user_storage')
      .select('*')
      .eq('userId', userId)
      .single();

    // 2. 실제 DB에서 계산된 사용량 조회
    const { data: actualUsage } = await supabase.rpc('get_user_storage_stats', {
      p_user_id: userId
    });

    let estimatedBytes = 0;
    if (actualUsage && actualUsage.length > 0) {
      const stats = actualUsage[0];
      const projectImages = (stats.project_thumbnails || 0) + (stats.panel_count || 0) + (stats.generation_count || 0);
      const characterImages = (stats.character_ref_images || 0) + (stats.character_ratio_images || 0);
      estimatedBytes = (projectImages + characterImages) * 2 * 1024 * 1024; // 2MB per image
    }

    // 3. user_usage_cache 테이블 업데이트
    const { error: cacheUpdateError } = await supabase
      .from('user_usage_cache')
      .upsert({
        user_id: userId,
        storage_used_bytes: Math.max(storageData?.used_bytes || 0, estimatedBytes),
        storage_limit_bytes: storageData?.max_bytes || 1024 * 1024 * 1024, // 1GB default
        last_updated: new Date().toISOString()
      });

    if (cacheUpdateError) {
      console.error('캐시 업데이트 오류:', cacheUpdateError);
    }

    // 4. user_storage 테이블도 실제 사용량으로 업데이트
    if (estimatedBytes > (storageData?.used_bytes || 0)) {
      const { error: storageUpdateError } = await supabase
        .from('user_storage')
        .update({
          used_bytes: estimatedBytes,
          updated_at: new Date().toISOString()
        })
        .eq('userId', userId);

      if (storageUpdateError) {
        console.error('스토리지 업데이트 오류:', storageUpdateError);
      }
    }

    return NextResponse.json({
      success: true,
      message: '스토리지 사용량이 동기화되었습니다',
      data: {
        userId,
        previousUsage: storageData?.used_bytes || 0,
        calculatedUsage: estimatedBytes,
        finalUsage: Math.max(storageData?.used_bytes || 0, estimatedBytes),
        limit: storageData?.max_bytes || 1024 * 1024 * 1024
      }
    });

  } catch (error) {
    console.error('스토리지 동기화 오류:', error);
    return NextResponse.json({
      success: false,
      error: '스토리지 동기화 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}