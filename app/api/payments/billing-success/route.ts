import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { 
  issueBillingKey, 
  TossPaymentsError,
  SUBSCRIPTION_PLANS 
} from "@/lib/payments/toss-billing-supabase";
import { changePlan } from "@/lib/subscription/subscription-manager";
import { logPaymentActivity, logSubscriptionActivity } from "@/lib/logging/activity-logger";
import { cashReceiptAutomationService } from "@/lib/payments/cash-receipt-automation";
import { type PlanType } from "@/lib/subscription/plan-config";

// 빌링키 발급 성공 처리 (v2 API)
export async function GET(req: NextRequest) {
  try {
    console.log("🎯 Billing success endpoint called");
    const searchParams = req.nextUrl.searchParams;
    const authKey = searchParams.get("authKey");
    
    // customerKey가 중복될 수 있으므로 모든 값을 가져와서 처리
    const allCustomerKeys = searchParams.getAll("customerKey");
    const customerKey = allCustomerKeys.length > 0 ? allCustomerKeys[0] : null;
    
    const planId = searchParams.get("planId");
    const amount = searchParams.get("amount");
    const paymentMethod = searchParams.get("paymentMethod");

    console.log("📋 Received parameters:", { 
      authKey, 
      customerKey, 
      allCustomerKeys: allCustomerKeys.length > 1 ? allCustomerKeys : undefined,
      planId, 
      amount 
    });

    if (!authKey || !customerKey || !planId) {
      console.error("❌ Missing required parameters");
      return NextResponse.json(
        { error: "필수 파라미터가 누락되었습니다" },
        { status: 400 }
      );
    }

    // planId 검증
    if (!SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS]) {
      return NextResponse.json(
        { error: "잘못된 플랜 ID입니다" },
        { status: 400 }
      );
    }

    // customerKey에서 userId 추출 (여러 패턴 지원)
    console.log(`🔍 Raw customerKey received: "${customerKey}"`);
    
    let userId: string;
    
    // 패턴 1: customer_userId_timestamp (Settings에서 사용)
    const timestampPattern = customerKey.match(/^customer_(.+)_\d+$/);
    if (timestampPattern) {
      userId = timestampPattern[1];
      console.log(`📋 Pattern 1 (with timestamp): userId = ${userId}`);
    } else {
      // 패턴 2: customer_userId (일반적인 경우)
      userId = customerKey.replace("customer_", "");
      console.log(`📋 Pattern 2 (simple): userId = ${userId}`);
    }
    
    console.log(`👤 Final extracted userId: ${userId}`);

    // Supabase 클라이언트 생성 (Service Role 사용)
    console.log(`🔧 Creating service role client for user verification`);
    
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("❌ SUPABASE_SERVICE_ROLE_KEY not found in environment");
      return NextResponse.json(
        { success: false, error: "서버 설정 오류", code: "SERVER_CONFIG_ERROR" },
        { status: 500 }
      );
    }

    const { createClient: createServiceClient } = await import('@supabase/supabase-js');
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log(`🔧 Service Supabase client created successfully`);

    // 사용자 확인 (Service Role 사용) - 먼저 단순 조회
    console.log(`🔍 Looking up user with ID: ${userId}`);
    const { data: user, error: userError } = await serviceSupabase
      .from('user')
      .select('*')
      .eq('id', userId)
      .single();
      
    console.log(`📊 User query result:`, { user: user ? 'found' : 'not found', error: userError });

    if (userError) {
      console.error("❌ User lookup error:", userError);
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    if (!user) {
      console.error("❌ User not found");
      return NextResponse.json(
        { success: false, error: "사용자를 찾을 수 없습니다", code: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    console.log(`✅ User found: ${user.id}`);

    // 빌링키 발급
    const { billingKey, card } = await issueBillingKey(authKey, customerKey);
    
    console.log(`✅ Billing key issued for user ${userId}, plan: ${planId}`);

    // 🎯 새로운 완벽한 플랜 변경 시스템 사용
    const discountedAmount = amount ? parseInt(amount) : undefined;
    const planChangeResult = await changePlan(
      userId,
      planId as PlanType,
      billingKey,
      customerKey,
      paymentMethod,
      discountedAmount,
      false, // 일반 사용자 결제
      card // 카드 정보 전달
    );
    
    if (!planChangeResult.success) {
      console.error('❌ 플랜 변경 실패:', planChangeResult.error);
      throw new Error(planChangeResult.error || '플랜 변경 중 오류가 발생했습니다.');
    }
    
    console.log('✅ 플랜 변경 성공:', {
      changeType: planChangeResult.changeType,
      previousPlan: planChangeResult.previousPlan,
      newPlan: planChangeResult.newPlan,
      amountCharged: planChangeResult.amountCharged,
    });

    // 🚀 활동 로깅 - 결제 성공 및 구독 변경
    const planPrice = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS].price;
    const finalAmount = discountedAmount || planPrice;
    
    try {
      await logPaymentActivity(userId, 'success', finalAmount, `${planId} 플랜`, planChangeResult.paymentKey);
      
      const activityType = planChangeResult.changeType === 'upgrade' ? 'upgraded' : 
                          planChangeResult.changeType === 'downgrade' ? 'downgraded' : 'subscribed';
      await logSubscriptionActivity(userId, activityType, `${planId} 플랜`, finalAmount);
      
      console.log('✅ 활동 로깅 완료');
    } catch (loggingError) {
      // 로깅 오류는 결제 성공에 영향을 주지 않음
      console.error('활동 로깅 오류:', loggingError);
    }

    // 🧾 현금영수증 자동 처리 (토스페이먼츠 공식 가이드 준수)
    if (planChangeResult.paymentKey) {
      try {
        console.log('💳 현금영수증 처리 시작 - 토스페이먼츠 가맹점 자동 발급 확인');
        
        // 토스페이먼츠 가맹점의 경우 자동 발급되므로 별도 처리 불필요
        // 사용자가 별도 현금영수증 설정한 경우에만 우리 시스템으로 처리
        await cashReceiptAutomationService.processPaymentCompletedForCashReceipt(planChangeResult.paymentKey);
        console.log(`✅ 현금영수증 처리 완료: ${planChangeResult.paymentKey}`);
      } catch (cashReceiptError) {
        // 현금영수증 오류는 결제 성공에 영향을 주지 않음
        console.error('현금영수증 처리 오류 (가맹점 자동 발급으로 인해 정상적일 수 있음):', cashReceiptError);
      }
    }

    // 성공 페이지로 리다이렉트
    return NextResponse.redirect(
      new URL("/pricing/success", req.nextUrl.origin)
    );
  } catch (error) {
    console.error("Billing success error:", error);
    
    // 사용자 친화적 에러 메시지로 리다이렉트
    const errorMessage = error instanceof TossPaymentsError 
      ? error.getUserFriendlyMessage()
      : "결제 처리 중 오류가 발생했습니다";
    
    return NextResponse.redirect(
      new URL(`/pricing/error?message=${encodeURIComponent(errorMessage)}`, req.nextUrl.origin)
    );
  }
}