import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/auth";
import { createBillingAuthRequest, SUBSCRIPTION_PLANS } from "@/lib/payments/toss-billing-v2";

export async function POST(req: NextRequest) {
  try {
    const { planId } = await req.json();
    
    console.log("Received planId:", planId);

    // 플랜 ID를 대문자로 변환
    const upperPlanId = planId.toUpperCase() as keyof typeof SUBSCRIPTION_PLANS;
    
    if (!upperPlanId || !SUBSCRIPTION_PLANS[upperPlanId]) {
      return NextResponse.json(
        { error: `유효하지 않은 플랜입니다: ${planId}` },
        { status: 400 }
      );
    }

    // 로그인된 사용자 정보 가져오기
    let customerEmail = "test@example.com";
    let customerName = "테스트 고객";
    let userId = `temp_${Date.now()}`;

    try {
      const user = await getUser();
      if (user) {
        customerEmail = user.email || customerEmail;
        customerName = user.user_metadata?.full_name || user.email?.split('@')[0] || customerName;
        userId = user.id;
      }
    } catch (authError) {
      console.log("Auth error (using default values):", authError);
    }

    console.log("Using user info:", { userId, customerEmail, customerName });

    // 빌링키 등록 요청 생성
    const billingAuthRequest = await createBillingAuthRequest(
      userId,
      upperPlanId,
      customerEmail,
      customerName
    );

    console.log("Generated billingAuthRequest:", billingAuthRequest);

    return NextResponse.json({
      success: true,
      billingAuthRequest,
      planInfo: SUBSCRIPTION_PLANS[upperPlanId],
    });

  } catch (error) {
    console.error("Create payment error:", error);
    return NextResponse.json(
      { error: `결제 요청 생성 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}` },
      { status: 500 }
    );
  }
}