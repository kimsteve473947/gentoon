import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db/prisma'

// Gemini 2.5 Flash 실제 토큰 소비량
const GEMINI_COST = {
  TOKENS_PER_IMAGE: 1290, // 실제 Gemini API 평균 토큰 사용량
} as const;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's subscription info from Prisma
    const userSubscription = await prisma.user.findUnique({
      where: {
        id: user.id
      },
      include: {
        subscription: true
      }
    })

    if (!userSubscription || !userSubscription.subscription) {
      // Create default subscription for new users
      const newSubscription = await prisma.subscription.create({
        data: {
          userId: userSubscription?.id || '',
          plan: 'FREE',
          tokensTotal: 10000, // FREE 플랜: 10,000 토큰 (약 7-8장 이미지 생성 가능)
          tokensUsed: 0,
          maxCharacters: 1,
          maxProjects: 3,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        }
      })
      
      return NextResponse.json({
        tokensTotal: newSubscription.tokensTotal,
        tokensUsed: newSubscription.tokensUsed,
        tokensRemaining: newSubscription.tokensTotal - newSubscription.tokensUsed,
        plan: newSubscription.plan,
        dailyUsed: 0,
        dailyLimit: 10,
        estimatedImagesRemaining: Math.floor((newSubscription.tokensTotal - newSubscription.tokensUsed) / GEMINI_COST.TOKENS_PER_IMAGE)
      })
    }

    const subscription = userSubscription.subscription

    // Calculate daily usage
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

    const dailyUsed = dailyUsage._sum.tokensUsed || 0
    const dailyLimit = subscription.plan === 'FREE' ? 10 : 
                     subscription.plan === 'PRO' ? 100 : 
                     subscription.plan === 'PREMIUM' ? 500 : 10

    return NextResponse.json({
      tokensTotal: subscription.tokensTotal,
      tokensUsed: subscription.tokensUsed,
      tokensRemaining: subscription.tokensTotal - subscription.tokensUsed,
      plan: subscription.plan,
      dailyUsed,
      dailyLimit,
      estimatedImagesRemaining: Math.floor((subscription.tokensTotal - subscription.tokensUsed) / GEMINI_COST.TOKENS_PER_IMAGE)
    })

  } catch (error) {
    console.error('Token balance API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        tokensTotal: 0,
        tokensUsed: 0,
        tokensRemaining: 0,
        plan: 'FREE',
        dailyUsed: 0,
        dailyLimit: 10,
        estimatedImagesRemaining: 0
      }, 
      { status: 500 }
    )
  }
}