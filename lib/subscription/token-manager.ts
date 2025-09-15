import { prisma } from "@/lib/db/prisma";
import { SubscriptionPlan, TransactionType, TransactionStatus } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

// Gemini 2.5 Flash 이미지 생성 토큰 소비량 기준
// 실제 Gemini API: 이미지당 약 1,290 토큰 (100만 토큰당 $30)
// 이미지당 원가: 약 52원 (1,290 토큰 × $0.00003 × 1,330원/달러)
const GEMINI_COST = {
  TOKENS_PER_IMAGE: 1290,           // Gemini 실제 토큰 소비량
  COST_PER_MILLION: 30,              // $30 per 1M tokens
  USD_TO_KRW: 1450,                   // 환율
  COST_PER_IMAGE_KRW: 52,            // 이미지당 원가 (원)
} as const;

// 플랫폼 토큰 설정 (수익 마진 고려)
const PLATFORM_PRICING = {
  TOKENS_PER_IMAGE: 1,                 // 플랫폼 토큰: 1이미지 = 1토큰
  HIGH_RESOLUTION_TOKENS: 0.5,        // 고해상도 추가 토큰
  CHARACTER_SAVE_TOKENS: 0.2,          // 캐릭터 저장 토큰
  MARGIN_MULTIPLIER: 2.5,              // 2.5배 마진 (원가 52원 → 판매 130원)
} as const;

// 구독 플랜 설정 (2.5배 마진 기준)
const SUBSCRIPTION_CONFIG = {
  FREE: {
    name: '무료',
    price: 0,                          // 무료
    platformTokens: 10000,             // 1만 토큰 (약 7-8장 이미지 생성 가능)
    maxImages: 8,                      // 월 이미지 생성 한도 (실제 기준)
    maxCharacters: 1,
    estimatedCost: 520,                // 예상 원가 (8 × 65원)
    profit: -520,                      // 무료 플랜
  },
  PRO: {
    name: '베이직',
    price: 30000,                      // 월 3만원
    platformTokens: 400000,            // 40만 토큰 (약 310장 이미지 생성 가능)
    maxImages: 310,                    // 월 이미지 생성 한도 (실제 기준)
    maxCharacters: 3,
    estimatedCost: 16000,              // 예상 원가 (310 × 52원)
    profit: 14000,                     // 수익 마진
  },
  PREMIUM: {
    name: '프로',
    price: 100000,                     // 월 10만원
    platformTokens: 1500000,           // 150만 토큰 (약 1,163장 이미지 생성 가능)
    maxImages: 1163,                   // 월 이미지 생성 한도 (실제 기준)                  
    maxCharacters: 5,
    estimatedCost: 60000,              // 예상 원가 (1163 × 52원)
    profit: 40000,                     // 수익 마진
  },
  ADMIN: {
    name: '관리자',
    price: 0,                          // 무료 (관리자)
    platformTokens: 999999999,         // 무제한 토큰
    maxImages: 999999999,              // 무제한 이미지 생성
    maxCharacters: 999,                // 무제한 캐릭터
    estimatedCost: 0,                  // 관리자는 비용 없음
    profit: 0,                         // 관리자 계정
  },
} as const;

// 토큰 관리 서비스
export class TokenManager {

