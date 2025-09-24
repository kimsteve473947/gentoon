import { NextRequest, NextResponse } from "next/server";
import { batchCheckAndResetTokens } from "@/lib/subscription/token-reset";

export async function POST(request: NextRequest) {
  try {
    // 보안을 위해 Authorization 헤더 체크
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log('Starting batch token reset cron job...');
    const startTime = Date.now();

    // 배치 토큰 리셋 실행
    const resetCount = await batchCheckAndResetTokens();

    const duration = Date.now() - startTime;
    console.log(`Batch token reset completed. Reset ${resetCount} subscriptions in ${duration}ms`);

    return NextResponse.json({
      success: true,
      data: {
        resetCount,
        duration,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Cron job error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// GET 요청으로도 실행 가능 (Vercel Cron Jobs 지원)
export async function GET(request: NextRequest) {
  return POST(request);
}