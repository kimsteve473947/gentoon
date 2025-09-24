import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db/prisma";
import { tokenManager } from "@/lib/subscription/token-manager";
import { ApiResponse, ApiResponse as ApiResponseInterface } from "@/lib/auth/api-middleware";
import { ErrorCode } from "@/lib/errors/error-types";

// 구독 정보 조회
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponseInterface>> {
  try {
    const user = await getUser();
    if (!user) {
      return ApiResponse.unauthorized();
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
      try {
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
        console.log(`🆕 신규 사용자 생성 완료: ${user.id}`);
        
      } catch (createError) {
        console.error("신규 사용자 생성 실패:", createError);
        return ApiResponse.errorWithCode(
          ErrorCode.SERVER_ERROR, 
          "사용자 계정 설정 중 오류가 발생했습니다",
          String(createError)
        );
      }
    }

    try {
      const usage = await tokenManager.getBalance(dbUser.id);

      return ApiResponse.success({
        subscription: dbUser.subscription,
        usage,
      });
    } catch (balanceError) {
      console.error("토큰 잔액 조회 실패:", balanceError);
      return ApiResponse.errorWithCode(
        ErrorCode.SERVER_ERROR,
        "토큰 잔액 조회 중 오류가 발생했습니다",
        String(balanceError)
      );
    }
    
  } catch (error) {
    console.error("Get subscription error:", error);
    return ApiResponse.errorWithCode(
      ErrorCode.SERVER_ERROR,
      "구독 정보 조회 중 오류가 발생했습니다",
      String(error)
    );
  }
}