  /**
   * Supabase 클라이언트 생성 (서버용)
   */
  private getSupabaseClient() {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // Google Gemini API 실제 토큰 사용량 기반 차감 (새로운 메서드)
  async useActualTokensFromGemini(
    userId: string, 
    actualGeminiTokens: number,
    options?: {
      imageCount?: number;
      highResolution?: boolean;
      saveCharacter?: boolean;
      description?: string;
    }
  ): Promise<{
    success: boolean;
    remainingTokens?: number;
    dailyRemaining?: number;
    error?: string;
  }> {
    try {
      console.log(`💰 실제 Gemini 토큰 사용량 기반 차감: ${actualGeminiTokens} 토큰`);
      
      const supabase = this.getSupabaseClient();
      
      // 직접 Auth ID 사용 (자동 생성 필요시)
      let userData = await supabase
        .from('user')
        .select('id')
        .eq('id', userId)
        .single();

      if (!userData.data) {
        console.log(`👤 새로운 사용자 자동 생성: ${userId.substring(0, 8)}...`);
        
        // Supabase Auth에서 사용자 정보 가져오기
        const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId);
        
        if (!authUser) {
          console.error(`Auth 사용자를 찾을 수 없습니다: ${userId}`);
          return {
            success: false,
            error: "Auth 사용자를 찾을 수 없습니다",
          };
        }

        // 새 사용자 생성 (Auth ID를 직접 PK로 사용)
        const { data: newUser } = await supabase
          .from('user')
          .insert({
            id: userId, // Auth ID를 직접 PK로 사용
            email: authUser.email || '',
            name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || '사용자',
            avatarUrl: authUser.user_metadata?.avatar_url
          })
          .select('id')
          .single();

        if (!newUser) {
          console.error(`새 사용자 생성 실패: ${userId}`);
          return {
            success: false,
            error: "새 사용자 생성 실패",
          };
        }
        console.log(`✅ 새로운 사용자 생성 완료: ${userId.substring(0, 8)}...`);
      } else {
        console.log(`🔄 기존 사용자 확인: ${userId.substring(0, 8)}...`);
      }

      // 실제 구독 정보 조회 (없으면 자동 생성)
      let subscription = await supabase
        .from('subscription')
        .select('*')
        .eq('userId', userId)
        .single();

      if (!subscription.data) {
        console.log(`📋 새로운 구독 자동 생성: ${userId.substring(0, 8)}...`);
        
        // FREE 플랜으로 새 구독 생성
        const { data: newSubscription } = await supabase
          .from('subscription')
          .insert({
            userId: userId,
            plan: 'FREE',
            tokensTotal: SUBSCRIPTION_CONFIG.FREE.platformTokens,
            tokensUsed: 0,
            maxCharacters: SUBSCRIPTION_CONFIG.FREE.maxCharacters,
            maxProjects: 3,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1년 후
          })
          .select('*')
          .single();

        if (!newSubscription) {
          console.error(`새 구독 생성 실패: ${userId}`);
          return {
            success: false,
            error: "새 구독 생성 실패",
          };
        }

        subscription.data = newSubscription;
        console.log(`✅ 새로운 구독 생성 완료: FREE 플랜, ${SUBSCRIPTION_CONFIG.FREE.platformTokens} 토큰`);
      }

      // 토큰 잔액 확인
      const subscriptionData = subscription.data;
      const remainingTokens = subscriptionData.tokensTotal - subscriptionData.tokensUsed;
      if (remainingTokens < actualGeminiTokens) {
        console.warn(`토큰 부족: 필요 ${actualGeminiTokens}, 잔액 ${remainingTokens}`);
        return {
          success: false,
          error: `토큰이 부족합니다 (필요: ${actualGeminiTokens}, 잔액: ${remainingTokens})`,
          remainingTokens,
        };
      }

      // 1. token_usage 테이블에 상세 사용 기록
      const apiCost = (actualGeminiTokens / 1000000) * GEMINI_COST.COST_PER_MILLION;
      const { error: usageError } = await supabase
        .from('token_usage')
        .insert({
          userId: userId, // Auth ID 직접 사용
          service_type: 'image_generation',
          model_name: 'gemini-2-5-flash-image-preview',
          prompt_tokens: Math.floor(actualGeminiTokens * 0.7), // 추정 (일반적으로 프롬프트가 70%)
          completion_tokens: Math.floor(actualGeminiTokens * 0.3), // 추정 (생성 토큰이 30%)
          total_tokens: actualGeminiTokens,
          api_cost: apiCost.toString(),
          metadata: {
            imageCount: options?.imageCount || 1,
            highResolution: options?.highResolution || false,
            saveCharacter: options?.saveCharacter || false,
            description: options?.description || '이미지 생성'
          },
          created_at: new Date().toISOString()
        });

      if (usageError) {
        console.error('❌ token_usage 테이블 기록 실패:', usageError);
        return {
          success: false,
          error: "토큰 사용 기록 실패",
        };
      }

      // 2. subscription 테이블의 tokensUsed 업데이트 (null 처리)
      const newTokensUsed = (subscriptionData.tokensUsed || 0) + actualGeminiTokens;
      const { error: subscriptionError } = await supabase
        .from('subscription')
        .update({ tokensUsed: newTokensUsed })
        .eq('userId', userId); // Auth ID 직접 사용

      if (subscriptionError) {
        console.error('❌ subscription 테이블 업데이트 실패:', subscriptionError);
        return {
          success: false,
          error: "구독 정보 업데이트 실패",
        };
      }

      // 사용 내역 기록 (실제 비용 추적용)
      const estimatedCostKRW = Math.round(apiCost * GEMINI_COST.USD_TO_KRW);
      
      console.log(`📊 토큰 사용량 실시간 동기화 완료:`, {
        geminiTokens: actualGeminiTokens,
        previousUsed: subscription.tokensUsed,
        newUsed: newTokensUsed,
        remaining: subscription.tokensTotal - newTokensUsed,
        estimatedCostUSD: apiCost.toFixed(6),
        estimatedCostKRW,
        description: options?.description || '토큰 사용'
      });

      // 사용량 기록 완료

      return {
        success: true,
        remainingTokens: subscriptionData.tokensTotal - newTokensUsed,
      };
    } catch (error) {
      console.error("❌ Actual token usage error:", error);
      return {
        success: false,
        error: "토큰 사용 중 오류가 발생했습니다",
      };
    }
  }

