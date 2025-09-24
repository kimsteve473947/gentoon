import { NextRequest, NextResponse } from "next/server";
import { processRecurringPayments } from "@/lib/payments/toss-billing-v2";

// Vercel Cron Job 또는 외부 스케줄러에서 호출
// 매일 오전 2시에 실행 권장
export async function GET(req: NextRequest) {
  try {
    // Cron Secret 검증 (프로덕션 환경에서 필수)
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (process.env.NODE_ENV === "production") {
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    console.log("Starting recurring payment processing...");
    
    // 자동 결제 처리
    const results = await processRecurringPayments();
    
    const successCount = results.filter(r => r.status === "success").length;
    const failedCount = results.filter(r => r.status === "failed").length;
    
    console.log(`Recurring payments processed: ${successCount} success, ${failedCount} failed`);
    
    return NextResponse.json({
      success: true,
      processed: results.length,
      successful: successCount,
      failed: failedCount,
      results,
    });
  } catch (error) {
    console.error("Cron billing error:", error);
    return NextResponse.json(
      { 
        error: "Failed to process recurring payments",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// 수동 실행을 위한 POST 엔드포인트
export async function POST(req: NextRequest) {
  try {
    // 관리자 권한 확인 (JSON 파싱 오류 방지)
    let adminKey;
    try {
      const body = await req.json();
      adminKey = body.adminKey;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }
    
    if (!adminKey || adminKey !== process.env.ADMIN_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const results = await processRecurringPayments();
    
    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Manual billing error:", error);
    return NextResponse.json(
      { error: "Failed to process payments" },
      { status: 500 }
    );
  }
}