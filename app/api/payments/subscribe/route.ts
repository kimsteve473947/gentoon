import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
// import TossPayments from "@tosspayments/payment-sdk";
import { prisma } from "@/lib/db/prisma";
import { SubscriptionPlan } from "@/types";

// const tossPayments = new TossPayments(process.env.TOSS_SECRET_KEY!);

// 플랜별 가격 정보
const PLAN_PRICES = {
  [SubscriptionPlan.FREE]: 0,
  [SubscriptionPlan.PRO]: 30000,
  [SubscriptionPlan.PREMIUM]: 100000,
};

const PLAN_TOKENS = {
  [SubscriptionPlan.FREE]: 10,
  [SubscriptionPlan.PRO]: 500000,
  [SubscriptionPlan.PREMIUM]: 2000000,
};

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

    const { plan, successUrl, failUrl } = await request.json();

    if (!plan || !PLAN_PRICES[plan as SubscriptionPlan]) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 플랜입니다" },
        { status: 400 }
      );
    }

    // 사용자 정보 가져오기
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: "사용자를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 주문 ID 생성
    const orderId = `ORDER_${Date.now()}_${dbUser.id}`;
    const amount = PLAN_PRICES[plan as SubscriptionPlan];

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

    // Toss Payments 결제 요청 생성
    const paymentData = {
      amount,
      orderId,
      orderName: `GenToon ${plan} 플랜 구독`,
      successUrl: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/success`,
      failUrl: failUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/fail`,
      customerEmail: dbUser.email,
      customerName: dbUser.name || "고객",
    };

    return NextResponse.json({
      success: true,
      paymentData,
      clientKey: process.env.TOSS_CLIENT_KEY,
    });

  } catch (error) {
    console.error("Subscribe API error:", error);
    return NextResponse.json(
      { success: false, error: "구독 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 구독 상태 조회
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

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        subscription: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: "사용자를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      subscription: dbUser.subscription,
    });

  } catch (error) {
    console.error("Get subscription error:", error);
    return NextResponse.json(
      { success: false, error: "구독 정보 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}