  // 토큰 사용 (이미지 생성) - 기존 메서드 (하위 호환용)
  async useTokensForImage(
    userId: string, 
    imageCount: number,
    options?: {
      highResolution?: boolean;
      saveCharacter?: boolean;
    }
  ): Promise<{
    success: boolean;
    remainingTokens?: number;
    dailyRemaining?: number;
    error?: string;
  }> {
    try {
      // 테스트용: 토큰 체크 건너뛰기
      const subscription = { 
        plan: 'ADMIN', 
        tokensTotal: 999999999, 
        tokensUsed: 0 
      };

      if (!subscription) {
        return { 
          success: false, 
          error: "구독 정보를 찾을 수 없습니다" 
        };
      }

      // 토큰 충분성 체크만 진행

      // 필요 토큰 계산 (소수점 처리)
      let requiredTokens = imageCount * PLATFORM_PRICING.TOKENS_PER_IMAGE;
      if (options?.highResolution) {
        requiredTokens += imageCount * PLATFORM_PRICING.HIGH_RESOLUTION_TOKENS;
      }
      if (options?.saveCharacter) {
        requiredTokens += PLATFORM_PRICING.CHARACTER_SAVE_TOKENS;
      }
      requiredTokens = Math.ceil(requiredTokens); // 올림 처리

      const remainingTokens = subscription.tokensTotal - subscription.tokensUsed;
      
      if (remainingTokens < requiredTokens) {
        return {
          success: false,
          error: `토큰 부족 (필요: ${requiredTokens}, 보유: ${remainingTokens})`,
          remainingTokens,
        };
      }

      // 테스트용: 토큰 차감 건너뛰기
      // await prisma.subscription.update({
      //   where: { userId },
      //   data: {
      //     tokensUsed: subscription.tokensUsed + requiredTokens,
      //   },
      // });

      // 사용 내역 기록 (원가 추적용)
      const actualGeminiTokens = imageCount * GEMINI_COST.TOKENS_PER_IMAGE;
      const estimatedCost = Math.round(
        (actualGeminiTokens / 1000000) * 
        GEMINI_COST.COST_PER_MILLION * 
        GEMINI_COST.USD_TO_KRW
      );

      // 테스트용: 트랜잭션 기록 건너뛰기
      console.log(`테스트: ${requiredTokens} 토큰 사용됨`);
      
      // metadata는 별도 테이블에 저장 (필요시)
      // 또는 description에 JSON 문자열로 포함

      return {
        success: true,
        remainingTokens: remainingTokens - requiredTokens,
      };
    } catch (error) {
      console.error("Token usage error:", error);
      return {
        success: false,
        error: "토큰 사용 중 오류가 발생했습니다",
      };
    }
  }

