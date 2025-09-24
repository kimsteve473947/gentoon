import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db/prisma'
import { ApiResponse, ApiResponse as ApiResponseInterface } from '@/lib/auth/api-middleware'
import { ErrorCode } from '@/lib/errors/error-types'

// Gemini 2.5 Flash 실제 토큰 소비량
const GEMINI_COST = {
  TOKENS_PER_IMAGE: 1290, // 실제 Gemini API 평균 토큰 사용량
} as const;

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponseInterface>> {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return ApiResponse.unauthorized()
    }

    // Get user's subscription info from Prisma
    let userSubscription;
    try {
      userSubscription = await prisma.user.findUnique({
        where: {
          id: user.id
        },
        include: {
          subscription: true
        }
      })
    } catch (dbError) {
      console.error('사용자 구독 정보 조회 실패:', dbError);
      return ApiResponse.errorWithCode(
        ErrorCode.SERVER_ERROR,
        "사용자 구독 정보 조회 중 오류가 발생했습니다",
        String(dbError)
      );
    }

    if (!userSubscription || !userSubscription.subscription) {
      // Create default subscription for new users
      try {
        const newSubscription = await prisma.subscription.create({
          data: {
            userId: userSubscription?.id || user.id,
            plan: 'FREE',
            tokensTotal: 10000, // FREE 플랜: 10,000 토큰 (약 7-8장 이미지 생성 가능)
            tokensUsed: 0,
            maxCharacters: 1,
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
          }
        })
        
        console.log(`🆕 신규 사용자 기본 구독 생성: ${user.id}`);
        
        return ApiResponse.success({
          tokensTotal: newSubscription.tokensTotal,
          tokensUsed: newSubscription.tokensUsed,
          tokensRemaining: newSubscription.tokensTotal - newSubscription.tokensUsed,
          plan: newSubscription.plan,
          dailyUsed: 0,
          dailyLimit: 10,
          estimatedImagesRemaining: Math.floor((newSubscription.tokensTotal - newSubscription.tokensUsed) / GEMINI_COST.TOKENS_PER_IMAGE)
        });
      } catch (createError) {
        console.error('기본 구독 생성 실패:', createError);
        return ApiResponse.errorWithCode(
          ErrorCode.SERVER_ERROR,
          "사용자 계정 초기화 중 오류가 발생했습니다",
          String(createError)
        );
      }
    }

    const subscription = userSubscription.subscription

    // Calculate daily usage
    let dailyUsed = 0;
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const dailyUsage = await prisma.generation.aggregate({
        where: {
          userId: userSubscription.id,
          createdAt: {
            gte: today
          }
        },
        _sum: {
          tokensUsed: true
        }
      })

      dailyUsed = dailyUsage._sum.tokensUsed || 0;
    } catch (dailyError) {
      console.warn('일일 사용량 조회 실패 (기본값 사용):', dailyError);
      // 일일 사용량 조회 실패는 치명적이지 않으므로 기본값으로 계속 진행
      dailyUsed = 0;
    }

    const dailyLimit = subscription.plan === 'FREE' ? 10 : 
                     subscription.plan === 'PRO' ? 100 : 
                     subscription.plan === 'PREMIUM' ? 500 : 10

    return ApiResponse.success({
      tokensTotal: subscription.tokensTotal,
      tokensUsed: subscription.tokensUsed,
      tokensRemaining: subscription.tokensTotal - subscription.tokensUsed,
      plan: subscription.plan,
      dailyUsed,
      dailyLimit,
      estimatedImagesRemaining: Math.floor((subscription.tokensTotal - subscription.tokensUsed) / GEMINI_COST.TOKENS_PER_IMAGE)
    });

  } catch (error) {
    console.error('Token balance API error:', error)
    
    // 예상치 못한 에러에 대해서도 안전한 기본값 제공
    return ApiResponse.errorWithCode(
      ErrorCode.SERVER_ERROR,
      "토큰 잔액 조회 중 오류가 발생했습니다",
      String(error)
    );
  }
}