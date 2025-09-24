import { prisma } from "@/lib/db/prisma";
import { SubscriptionPlan, TransactionType, TransactionStatus } from "@prisma/client";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { checkAndResetTokensIfNeeded, getUserTokenInfo } from "./token-reset";
import { SecureLogger, devLog, secureError } from "@/lib/utils/secure-logger";
import { PLAN_CONFIGS, getPlanConfig, type PlanType } from "./plan-config";

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

// 텍스트 생성 토큰 설정 (Gemini 2.5 Flash 텍스트 생성)
const TEXT_GENERATION_CONFIG = {
  COST_PER_MILLION: 1.5,               // $1.5 per 1M tokens (텍스트 생성 가격)
  USD_TO_KRW: 1450,                    // 환율
  PLAN_LIMITS: {
    FREE: 100000,                      // 10만 토큰/월
    PRO: 3000000,                      // 300만 토큰/월 
    PREMIUM: 10000000,                 // 1000만 토큰/월
    ENTERPRISE: 10000000,              // 1000만 토큰/월
  }
} as const;

// 구독 플랜 설정은 plan-config.ts에서 중앙 관리

// 토큰 관리 서비스
export class TokenManager {

  /**
   * Supabase 클라이언트 생성 (서버 전용)
   * 🔒 보안: 서버에서만 실행되며 서비스 역할 키 사용
   */
  private async getSupabaseClient() {
    // 서버 환경 체크
    if (typeof window !== 'undefined') {
      throw new Error('TokenManager는 서버에서만 실행되어야 합니다. 클라이언트에서는 API를 통해 접근하세요.');
    }

    // 서버 전용 Supabase 클라이언트 사용
    return await createSupabaseClient();
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
      SecureLogger.metrics(`실제 Gemini 토큰 사용량 기반 차감`, { geminiTokens: actualGeminiTokens });
      
      const supabase = await this.getSupabaseClient();
      
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
            tokensTotal: PLAN_CONFIGS.FREE.platformTokens,
            tokensUsed: 0,
            maxCharacters: PLAN_CONFIGS.FREE.maxCharacters,
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
        console.log(`✅ 새로운 구독 생성 완료: FREE 플랜, ${PLAN_CONFIGS.FREE.platformTokens} 토큰`);
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

      // 🚀 데이터베이스 트랜잭션으로 토큰 사용 원자성 보장
      const apiCost = (actualGeminiTokens / 1000000) * GEMINI_COST.COST_PER_MILLION;
      const newTokensUsed = (subscriptionData.tokensUsed || 0) + actualGeminiTokens;

      try {
        const { error: transactionError } = await supabase.rpc('consume_tokens_atomic', {
          p_user_id: userId,
          p_tokens_to_consume: actualGeminiTokens,
          p_service_type: 'image_generation',
          p_model_name: 'gemini-2-5-flash-image-preview',
          p_prompt_tokens: Math.floor(actualGeminiTokens * 0.7),
          p_completion_tokens: Math.floor(actualGeminiTokens * 0.3),
          p_api_cost: apiCost.toString(),
          p_metadata: JSON.stringify({
            imageCount: options?.imageCount || 1,
            highResolution: options?.highResolution || false,
            saveCharacter: options?.saveCharacter || false,
            description: options?.description || '이미지 생성'
          })
        });

        if (transactionError) {
          console.error('❌ 원자적 토큰 소비 실패, Fallback 사용:', transactionError);
          
          // Fallback: 순차적 업데이트 (RPC 함수가 없는 경우)
          const { error: usageError } = await supabase
            .from('token_usage')
            .insert({
              userId: userId,
              service_type: 'image_generation',
              model_name: 'gemini-2-5-flash-image-preview',
              prompt_tokens: Math.floor(actualGeminiTokens * 0.7),
              completion_tokens: Math.floor(actualGeminiTokens * 0.3),
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
            secureError('token_usage 테이블 기록 실패', usageError);
            return {
              success: false,
              error: "토큰 사용 기록 실패",
            };
          }

          // subscription 테이블 업데이트
          const { error: subscriptionError } = await supabase
            .from('subscription')
            .update({ tokensUsed: newTokensUsed })
            .eq('userId', userId);

          if (subscriptionError) {
            secureError('subscription 테이블 업데이트 실패', subscriptionError);
            return {
              success: false,
              error: "구독 정보 업데이트 실패",
            };
          }
        }
      } catch (error) {
        secureError('토큰 소비 트랜잭션 오류', error);
        return {
          success: false,
          error: "토큰 소비 중 데이터베이스 오류 발생",
        };
      }

      // 사용 내역 기록 (실제 비용 추적용)
      const estimatedCostKRW = Math.round(apiCost * GEMINI_COST.USD_TO_KRW);
      
      SecureLogger.metrics(`토큰 사용량 실시간 동기화 완료`, {
        geminiTokens: actualGeminiTokens,
        costUSD: apiCost.toFixed(6),
        costKRW: estimatedCostKRW
      });

      // 사용량 기록 완료

      return {
        success: true,
        remainingTokens: subscriptionData.tokensTotal - newTokensUsed,
      };
    } catch (error) {
      secureError("Actual token usage error", error);
      return {
        success: false,
        error: "토큰 사용 중 오류가 발생했습니다",
      };
    }
  }

