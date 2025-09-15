import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { storageTracker } from '@/lib/storage/real-time-tracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 🔄 사용자 스토리지 사용량 재계산 API (기존 데이터 복구용)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 현재 사용자 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    console.log(`🔄 [Recalculate] 사용자 ${user.id.slice(0, 8)}... 스토리지 재계산 요청`);

    // 🚀 실시간 트래커를 사용해서 전체 스토리지 재계산
    await storageTracker.recalculateUserStorage(user.id);

    // 재계산 후 결과 조회
    const { data: updatedStorage } = await supabase
      .from('user_storage')
      .select('used_bytes, file_count, max_bytes')
      .eq('userId', user.id)
      .single();

    const usagePercentage = updatedStorage?.max_bytes > 0 
      ? Math.round((updatedStorage.used_bytes / updatedStorage.max_bytes) * 100)
      : 0;

    console.log(`✅ [Recalculate] 재계산 완료: ${updatedStorage?.used_bytes} bytes, ${updatedStorage?.file_count} files (${usagePercentage}%)`);

    return NextResponse.json({
      success: true,
      message: "스토리지 사용량이 재계산되었습니다",
      storage: {
        used_bytes: updatedStorage?.used_bytes || 0,
        file_count: updatedStorage?.file_count || 0,
        max_bytes: updatedStorage?.max_bytes || 1024 * 1024 * 1024,
        usage_percentage: usagePercentage
      }
    });

  } catch (error) {
    console.error('❌ [Recalculate] 스토리지 재계산 실패:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: "스토리지 재계산 중 서버 오류가 발생했습니다",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}