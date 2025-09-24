import { NextRequest, NextResponse } from "next/server";
import { processRecurringPayments } from "@/lib/payments/toss-billing-v2";

export async function POST(req: NextRequest) {
  try {
    // Vercel Cron의 Authorization 헤더 검증
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Starting recurring payment processing...");
    const results = await processRecurringPayments();
    
    const successCount = results.filter(r => r.status === 'success').length;
    const failCount = results.filter(r => r.status === 'failed').length;
    
    console.log(`Recurring payment processing completed: ${successCount} success, ${failCount} failed`);
    
    return NextResponse.json({
      success: true,
      processed: results.length,
      successful: successCount,
      failed: failCount,
      results: results,
    });
  } catch (error) {
    console.error("Recurring payment cron job error:", error);
    return NextResponse.json(
      { error: "정기결제 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// GET 요청으로 수동 실행도 가능 (개발용)
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: "Development only" }, { status: 403 });
  }
  
  return POST(req);
}