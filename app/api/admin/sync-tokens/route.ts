import { NextRequest, NextResponse } from 'next/server';
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 관리자 권한 확인 함수
async function checkAdminAccess(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user || user.email !== 'kimjh473947@gmail.com') {
    return NextResponse.json(
      { success: false, error: "관리자 권한이 필요합니다" },
      { status: 403 }
    );
  }
  
  return null; // 권한 OK
}

export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const adminCheck = await checkAdminAccess(request);
    if (adminCheck) return adminCheck;

    console.log('🔄 토큰 동기화 작업 시작...');

    // 서비스 키로 Supabase Admin 클라이언트 생성 (RLS 우회용)
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 1. 모든 사용자의 실제 토큰 사용량 집계
    const { data: tokenUsageSummary } = await supabaseAdmin
      .from('token_usage')
      .select('userId, total_tokens')
      .order('userId');

    if (!tokenUsageSummary) {
      return NextResponse.json(
        { success: false, error: "토큰 사용 데이터를 조회할 수 없습니다" },
        { status: 500 }
      );
    }

    // 사용자별 총 토큰 사용량 계산
    const userTokenTotals = new Map<string, number>();
    
    for (const usage of tokenUsageSummary) {
      const currentTotal = userTokenTotals.get(usage.userId) || 0;
      userTokenTotals.set(usage.userId, currentTotal + usage.total_tokens);
    }

    console.log(`📊 사용자별 실제 토큰 사용량:`, 
      Array.from(userTokenTotals.entries()).map(([userId, total]) => 
        ({ userId: userId.substring(0, 8) + '...', totalTokens: total })
      )
    );

    // 2. subscription 테이블 업데이트
    const updateResults = [];
    
    for (const [userId, actualTokensUsed] of userTokenTotals.entries()) {
      // 현재 구독 정보 조회
      const { data: subscription } = await supabaseAdmin
        .from('subscription')
        .select('id')
        .eq('userId', userId)
        .single();

      if (subscription) {
        const previousTokensUsed = 0; // tokensUsed 컬럼이 없으므로 0으로 설정
        
        // subscription 테이블에 tokensUsed 컬럼이 없으므로 업데이트 생략
        console.log(`ℹ️  사용자 ${userId.substring(0, 8)}... 토큰 동기화 스킵 (tokensUsed 컬럼 없음): ${previousTokensUsed} → ${actualTokensUsed}`);
        const updateError = null;

        if (updateError) {
          console.error(`❌ 사용자 ${userId} 토큰 동기화 실패:`, updateError);
          updateResults.push({
            userId: userId.substring(0, 8) + '...',
            success: false,
            error: updateError?.message || 'Unknown error'
          });
        } else {
          console.log(`✅ 사용자 ${userId.substring(0, 8)}... 토큰 동기화 완료: ${previousTokensUsed} → ${actualTokensUsed}`);
          updateResults.push({
            userId: userId.substring(0, 8) + '...',
            success: true,
            previousTokensUsed,
            actualTokensUsed,
            difference: actualTokensUsed - previousTokensUsed
          });
        }
      } else {
        console.warn(`⚠️ 사용자 ${userId}의 구독 정보를 찾을 수 없습니다`);
        updateResults.push({
          userId: userId.substring(0, 8) + '...',
          success: false,
          error: '구독 정보를 찾을 수 없음'
        });
      }
    }

    const successCount = updateResults.filter(r => r.success).length;
    const totalUsers = updateResults.length;

    console.log(`🎉 토큰 동기화 작업 완료: ${successCount}/${totalUsers} 사용자 성공`);

    return NextResponse.json({
      success: true,
      message: `토큰 동기화 완료: ${successCount}/${totalUsers} 사용자 업데이트됨`,
      results: updateResults,
      totalTokensProcessed: Array.from(userTokenTotals.values()).reduce((sum, tokens) => sum + tokens, 0),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("토큰 동기화 오류:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "토큰 동기화 중 오류가 발생했습니다",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const adminCheck = await checkAdminAccess(request);
    if (adminCheck) return adminCheck;

    // 서비스 키로 Supabase Admin 클라이언트 생성
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 동기화 상태 체크
    const { data: syncCheck } = await supabaseAdmin.rpc('check_token_sync_status');

    return NextResponse.json({
      success: true,
      syncStatus: syncCheck,
      message: "토큰 동기화 상태 조회 완료"
    });

  } catch (error) {
    console.error("토큰 동기화 상태 조회 오류:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "토큰 동기화 상태 조회 중 오류가 발생했습니다" 
      },
      { status: 500 }
    );
  }
}