import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 🔄 프로젝트 접근 시간 업데이트 (최근 사용 순서 관리)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const projectId = id;

    // 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    // 🚀 lastEditedAt를 현재 시간으로 업데이트 (분 단위 정밀도)
    const now = new Date().toISOString();
    
    const { error: updateError } = await supabase
      .from('project')
      .update({ 
        lastEditedAt: now,
        updatedAt: now
      })
      .eq('id', projectId)
      .eq('userId', user.id)
      .is('deletedAt', null);

    if (updateError) {
      console.error('❌ [Access] 접근 시간 업데이트 실패:', updateError);
      return NextResponse.json(
        { success: false, error: "접근 시간 업데이트 실패" },
        { status: 500 }
      );
    }

    console.log(`⏰ [Access] 프로젝트 ${projectId.slice(0, 8)}... 접근 시간 업데이트`);
    
    return NextResponse.json({
      success: true,
      lastEditedAt: now
    });

  } catch (error) {
    console.error('❌ [Access] 예외 발생:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: "접근 시간 업데이트 중 서버 오류가 발생했습니다"
      },
      { status: 500 }
    );
  }
}