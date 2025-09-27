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

// POST: 사용자 스토리지 사용량 추적 및 업데이트
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

    const { userId, fileSize, operation } = await request.json();
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId가 필요합니다'
      }, { status: 400 });
    }

    // 현재 사용자 스토리지 정보 조회
    let { data: storage, error: storageError } = await supabase
      .from('user_storage')
      .select('*')
      .eq('userId', userId)
      .single();

    if (storageError && storageError.code !== 'PGRST116') {
      throw storageError;
    }

    // 스토리지 레코드가 없으면 생성
    if (!storage) {
      const { data: userData } = await supabase
        .from('user')
        .select('id')
        .eq('id', userId)
        .single();

      if (!userData) {
        return NextResponse.json({
          success: false,
          error: '사용자를 찾을 수 없습니다'
        }, { status: 404 });
      }

      // 사용자 구독 정보를 확인하여 스토리지 제한 설정
      const { data: subscription } = await supabase
        .from('subscription')
        .select('plan')
        .eq('userId', userId)
        .single();

      let maxBytes = 1073741824; // 1GB default
      switch (subscription?.plan) {
        case 'FREE': maxBytes = 104857600; break; // 100MB
        case 'PRO': maxBytes = 5368709120; break; // 5GB
        case 'PREMIUM': maxBytes = 21474836480; break; // 20GB
        case 'ADMIN': maxBytes = 107374182400; break; // 100GB
      }

      const { data: newStorage, error: insertError } = await supabase
        .from('user_storage')
        .insert({
          userId,
          used_bytes: 0,
          max_bytes: maxBytes,
          file_count: 0
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      storage = newStorage;
    }

    // 스토리지 사용량 계산
    let newUsedBytes = storage.used_bytes;
    let newFileCount = storage.file_count || 0;

    if (operation === 'add' && fileSize) {
      // 스토리지 제한 확인
      if (newUsedBytes + fileSize > storage.max_bytes) {
        return NextResponse.json({
          success: false,
          error: '스토리지 제한 초과',
          data: {
            currentUsage: newUsedBytes,
            limit: storage.max_bytes,
            requested: fileSize,
            available: storage.max_bytes - newUsedBytes
          }
        }, { status: 413 });
      }

      newUsedBytes += fileSize;
      newFileCount += 1;
    } else if (operation === 'remove' && fileSize) {
      newUsedBytes = Math.max(0, newUsedBytes - fileSize);
      newFileCount = Math.max(0, newFileCount - 1);
    }

    // 스토리지 정보 업데이트
    const { data: updatedStorage, error: updateError } = await supabase
      .from('user_storage')
      .update({
        used_bytes: newUsedBytes,
        file_count: newFileCount,
        updated_at: new Date().toISOString()
      })
      .eq('userId', userId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // user_usage_cache도 업데이트
    await supabase
      .from('user_usage_cache')
      .upsert({
        user_id: userId,
        storage_used_bytes: newUsedBytes,
        storage_limit_bytes: storage.max_bytes,
        updated_at: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      storage: updatedStorage,
      message: '스토리지 사용량이 업데이트되었습니다'
    });

  } catch (error) {
    console.error('스토리지 추적 오류:', error);
    return NextResponse.json({
      success: false,
      error: '스토리지 추적 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}

// GET: 전체 스토리지 사용량 현황 조회
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

    // 전체 스토리지 사용량 통계
    const { data: storageStats } = await supabase
      .from('user_storage')
      .select('used_bytes, max_bytes, file_count, userId, user(email, name)');

    // 사용량이 높은 상위 10명
    const topUsers = (storageStats || [])
      .sort((a, b) => b.used_bytes - a.used_bytes)
      .slice(0, 10);

    // 전체 통계 계산
    const totalUsed = (storageStats || []).reduce((sum, s) => sum + s.used_bytes, 0);
    const totalLimit = (storageStats || []).reduce((sum, s) => sum + s.max_bytes, 0);
    const totalFiles = (storageStats || []).reduce((sum, s) => sum + (s.file_count || 0), 0);

    // 사용률 90% 이상인 사용자
    const criticalUsers = (storageStats || []).filter(s => 
      s.max_bytes > 0 && (s.used_bytes / s.max_bytes) > 0.9
    );

    return NextResponse.json({
      success: true,
      summary: {
        totalUsers: (storageStats || []).length,
        totalUsedBytes: totalUsed,
        totalLimitBytes: totalLimit,
        totalFiles,
        averageUsagePercent: totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0
      },
      topUsers,
      criticalUsers,
      allUsers: storageStats
    });

  } catch (error) {
    console.error('스토리지 현황 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '스토리지 현황 조회 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}