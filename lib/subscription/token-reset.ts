import { createClient } from '@/lib/supabase/server';

type SubscriptionPlan = 'FREE' | 'STARTER' | 'PRO' | 'PREMIUM' | 'ADMIN';

// 중앙 설정에서 토큰 제한 가져오기
import { PLAN_CONFIGS } from '@/lib/subscription/plan-config';

export const PLAN_TOKEN_LIMITS = {
  FREE: PLAN_CONFIGS.FREE.platformTokens,
  STARTER: PLAN_CONFIGS.STARTER.platformTokens,
  PRO: PLAN_CONFIGS.PRO.platformTokens,
  PREMIUM: PLAN_CONFIGS.PREMIUM.platformTokens,
  ADMIN: 10000000  // 1000만 (관리자용)
} as const;

// 토큰 초기화가 필요한지 확인하고 필요시 초기화 수행
export async function checkAndResetTokensIfNeeded(userId: string) {
  try {
    const supabase = await createClient();
    const { data: subscription, error } = await supabase
      .from('subscription')
      .select('*')
      .eq('userId', userId)
      .single();

    if (error || !subscription) {
      console.warn(`No subscription found for user ${userId}`, error);
      return false;
    }

    const now = new Date();
    
    // 다음 토큰 리셋일이 현재 시간을 지났는지 확인
    if (new Date(subscription.nextTokensReset) <= now) {
      console.log(`Resetting tokens for user ${userId}`);
      
      // 토큰 사용량 초기화 및 다음 리셋 날짜 설정
      const newTokensResetDate = new Date();
      const nextTokensReset = new Date(newTokensResetDate);
      nextTokensReset.setDate(nextTokensReset.getDate() + 30); // 30일 후

      const { error: updateError } = await supabase
        .from('subscription')
        .update({
          tokensUsed: 0,
          tokensResetDate: newTokensResetDate.toISOString(),
          nextTokensReset: nextTokensReset.toISOString(),
          updatedAt: now.toISOString()
        })
        .eq('userId', userId);

      if (updateError) {
        throw updateError;
      }

      console.log(`Tokens reset for user ${userId}. Next reset: ${nextTokensReset}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error checking/resetting tokens for user ${userId}:`, error);
    throw error;
  }
}

// 구독 플랜 변경 시 토큰 리셋 날짜 설정
export async function initializeTokenResetForNewSubscription(
  userId: string, 
  plan: SubscriptionPlan,
  billingDate?: Date
) {
  try {
    const supabase = await createClient();
    const now = billingDate || new Date();
    const nextTokensReset = new Date(now);
    nextTokensReset.setDate(nextTokensReset.getDate() + 30); // 30일 후

    const tokensTotal = PLAN_TOKEN_LIMITS[plan] || PLAN_TOKEN_LIMITS.FREE;

    const { error } = await supabase
      .from('subscription')
      .update({
        plan,
        tokensTotal,
        tokensUsed: 0, // 새 구독 시 토큰 초기화
        tokensResetDate: now.toISOString(),
        nextTokensReset: nextTokensReset.toISOString(),
        updatedAt: now.toISOString()
      })
      .eq('userId', userId);

    if (error) {
      throw error;
    }

    console.log(`Token reset initialized for user ${userId}, plan ${plan}, next reset: ${nextTokensReset}`);
    return { nextTokensReset, tokensTotal };
  } catch (error) {
    console.error(`Error initializing token reset for user ${userId}:`, error);
    throw error;
  }
}

// 토큰 사용량 업데이트 (초기화 체크 포함)
export async function updateTokenUsage(userId: string, tokensToAdd: number) {
  try {
    // 먼저 토큰 초기화가 필요한지 확인
    await checkAndResetTokensIfNeeded(userId);
    
    // 토큰 사용량 업데이트
    const supabase = await createClient();
    const { data: subscription, error } = await supabase
      .from('subscription')
      .select('*')
      .eq('userId', userId)
      .single();

    if (error || !subscription) {
      throw new Error(`No subscription found for user ${userId}`);
    }

    // 토큰 한도 확인
    const newTokensUsed = subscription.tokensUsed + tokensToAdd;
    if (newTokensUsed > subscription.tokensTotal) {
      throw new Error(`Token limit exceeded. Used: ${newTokensUsed}, Limit: ${subscription.tokensTotal}`);
    }

    const { error: updateError } = await supabase
      .from('subscription')
      .update({
        tokensUsed: newTokensUsed,
        updatedAt: new Date().toISOString()
      })
      .eq('userId', userId);

    if (updateError) {
      throw updateError;
    }

    return {
      tokensUsed: newTokensUsed,
      tokensTotal: subscription.tokensTotal,
      tokensRemaining: subscription.tokensTotal - newTokensUsed
    };
  } catch (error) {
    console.error(`Error updating token usage for user ${userId}:`, error);
    throw error;
  }
}

// 모든 사용자의 토큰 초기화 필요 여부 배치 체크 (cron job용)
export async function batchCheckAndResetTokens() {
  try {
    const supabase = await createClient();
    const now = new Date();
    
    // 토큰 리셋이 필요한 구독들 찾기
    const { data: subscriptionsToReset, error } = await supabase
      .from('subscription')
      .select('userId, plan, tokensUsed, nextTokensReset')
      .lte('nextTokensReset', now.toISOString());

    if (error) {
      throw error;
    }

    console.log(`Found ${subscriptionsToReset?.length || 0} subscriptions requiring token reset`);

    let resetCount = 0;
    if (subscriptionsToReset) {
      for (const sub of subscriptionsToReset) {
        try {
          const resetPerformed = await checkAndResetTokensIfNeeded(sub.userId);
          if (resetPerformed) {
            resetCount++;
          }
        } catch (error) {
          console.error(`Failed to reset tokens for user ${sub.userId}:`, error);
        }
      }
    }

    console.log(`Successfully reset tokens for ${resetCount} users`);
    return resetCount;
  } catch (error) {
    console.error('Error in batch token reset:', error);
    throw error;
  }
}

// 사용자의 토큰 정보 조회 (초기화 체크 포함)
export async function getUserTokenInfo(userId: string) {
  try {
    // 토큰 초기화 체크 먼저 수행
    await checkAndResetTokensIfNeeded(userId);
    
    const supabase = await createClient();
    const { data: subscription, error } = await supabase
      .from('subscription')
      .select('plan, tokensTotal, tokensUsed, tokensResetDate, nextTokensReset')
      .eq('userId', userId)
      .single();

    if (error || !subscription) {
      return null;
    }

    const tokensRemaining = subscription.tokensTotal - subscription.tokensUsed;
    const daysUntilReset = Math.ceil(
      (new Date(subscription.nextTokensReset).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      ...subscription,
      tokensRemaining,
      daysUntilReset,
      resetPercentage: ((subscription.tokensUsed / subscription.tokensTotal) * 100).toFixed(1)
    };
  } catch (error) {
    console.error(`Error getting token info for user ${userId}:`, error);
    throw error;
  }
}