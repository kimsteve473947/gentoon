import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db/prisma";
import { SUBSCRIPTION_PLANS } from "@/lib/payments/toss-billing-v2";

export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    // 사용자 정보 조회
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        subscription: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: "사용자 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 구독이 없으면 FREE 플랜으로 생성
    if (!dbUser.subscription) {
      const freeSubscription = await prisma.subscription.create({
        data: {
          userId: dbUser.id,
          plan: "FREE",
          tokensTotal: 10000, // FREE 플랜: 10,000 토큰 (약 7-8장 이미지 생성 가능)
          tokensUsed: 0,
          maxCharacters: 1,
          maxProjects: 3,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1년 후
        },
      });

      return NextResponse.json({
        success: true,
        subscription: {
          ...freeSubscription,
          planInfo: SUBSCRIPTION_PLANS.FREE,
        },
      });
    }

    const subscription = dbUser.subscription;
    const planInfo = SUBSCRIPTION_PLANS[subscription.plan as keyof typeof SUBSCRIPTION_PLANS];

    return NextResponse.json({
      success: true,
      subscription: {
        ...subscription,
        planInfo,
        remainingTokens: subscription.tokensTotal - subscription.tokensUsed,
        daysUntilRenewal: subscription.currentPeriodEnd 
          ? Math.ceil((subscription.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
      },
    });
  } catch (error) {
    console.error("Get subscription status error:", error);
    return NextResponse.json(
      { error: "구독 상태 조회 실패" },
      { status: 500 }
    );
  }
}