  // 토큰 사용 (이미지 생성) - 기존 메서드 (하위 호환용)
  // 이 메서드는 레거시 지원용으로, useActualTokensFromGemini를 사용하는 것을 권장
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
      const supabase = await this.getSupabaseClient();
      
      // 구독 정보 조회
      const { data: subscription } = await supabase
        .from('subscription')
        .select('*')
        .eq('userId', userId)
        .single();

      if (!subscription) {
        return { 
          success: false, 
          error: "구독 정보를 찾을 수 없습니다" 
        };
      }

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

      // 토큰 차감
      const { error: updateError } = await supabase
        .from('subscription')
        .update({ tokensUsed: subscription.tokensUsed + requiredTokens })
        .eq('userId', userId);

      if (updateError) {
        throw updateError;
      }

      return {
        success: true,
        remainingTokens: remainingTokens - requiredTokens,
      };
    } catch (error) {
      secureError("Token usage error", error);
      return {
        success: false,
        error: "토큰 사용 중 오류가 발생했습니다",
      };
    }
  }

  // 일일 제한 없음 - 월간 토큰 한도만 체크

  // 토큰 잔액 조회 (상세 정보) - 자동 초기화 포함 - N+1 최적화됨
  async getBalance(userId: string): Promise<{
    balance: number;
    used: number;
    total: number;
    estimatedImagesRemaining: number;
  }> {
    try {
      // 토큰 초기화 체크 먼저 수행
      await checkAndResetTokensIfNeeded(userId);
      
      const supabase = await this.getSupabaseClient();
      
      // 🚀 N+1 최적화: 사용자 확인 쿼리 제거하고 구독 정보만 직접 조회
      // Auth ID를 직접 사용하므로 별도 사용자 존재 확인 불필요
      const { data: subscription } = await supabase
        .from('subscription')
        .select('*')
        .eq('userId', userId)
        .single();

      if (!subscription) {
        // 구독이 없으면 기본 FREE 플랜으로 처리
        const freeConfig = PLAN_CONFIGS.FREE;
        
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
      secureError("Get balance error", error);
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
      const config = getPlanConfig(plan as PlanType);
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
      secureError("Reset monthly tokens error", error);
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

      const config = getPlanConfig(subscription.plan as PlanType);
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

  /**
   * 텍스트 생성 토큰 사용량 추적 (Gemini 2.5 Flash)
   * 멤버십별 월 한도: FREE(10만), PRO(300만), PREMIUM(1000만)
   */
  async useTextGenerationTokens(
    userId: string,
    actualGeminiTokens: number,
    options?: {
      requestType?: string;
      description?: string;
    }
  ): Promise<{
    success: boolean;
    remainingTextTokens?: number;
    userPlan?: string;
    monthlyLimit?: number;
    error?: string;
  }> {
    try {
      SecureLogger.metrics(`텍스트 생성 토큰 사용`, { geminiTokens: actualGeminiTokens });

      const supabase = await this.getSupabaseClient();
      
      // 🚀 N+1 최적화: 구독 정보를 먼저 조회하고, 없으면 사용자 생성
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
        select: { plan: true }
      });

      // 구독이 없으면 사용자가 없을 수 있으므로 생성
      if (!subscription) {
        console.log(`👤 새로운 사용자 자동 생성: ${userId.substring(0, 8)}...`);
        
        // Supabase에서 사용자 확인만 하고, 없으면 생성
        const { data: userData } = await supabase
          .from('user')
          .select('id')
          .eq('id', userId)
          .single();

        if (!userData) {
          const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId);
          
          await supabase.from('user').insert({
            id: userId,
            email: authUser?.email || `user-${userId.substring(0, 8)}@example.com`,
            name: authUser?.user_metadata?.name || `사용자-${userId.substring(0, 8)}`,
            createdAt: new Date().toISOString(),
          });
        }
      }

      const userPlan = subscription?.plan || 'FREE';
      const monthlyLimit = TEXT_GENERATION_CONFIG.PLAN_LIMITS[userPlan as keyof typeof TEXT_GENERATION_CONFIG.PLAN_LIMITS] || TEXT_GENERATION_CONFIG.PLAN_LIMITS.FREE;

      console.log(`👤 사용자 플랜: ${userPlan}, 텍스트 토큰 월 한도: ${monthlyLimit.toLocaleString()}토큰`);

      // 현재 월의 텍스트 토큰 사용량 확인
      const currentMonth = new Date();
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const monthlyUsage = await prisma.transaction.aggregate({
        where: {
          userId,
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          type: TransactionType.TOKEN_USAGE,
          description: {
            contains: '텍스트 생성',
          },
        },
        _sum: {
          tokens: true,
        },
      });

      const currentTextTokensUsed = monthlyUsage._sum.tokens || 0;
      const remainingTextTokens = monthlyLimit - currentTextTokensUsed;

      // 월 한도 확인
      if (remainingTextTokens < actualGeminiTokens) {
        return {
          success: false,
          remainingTextTokens,
          userPlan,
          monthlyLimit,
          error: `텍스트 생성 월 한도 초과 (${userPlan} 플랜: ${monthlyLimit.toLocaleString()}토큰/월, 사용 가능: ${remainingTextTokens.toLocaleString()}토큰, 요청: ${actualGeminiTokens.toLocaleString()}토큰)`,
        };
      }

      // 텍스트 생성 토큰 사용 기록
      await prisma.transaction.create({
        data: {
          userId,
          type: TransactionType.TOKEN_USAGE,
          tokens: actualGeminiTokens,
          amount: 0,
          status: TransactionStatus.COMPLETED,
          description: options?.description || `텍스트 생성: ${actualGeminiTokens.toLocaleString()}토큰 (${userPlan} 플랜)`,
        },
      });

      console.log(`✅ 텍스트 생성 토큰 사용 완료: ${actualGeminiTokens.toLocaleString()}토큰 (${userPlan} 플랜, 잔여: ${(remainingTextTokens - actualGeminiTokens).toLocaleString()}토큰)`);

      return {
        success: true,
        remainingTextTokens: remainingTextTokens - actualGeminiTokens,
        userPlan,
        monthlyLimit,
      };

    } catch (error) {
      secureError("텍스트 생성 토큰 사용 오류", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
      };
    }
  }

  /**
   * 텍스트 생성 토큰 잔액 조회 (멤버십별)
   */
  async getTextGenerationBalance(userId: string): Promise<{
    remainingTokens: number;
    usedThisMonth: number;
    monthlyLimit: number;
    userPlan: string;
  }> {
    try {
      // 사용자 구독 정보 조회
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
        select: { plan: true }
      });

      const userPlan = subscription?.plan || 'FREE';
      const monthlyLimit = TEXT_GENERATION_CONFIG.PLAN_LIMITS[userPlan as keyof typeof TEXT_GENERATION_CONFIG.PLAN_LIMITS] || TEXT_GENERATION_CONFIG.PLAN_LIMITS.FREE;

      const currentMonth = new Date();
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const monthlyUsage = await prisma.transaction.aggregate({
        where: {
          userId,
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          type: TransactionType.TOKEN_USAGE,
          description: {
            contains: '텍스트 생성',
          },
        },
        _sum: {
          tokens: true,
        },
      });

      const usedThisMonth = monthlyUsage._sum.tokens || 0;
      const remainingTokens = monthlyLimit - usedThisMonth;

      return {
        remainingTokens: Math.max(0, remainingTokens),
        usedThisMonth,
        monthlyLimit,
        userPlan,
      };

    } catch (error) {
      secureError("텍스트 토큰 잔액 조회 오류", error);
      return {
        remainingTokens: 0,
        usedThisMonth: 0,
        monthlyLimit: TEXT_GENERATION_CONFIG.PLAN_LIMITS.FREE,
        userPlan: 'FREE',
      };
    }
  }
}

// 싱글톤 인스턴스
export const tokenManager = new TokenManager();