  // 일일 제한 없음 - 월간 토큰 한도만 체크

  // 토큰 잔액 조회 (상세 정보)
  async getBalance(userId: string): Promise<{
    balance: number;
    used: number;
    total: number;
    estimatedImagesRemaining: number;
  }> {
    try {
      const supabase = this.getSupabaseClient();
      
      // Auth ID 직접 사용
      const { data: userData } = await supabase
        .from('user')
        .select('id')
        .eq('id', userId)
        .single();

      if (!userData) {
        console.warn(`사용자를 찾을 수 없습니다: ${userId}`);
        return {
          balance: 0,
          used: 0,
          total: 0,
          estimatedImagesRemaining: 0,
        };
      }

      // 구독 정보 조회 (Auth ID 직접 사용)
      const { data: subscription } = await supabase
        .from('subscription')
        .select('*')
        .eq('userId', userId)
        .single();

      if (!subscription) {
        // 구독이 없으면 기본 FREE 플랜으로 처리
        const freeConfig = SUBSCRIPTION_CONFIG.FREE;
        
        return {
          balance: freeConfig.platformTokens,
          used: 0,
          total: freeConfig.platformTokens,
          estimatedImagesRemaining: Math.floor(freeConfig.platformTokens / GEMINI_COST.TOKENS_PER_IMAGE),
        };
      }

      const balance = subscription.tokensTotal - subscription.tokensUsed;

      return {
        balance,
        used: subscription.tokensUsed,
        total: subscription.tokensTotal,
        estimatedImagesRemaining: Math.floor(balance / GEMINI_COST.TOKENS_PER_IMAGE),
      };
    } catch (error) {
      console.error("Get balance error:", error);
      return {
        balance: 0,
        used: 0,
        total: 0,
        estimatedImagesRemaining: 0,
      };
    }
  }

