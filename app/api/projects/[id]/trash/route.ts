import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 🗑️ 프로젝트를 휴지통으로 이동 (소프트 삭제)
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

    console.log(`🗑️ [Trash] 프로젝트 ${projectId} 휴지통 이동 요청 (사용자: ${user.id.slice(0, 8)}...)`);

    // 프로젝트 소유권 확인
    const { data: project, error: fetchError } = await supabase
      .from('project')
      .select('id, userId, title')
      .eq('id', projectId)
      .eq('userId', user.id)
      .is('deletedAt', null)
      .single();

    if (fetchError || !project) {
      console.error('❌ [Trash] 프로젝트 조회 실패:', fetchError);
      return NextResponse.json(
        { success: false, error: "프로젝트를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 🗑️ 소프트 삭제: deletedAt 필드에 현재 시간 설정 (updatedAt은 제외)
    const deletedAt = new Date().toISOString();
    
    const { error: updateError } = await supabase
      .from('project')
      .update({ 
        deletedAt
      })
      .eq('id', projectId)
      .eq('userId', user.id);

    if (updateError) {
      console.error('❌ [Trash] 소프트 삭제 실패:', updateError);
      return NextResponse.json(
        { success: false, error: "휴지통 이동 중 오류가 발생했습니다" },
        { status: 500 }
      );
    }

    console.log(`✅ [Trash] 프로젝트 "${project.title}" 휴지통 이동 완료`);
    
    return NextResponse.json({
      success: true,
      message: "프로젝트가 휴지통으로 이동되었습니다",
      deletedAt,
      autoDeleteDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30일 후
    });

  } catch (error) {
    console.error('❌ [Trash] 예외 발생:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: "휴지통 이동 중 서버 오류가 발생했습니다",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}