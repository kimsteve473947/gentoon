import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaymentHistory } from "@/lib/payments/toss-billing-supabase";

// API 라우트 설정 - 최대 실행 시간을 10분으로 확장
export const maxDuration = 600; // 초 단위

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { exportData } = body;

    // 내보낼 데이터 수집
    const exportResult: any = {};

    if (exportData.profile) {
      // 프로필 정보
      exportResult.profile = {
        id: user.id,
        email: user.email,
        metadata: user.user_metadata,
        createdAt: user.created_at,
        lastSignIn: user.last_sign_in_at
      };
    }

    if (exportData.projects) {
      // 프로젝트 데이터
      const { data: projects } = await supabase
        .from('project')
        .select('*')
        .eq('userId', user.id)
        .is('deletedAt', null);
      
      exportResult.projects = projects || [];
    }

    if (exportData.characters) {
      // 캐릭터 데이터
      const { data: characters } = await supabase
        .from('character')
        .select('*')
        .eq('userId', user.id);
      
      exportResult.characters = characters || [];
    }

    if (exportData.generations) {
      // 생성 이미지 데이터
      const { data: generations } = await supabase
        .from('generation')
        .select('*')
        .eq('userId', user.id)
        .order('createdAt', { ascending: false })
        .limit(1000); // 최대 1000개로 제한
      
      exportResult.generations = generations || [];
    }

    if (exportData.usage) {
      // 사용량 데이터
      const { data: tokenUsage } = await supabase
        .from('token_usage')
        .select('*')
        .eq('userId', user.id)
        .order('created_at', { ascending: false });

      const { data: usageCache } = await supabase
        .from('user_usage_cache')
        .select('*')
        .eq('user_id', user.id)
        .single();

      exportResult.usage = {
        tokenUsage: tokenUsage || [],
        summary: usageCache
      };
    }

    if (exportData.payments) {
      // 결제 내역
      const paymentHistory = await getPaymentHistory(user.id, 100);
      
      const { data: subscription } = await supabase
        .from('subscription')
        .select('*')
        .eq('userId', user.id)
        .single();

      exportResult.payments = {
        history: paymentHistory,
        subscription: subscription
      };
    }

    // 내보내기 기록 저장
    await supabase
      .from('user_export_history')
      .insert({
        user_id: user.id,
        export_type: Object.keys(exportData).filter(key => exportData[key]).join(','),
        status: 'completed',
        file_size: JSON.stringify(exportResult).length,
        created_at: new Date().toISOString()
      });

    // 실제로는 파일로 저장하고 다운로드 링크 제공
    return NextResponse.json({
      success: true,
      data: exportResult,
      message: "데이터 내보내기가 완료되었습니다."
    });

  } catch (error) {
    console.error("Export data error:", error);
    return NextResponse.json(
      { success: false, error: "데이터 내보내기 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 내보내기 기록 조회
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

    const { data: exportHistory } = await supabase
      .from('user_export_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      success: true,
      data: exportHistory || []
    });

  } catch (error) {
    console.error("Get export history error:", error);
    return NextResponse.json(
      { success: false, error: "내보내기 기록 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}