  // 월간 토큰 리셋 (구독 갱신시)
  async resetMonthlyTokens(userId: string, plan: SubscriptionPlan): Promise<void> {
    try {
      const config = SUBSCRIPTION_CONFIG[plan as keyof typeof SUBSCRIPTION_CONFIG];
      if (!config) {
        throw new Error("잘못된 구독 플랜입니다");
      }
      
      await prisma.subscription.update({
        where: { userId },
        data: {
          tokensTotal: config.platformTokens,
          tokensUsed: 0,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // 토큰 리셋 완료
    } catch (error) {
      console.error("Reset monthly tokens error:", error);
      throw error;
    }
  }

  // 수익성 분석
  async getMonthlyProfitAnalysis(userId: string): Promise<{
    revenue: number;
    actualCost: number;
    profit: number;
    margin: number;
    imageCount: number;
  }> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
      });

      if (!subscription) {
        return {
          revenue: 0,
          actualCost: 0,
          profit: 0,
          margin: 0,
          imageCount: 0,
        };
      }

      const config = SUBSCRIPTION_CONFIG[subscription.plan as keyof typeof SUBSCRIPTION_CONFIG];
      if (!config) {
        return {
          revenue: 0,
          actualCost: 0,
          profit: 0,
          margin: 0,
          imageCount: 0,
        };
      }

      // 이번 달 사용 내역
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const monthlyUsage = await prisma.transaction.findMany({
        where: {
          userId,
          type: TransactionType.TOKEN_PURCHASE,
          createdAt: { gte: startOfMonth },
          tokens: { lt: 0 },
        },
      });

      // 실제 이미지 생성 수와 원가 계산
      let totalImages = 0;
      let totalCost = 0;

      monthlyUsage.forEach(usage => {
        // description에서 이미지 수 추출
        const match = usage.description?.match(/이미지 생성: (\d+)장/);
        if (match) {
          const imageCount = parseInt(match[1]);
          totalImages += imageCount;
          totalCost += imageCount * GEMINI_COST.COST_PER_IMAGE_KRW;
        }
      });

      const revenue = config.price;
      const profit = revenue - totalCost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      return {
        revenue,
        actualCost: totalCost,
        profit,
        margin: Math.round(margin),
        imageCount: totalImages,
      };
    } catch (error) {
      console.error("Profit analysis error:", error);
      return {
        revenue: 0,
        actualCost: 0,
        profit: 0,
        margin: 0,
        imageCount: 0,
      };
    }
  }

  // 사용 내역 조회
  async getUsageHistory(
    userId: string,
    limit: number = 10
  ): Promise<Array<{
    date: Date;
    tokens: number;
    description: string;
    imageCount?: number;
    cost?: number;
  }>> {
    try {
      const transactions = await prisma.transaction.findMany({
        where: {
          userId,
          tokens: { not: null },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      return transactions.map(t => {
        // description에서 이미지 수 추출
        const match = t.description?.match(/이미지 생성: (\d+)장/);
        const imageCount = match ? parseInt(match[1]) : undefined;
        
        return {
          date: t.createdAt,
          tokens: Math.abs(t.tokens || 0),
          description: t.description || "",
          imageCount,
          cost: imageCount ? imageCount * GEMINI_COST.COST_PER_IMAGE_KRW : undefined,
        };
      });
    } catch (error) {
      console.error("Get usage history error:", error);
      return [];
    }
  }

  // 토큰 부족 알림 확인
  async checkLowBalance(userId: string): Promise<{
    isLow: boolean;
    balance: number;
    canGenerateImages: number;
  }> {
    const balanceInfo = await this.getBalance(userId);
    const canGenerate = Math.floor(balanceInfo.balance / GEMINI_COST.TOKENS_PER_IMAGE);
    
    return {
      isLow: canGenerate < 5, // 5장 미만 생성 가능시 알림
      balance: balanceInfo.balance,
      canGenerateImages: canGenerate,
    };
  }

  // 추천인 보상 (수익성 고려)
  async grantReferralReward(
    referrerId: string,
    referredId: string
  ): Promise<void> {
    try {
      // 이미 보상을 받았는지 확인
      const existingReward = await prisma.referralReward.findUnique({
        where: {
          referrerId_referredId: {
            referrerId,
            referredId,
          },
        },
      });

      if (existingReward) {
        return;
      }

      // 추천인: 20토큰 (20이미지, 약 1040원 가치)
      await this.addTokens(referrerId, 20);
      
      // 가입자: 10토큰 (10이미지, 약 520원 가치)
      await this.addTokens(referredId, 10);

      // 보상 기록
      await prisma.referralReward.create({
        data: {
          referrerId,
          referredId,
          tokensRewarded: 20,
        },
      });
    } catch (error) {
      console.error("Grant referral reward error:", error);
      throw error;
    }
  }

  // 토큰 추가 (관리자용 및 내부 사용)
  async addTokens(userId: string, amount: number): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new Error("구독 정보를 찾을 수 없습니다");
    }

    await prisma.subscription.update({
      where: { userId },
      data: {
        tokensTotal: subscription.tokensTotal + amount,
      },
    });

    await prisma.transaction.create({
      data: {
        userId,
        type: TransactionType.TOKEN_PURCHASE,
        tokens: amount,
        amount: 0,
        status: TransactionStatus.COMPLETED,
        description: `토큰 보너스: ${amount}개`,
      },
    });
  }
}

// 싱글톤 인스턴스
export const tokenManager = new TokenManager();