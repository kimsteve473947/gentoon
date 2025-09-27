import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 개발 환경에서만 사용 가능한 스키마 확인 API
export async function GET(req: NextRequest) {
  // 프로덕션 환경에서는 접근 차단
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: "프로덕션 환경에서는 사용할 수 없습니다" },
      { status: 403 }
    );
  }

  try {
    const supabase = await createClient();
    
    // subscription 테이블에서 하나의 레코드 조회 (스키마 확인용)
    const { data: subscriptions, error } = await supabase
      .from('subscription')
      .select('*')
      .limit(1);

    if (error) {
      return NextResponse.json({
        success: false,
        error: "subscription 테이블 조회 실패",
        details: error,
        message: "테이블이 존재하지 않거나 접근 권한이 없습니다"
      });
    }

    // 컬럼 정보 확인
    const sampleRecord = subscriptions?.[0];
    const availableColumns = sampleRecord ? Object.keys(sampleRecord) : [];
    
    return NextResponse.json({
      success: true,
      table: 'subscription',
      recordCount: subscriptions?.length || 0,
      availableColumns,
      hasPaymentMethod: availableColumns.includes('paymentMethod'),
      sampleRecord: sampleRecord ? 
        Object.fromEntries(
          Object.entries(sampleRecord).map(([key, value]) => [key, typeof value])
        ) : null
    });
  } catch (error) {
    console.error("스키마 확인 오류:", error);
    return NextResponse.json(
      { 
        error: "스키마 확인 중 오류가 발생했습니다",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}