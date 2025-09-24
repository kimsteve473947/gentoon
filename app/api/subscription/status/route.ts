import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db/prisma";
import { PLAN_CONFIGS, getPlanConfig } from "@/lib/subscription/plan-config";

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
      const freeConfig = PLAN_CONFIGS.FREE;
      const freeSubscription = await prisma.subscription.create({
        data: {
          userId: dbUser.id,
          plan: "FREE",
          tokensTotal: freeConfig.platformTokens,
          tokensUsed: 0,
          maxCharacters: freeConfig.maxCharacters,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1년 후
        },
      });

      return NextResponse.json({
        success: true,
        subscription: {
          ...freeSubscription,
          planInfo: freeConfig,
        },
      });
    }

    const subscription = dbUser.subscription;
    const planInfo = getPlanConfig(subscription.plan as any);

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