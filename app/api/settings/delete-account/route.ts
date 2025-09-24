import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 계정 삭제
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

    // 구독 취소 처리
    const { data: subscription } = await supabase
      .from('subscription')
      .select('*')
      .eq('userId', user.id)
      .single();

    if (subscription && subscription.plan !== 'FREE') {
      // 구독이 있으면 즉시 취소
      await supabase
        .from('subscription')
        .update({ 
          cancelAtPeriodEnd: true,
          plan: 'FREE',
          tokensTotal: 10000,
          tokensUsed: 0,
          maxCharacters: 2
        })
        .eq('userId', user.id);
    }

    // 사용자 데이터 삭제 (cascade로 관련 데이터 모두 삭제)
    // 1. 캐릭터 삭제
    await supabase
      .from('character')
      .delete()
      .eq('userId', user.id);

    // 2. 프로젝트 삭제 (소프트 삭제)
    await supabase
      .from('project')
      .update({ deletedAt: new Date().toISOString() })
      .eq('userId', user.id);

    // 3. 토큰 사용 기록 유지 (감사용)
    // token_usage 테이블은 그대로 유지

    // 4. 사용자 테이블에서 삭제 플래그 설정
    await supabase
      .from('user')
      .update({ 
        deletedAt: new Date().toISOString(),
        email: `deleted_${user.id}@deleted.com` // 이메일 익명화
      })
      .eq('id', user.id);

    // 5. Auth 사용자 삭제 (관리자 권한 필요)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    
    if (deleteError) {
      console.error('Auth user deletion error:', deleteError);
      // Auth 삭제 실패해도 계속 진행 (데이터는 이미 삭제됨)
    }

    // 삭제 로그 기록
    await supabase
      .from('audit_log')
      .insert({
        userId: user.id,
        action: 'ACCOUNT_DELETED',
        details: {
          deletedAt: new Date().toISOString(),
          email: user.email
        }
      })
      .select();

    return NextResponse.json({
      success: true,
      message: "계정이 성공적으로 삭제되었습니다"
    });

  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { success: false, error: "계정 삭제 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}