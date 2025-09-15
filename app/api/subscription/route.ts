import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db/prisma";
import { tokenManager } from "@/lib/subscription/token-manager";

// 구독 정보 조회
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
    let dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        subscription: true,
      },
    });

    if (!dbUser) {
      // 신규 사용자 생성
      const newUser = await prisma.user.create({
        data: {
          id: user.id,
          email: user.email || "",
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || "사용자",
          imageUrl: user.user_metadata?.avatar_url,
          subscription: {
            create: {
              plan: "FREE",
              tokensTotal: 10000, // FREE 플랜: 10,000 토큰 (약 7-8장 이미지 생성 가능)
              tokensUsed: 0,
              maxCharacters: 1,
              maxProjects: 3,
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
        include: {
          subscription: true,
        },
      });
      
      dbUser = newUser;

    }

    const usage = await tokenManager.getBalance(dbUser.id);

    return NextResponse.json({
      subscription: dbUser.subscription,
      usage,
    });
  } catch (error) {
    console.error("Get subscription error:", error);
    return NextResponse.json(
      { error: "구독 정보 조회 실패" },
      { status: 500 }
    );
  }
}