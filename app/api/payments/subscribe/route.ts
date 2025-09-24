import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
// import TossPayments from "@tosspayments/payment-sdk";
import { prisma } from "@/lib/db/prisma";
import { SubscriptionPlan } from "@/types";
import { ApiResponse, ApiResponse as ApiResponseInterface } from "@/lib/auth/api-middleware";
import { ErrorCode } from "@/lib/errors/error-types";
import { PLAN_CONFIGS } from "@/lib/subscription/plan-config";

// const tossPayments = new TossPayments(process.env.TOSS_SECRET_KEY!);

// plan-config.ts의 PLAN_CONFIGS 사용
const PLAN_PRICES = {
  [SubscriptionPlan.FREE]: PLAN_CONFIGS.FREE.price,
  [SubscriptionPlan.PRO]: PLAN_CONFIGS.PRO.price,
  [SubscriptionPlan.PREMIUM]: PLAN_CONFIGS.PREMIUM.price,
};

const PLAN_TOKENS = {
  [SubscriptionPlan.FREE]: PLAN_CONFIGS.FREE.platformTokens,
  [SubscriptionPlan.PRO]: PLAN_CONFIGS.PRO.platformTokens,
  [SubscriptionPlan.PREMIUM]: PLAN_CONFIGS.PREMIUM.platformTokens,
};

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponseInterface>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return ApiResponse.unauthorized();
    }

    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      return ApiResponse.badRequest("잘못된 요청 형식입니다");
    }

    const { plan, successUrl, failUrl } = requestBody;

    if (!plan || !PLAN_PRICES[plan as SubscriptionPlan]) {
      return ApiResponse.errorWithCode(ErrorCode.INVALID_PLAN);
    }

    // 사용자 정보 가져오기
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser) {
      return ApiResponse.errorWithCode(ErrorCode.USER_NOT_FOUND);
    }

    // 주문 ID 생성
    const orderId = `ORDER_${Date.now()}_${dbUser.id}`;
    const amount = PLAN_PRICES[plan as SubscriptionPlan];

    try {
      // 거래 기록 생성 (대기 상태)
      await prisma.transaction.create({
        data: {
          userId: dbUser.id,
          type: "SUBSCRIPTION",
          amount,
          tokens: PLAN_TOKENS[plan as SubscriptionPlan],
          tossOrderId: orderId,
          status: "PENDING",
          description: `${plan} 플랜 구독`,
        },
      });

      console.log(`💳 결제 요청 생성: ${plan} 플랜, 사용자: ${user.id}, 주문ID: ${orderId}`);

    } catch (transactionError) {
      console.error("거래 기록 생성 실패:", transactionError);
      return ApiResponse.errorWithCode(
        ErrorCode.PAYMENT_FAILED,
        "결제 준비 중 오류가 발생했습니다",
        String(transactionError)
      );
    }

    // 환경 변수 검증
    if (!process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY) {
      console.error("Toss Payments client key not configured");
      return ApiResponse.errorWithCode(
        ErrorCode.SERVICE_UNAVAILABLE,
        "결제 서비스 설정에 문제가 있습니다"
      );
    }

    // Toss Payments 결제 요청 생성
    const paymentData = {
      amount,
      orderId,
      orderName: `GenToon ${plan} 플랜 구독`,
      successUrl: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/billing-success`,
      failUrl: failUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/billing-fail`,
      customerEmail: dbUser.email,
      customerName: dbUser.name || "고객",
    };

    return ApiResponse.success({
      paymentData,
      clientKey: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY,
    });

  } catch (error) {
    console.error("Subscribe API error:", error);
    return ApiResponse.errorWithCode(
      ErrorCode.PAYMENT_FAILED,
      "결제 요청 처리 중 오류가 발생했습니다",
      String(error)
    );
  }
}

// 구독 상태 조회
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponseInterface>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return ApiResponse.unauthorized();
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        subscription: true,
      },
    });

    if (!dbUser) {
      return ApiResponse.errorWithCode(ErrorCode.USER_NOT_FOUND);
    }

    return ApiResponse.success({
      subscription: dbUser.subscription,
    });

  } catch (error) {
    console.error("Get subscription error:", error);
    return ApiResponse.errorWithCode(
      ErrorCode.SERVER_ERROR,
      "구독 정보 조회 중 오류가 발생했습니다",
      String(error)
    );
  }
}