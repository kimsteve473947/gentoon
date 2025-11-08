import { prisma } from '@/lib/db/prisma';
import { PLAN_CONFIGS } from './plan-config';
import { secureError } from '@/lib/utils/secure-logger';
import { createClient } from '@/lib/supabase/server';
import { TransactionType } from '@prisma/client';

// 텍스트 생성 토큰 설정 (AI 대본 생성용)
const TEXT_GENERATION_CONFIG = {
  PLAN_LIMITS: {
    FREE: 15000,      // 15회 대본 생성 (평균 1000토큰/스크립트)
    STARTER: 100000,  // 100회 대본 생성
    PRO: 300000,      // 300회 대본 생성
    PREMIUM: 1000000, // 1000회 대본 생성
    ADMIN: 999999999  // 무제한
  }
};

export class TokenManager {
  private static instance: TokenManager;

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  private async getSupabaseClient() {
    return await createClient();
  }

  /**
   * 실제 Gemini 토큰 사용량을 기반으로 한 이미지 생성 토큰 차감
   * Google AI Studio API에서 반환된 실제 토큰 수를 사용하여 정확한 추적
   */
  async useActualTokensFromGemini(
    userId: string, 
    actualGeminiTokens: number,
    options?: {
      requestType?: string;
      description?: string;
    }
  ): Promise<{
    success: boolean;
    remainingImageTokens?: number;
    userPlan?: string;
    monthlyLimit?: number;
    error?: string;
  }> {
    try {
      console.log(`🔢 이미지 생성 토큰 차감 시도: ${actualGeminiTokens.toLocaleString()}토큰`);

      // 개발 모드에서는 항상 성공 (무제한 토큰)
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 개발 모드: 토큰 차감 스킵');
        return {
          success: true,
          remainingImageTokens: 999999,
          userPlan: 'PREMIUM',
          monthlyLimit: 999999
        };
      }

      let subscription;
      try {
        subscription = await prisma.subscription.findUnique({
          where: { userId },
          select: { 
            plan: true,
            imageTokensTotal: true,
            imageTokensUsed: true
          }
        });
      } catch (prismaError) {
        console.warn('⚠️ Prisma 연결 실패, Supabase 직접 쿼리로 대체:', prismaError);
        
        const supabase = await this.getSupabaseClient();
        const { data: supabaseSubscription, error: queryError } = await supabase
          .from('subscription')
          .select('plan, imageTokensTotal, imageTokensUsed')
          .eq('userId', userId)
          .single();
        
        if (queryError) {
          console.error('❌ Supabase 구독 조회 실패:', queryError);
          return {
            success: false,
            error: '구독 정보 조회에 실패했습니다'
          };
        }

        return await this.processImageTokenUsageWithSupabase(userId, actualGeminiTokens, supabaseSubscription, options);
      }

      if (!subscription) {
        return {
          success: false,
          error: '구독 정보가 없습니다'
        };
      }

      const { plan, imageTokensTotal, imageTokensUsed } = subscription;
      const remainingTokens = imageTokensTotal - imageTokensUsed;

      // 토큰 부족 검사
      if (remainingTokens < actualGeminiTokens) {
        console.warn(`❌ 이미지 토큰 부족: ${remainingTokens}/${imageTokensTotal} (필요: ${actualGeminiTokens})`);
        return {
          success: false,
          error: `이미지 생성 토큰이 부족합니다 (${plan} 플랜: ${remainingTokens.toLocaleString()}/${imageTokensTotal.toLocaleString()}토큰 잔여)`,
        };
      }

      // 토큰 차감 (Prisma 시도)
      try {
        await prisma.subscription.update({
          where: { userId },
          data: {
            imageTokensUsed: imageTokensUsed + actualGeminiTokens
          }
        });
      } catch (prismaError) {
        console.warn('⚠️ Prisma 토큰 업데이트 실패, Supabase 직접 업데이트:', prismaError);
        
        const supabase = await this.getSupabaseClient();
        const { error: updateError } = await supabase
          .from('subscription')
          .update({
            imageTokensUsed: imageTokensUsed + actualGeminiTokens
          })
          .eq('userId', userId);

        if (updateError) {
          console.error('❌ Supabase 토큰 업데이트 실패:', updateError);
          return {
            success: false,
            error: '토큰 사용량 업데이트에 실패했습니다'
          };
        }
      }

      // 사용 내역 기록
      const description = options?.description || `이미지 생성: ${actualGeminiTokens.toLocaleString()}토큰`;
      
      try {
        await prisma.transaction.create({
          data: {
            userId,
            type: TransactionType.TOKEN_USAGE,
            amount: 0,
            tokens: actualGeminiTokens,
            description
          }
        });
      } catch (transactionError) {
        console.warn('⚠️ 거래 내역 기록 실패:', transactionError);
      }

      console.log(`✅ 이미지 토큰 사용 완료: ${actualGeminiTokens.toLocaleString()}토큰 (잔여: ${(remainingTokens - actualGeminiTokens).toLocaleString()}/${imageTokensTotal.toLocaleString()})`);

      return {
        success: true,
        remainingImageTokens: remainingTokens - actualGeminiTokens,
        userPlan: plan,
        monthlyLimit: imageTokensTotal
      };

    } catch (error) {
      secureError("이미지 토큰 사용 오류", error);
      return {
        success: false,
        error: "토큰 사용 중 오류가 발생했습니다",
      };
    }
  }

  /**
   * Supabase 직접 쿼리를 사용한 이미지 토큰 처리 (Prisma 연결 실패 대체)
   */
  private async processImageTokenUsageWithSupabase(
    userId: string,
    actualGeminiTokens: number,
    subscription: any,
    options?: { requestType?: string; description?: string }
  ): Promise<{
    success: boolean;
    remainingImageTokens?: number;
    userPlan?: string;
    monthlyLimit?: number;
    error?: string;
  }> {
    try {
      const supabase = await this.getSupabaseClient();

      if (!subscription) {
        return {
          success: false,
          error: '구독 정보가 없습니다'
        };
      }

      const { plan, imageTokensTotal, imageTokensUsed } = subscription;
      const remainingTokens = imageTokensTotal - imageTokensUsed;

      // 토큰 부족 검사
      if (remainingTokens < actualGeminiTokens) {
        console.warn(`❌ 이미지 토큰 부족: ${remainingTokens}/${imageTokensTotal} (필요: ${actualGeminiTokens})`);
        return {
          success: false,
          error: `이미지 생성 토큰이 부족합니다 (${plan} 플랜: ${remainingTokens.toLocaleString()}/${imageTokensTotal.toLocaleString()}토큰 잔여)`,
        };
      }

      // Supabase로 토큰 차감
      const { error: updateError } = await supabase
        .from('subscription')
        .update({
          imageTokensUsed: imageTokensUsed + actualGeminiTokens
        })
        .eq('userId', userId);

      if (updateError) {
        console.error('❌ 토큰 사용량 업데이트 실패:', updateError);
        return {
          success: false,
          error: '토큰 사용량 업데이트에 실패했습니다'
        };
      }

      console.log(`✅ 이미지 토큰 사용 완료: ${actualGeminiTokens.toLocaleString()}토큰 (잔여: ${(remainingTokens - actualGeminiTokens).toLocaleString()}/${imageTokensTotal.toLocaleString()})`);

      return {
        success: true,
        remainingImageTokens: remainingTokens - actualGeminiTokens,
        userPlan: plan,
        monthlyLimit: imageTokensTotal
      };

    } catch (error) {
      console.error('❌ Supabase 이미지 토큰 처리 오류:', error);
      return {
        success: false,
        error: '이미지 토큰 처리 중 오류가 발생했습니다'
      };
    }
  }

  /**
   * 실제 Gemini 토큰 사용량을 기반으로 한 텍스트 생성 토큰 차감
   * Google AI Studio API에서 반환된 실제 토큰 수를 사용하여 정확한 추적
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
      console.log(`🔢 텍스트 생성 토큰 차감 시도: ${actualGeminiTokens.toLocaleString()}토큰`);

      // 개발 모드에서는 항상 성공 (무제한 토큰)
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 개발 모드: 텍스트 토큰 차감 스킵');
        return {
          success: true,
          remainingTextTokens: 999999,
          userPlan: 'PREMIUM',
          monthlyLimit: 999999
        };
      }

      let subscription;
      try {
        subscription = await prisma.subscription.findUnique({
          where: { userId },
          select: { 
            plan: true,
            textTokensTotal: true,
            textTokensUsed: true
          }
        });
      } catch (prismaError) {
        console.warn('⚠️ Prisma 연결 실패, Supabase 직접 쿼리로 대체:', prismaError);
        
        const supabase = await this.getSupabaseClient();
        const { data: supabaseSubscription, error: queryError } = await supabase
          .from('subscription')
          .select('plan, textTokensTotal, textTokensUsed')
          .eq('userId', userId)
          .single();
        
        if (queryError) {
          console.error('❌ Supabase 구독 조회 실패:', queryError);
          return {
            success: false,
            error: '구독 정보 조회에 실패했습니다'
          };
        }

        return await this.processTextTokenUsageWithSupabase(userId, actualGeminiTokens, supabaseSubscription, options);
      }

      if (!subscription) {
        return {
          success: false,
          error: '구독 정보가 없습니다'
        };
      }

      const { plan, textTokensTotal, textTokensUsed } = subscription;
      const remainingTokens = textTokensTotal - textTokensUsed;

      // 토큰 부족 검사
      if (remainingTokens < actualGeminiTokens) {
        console.warn(`❌ 텍스트 토큰 부족: ${remainingTokens}/${textTokensTotal} (필요: ${actualGeminiTokens})`);
        return {
          success: false,
          error: `텍스트 생성 토큰이 부족합니다 (${plan} 플랜: ${remainingTokens.toLocaleString()}/${textTokensTotal.toLocaleString()}토큰 잔여)`,
        };
      }

      // 토큰 차감 (Prisma 시도)
      try {
        await prisma.subscription.update({
          where: { userId },
          data: {
            textTokensUsed: textTokensUsed + actualGeminiTokens
          }
        });
      } catch (prismaError) {
        console.warn('⚠️ Prisma 토큰 업데이트 실패, Supabase 직접 업데이트:', prismaError);
        
        const supabase = await this.getSupabaseClient();
        const { error: updateError } = await supabase
          .from('subscription')
          .update({
            textTokensUsed: textTokensUsed + actualGeminiTokens
          })
          .eq('userId', userId);

        if (updateError) {
          console.error('❌ Supabase 토큰 업데이트 실패:', updateError);
          return {
            success: false,
            error: '토큰 사용량 업데이트에 실패했습니다'
          };
        }
      }

      // 사용 내역 기록
      const description = options?.description || `텍스트 생성: ${actualGeminiTokens.toLocaleString()}토큰`;
      
      try {
        await prisma.transaction.create({
          data: {
            userId,
            type: TransactionType.TOKEN_USAGE,
            amount: 0,
            tokens: actualGeminiTokens,
            description
          }
        });
      } catch (transactionError) {
        console.warn('⚠️ 거래 내역 기록 실패:', transactionError);
      }

      console.log(`✅ 텍스트 토큰 사용 완료: ${actualGeminiTokens.toLocaleString()}토큰 (잔여: ${(remainingTokens - actualGeminiTokens).toLocaleString()}/${textTokensTotal.toLocaleString()})`);

      return {
        success: true,
        remainingTextTokens: remainingTokens - actualGeminiTokens,
        userPlan: plan,
        monthlyLimit: textTokensTotal
      };

    } catch (error) {
      secureError("텍스트 토큰 사용 오류", error);
      return {
        success: false,
        error: "토큰 사용 중 오류가 발생했습니다",
      };
    }
  }

  /**
   * Supabase 직접 쿼리를 사용한 텍스트 토큰 처리 (Prisma 연결 실패 대체)
   */
  private async processTextTokenUsageWithSupabase(
    userId: string,
    actualGeminiTokens: number,
    subscription: any,
    options?: { requestType?: string; description?: string }
  ): Promise<{
    success: boolean;
    remainingTextTokens?: number;
    userPlan?: string;
    monthlyLimit?: number;
    error?: string;
  }> {
    try {
      const supabase = await this.getSupabaseClient();

      if (!subscription) {
        return {
          success: false,
          error: '구독 정보가 없습니다'
        };
      }

      const { plan, textTokensTotal, textTokensUsed } = subscription;
      const remainingTokens = textTokensTotal - textTokensUsed;

      // 토큰 부족 검사
      if (remainingTokens < actualGeminiTokens) {
        console.warn(`❌ 텍스트 토큰 부족: ${remainingTokens}/${textTokensTotal} (필요: ${actualGeminiTokens})`);
        return {
          success: false,
          error: `텍스트 생성 토큰이 부족합니다 (${plan} 플랜: ${remainingTokens.toLocaleString()}/${textTokensTotal.toLocaleString()}토큰 잔여)`,
        };
      }

      // Supabase로 토큰 차감
      const { error: updateError } = await supabase
        .from('subscription')
        .update({
          textTokensUsed: textTokensUsed + actualGeminiTokens
        })
        .eq('userId', userId);

      if (updateError) {
        console.error('❌ 토큰 사용량 업데이트 실패:', updateError);
        return {
          success: false,
          error: '토큰 사용량 업데이트에 실패했습니다'
        };
      }

      console.log(`✅ 텍스트 토큰 사용 완료: ${actualGeminiTokens.toLocaleString()}토큰 (잔여: ${(remainingTokens - actualGeminiTokens).toLocaleString()}/${textTokensTotal.toLocaleString()})`);

      return {
        success: true,
        remainingTextTokens: remainingTokens - actualGeminiTokens,
        userPlan: plan,
        monthlyLimit: textTokensTotal
      };

    } catch (error) {
      console.error('❌ Supabase 텍스트 토큰 처리 오류:', error);
      return {
        success: false,
        error: '텍스트 토큰 처리 중 오류가 발생했습니다'
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
          error: "구독 정보가 없습니다" 
        };
      }

      const planConfig = PLAN_CONFIGS[subscription.plan as keyof typeof PLAN_CONFIGS] || PLAN_CONFIGS.FREE;
      // 레거시 호환: 이미지당 대략 1300 토큰으로 계산 (평균값)
      const tokensNeeded = imageCount * 1300;

      if (subscription.monthlyTokens < tokensNeeded) {
        return {
          success: false,
          remainingTokens: subscription.monthlyTokens,
          error: `토큰이 부족합니다. 필요: ${tokensNeeded.toLocaleString()}, 잔여: ${subscription.monthlyTokens.toLocaleString()}`
        };
      }

      // 토큰 차감
      const { error: updateError } = await supabase
        .from('subscription')
        .update({
          monthlyTokens: subscription.monthlyTokens - tokensNeeded
        })
        .eq('userId', userId);

      if (updateError) {
        return {
          success: false,
          error: "토큰 업데이트에 실패했습니다"
        };
      }

      return {
        success: true,
        remainingTokens: subscription.monthlyTokens - tokensNeeded
      };

    } catch (error) {
      secureError("토큰 사용 오류", error);
      return {
        success: false,
        error: "토큰 사용 중 오류가 발생했습니다"
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
      // 개발 모드에서는 기본값 반환
      if (process.env.NODE_ENV === 'development') {
        return {
          remainingTokens: 1000000, // 100만 토큰
          usedThisMonth: 0,
          monthlyLimit: 1000000,
          userPlan: 'PREMIUM'
        };
      }

      // 사용자 구독 정보 조회
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
        select: { 
          plan: true,
          textTokensTotal: true,
          textTokensUsed: true
        }
      });

      const userPlan = subscription?.plan || 'FREE';
      const monthlyLimit = subscription?.textTokensTotal || TEXT_GENERATION_CONFIG.PLAN_LIMITS[userPlan as keyof typeof TEXT_GENERATION_CONFIG.PLAN_LIMITS] || TEXT_GENERATION_CONFIG.PLAN_LIMITS.FREE;
      const usedThisMonth = subscription?.textTokensUsed || 0;
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

  /**
   * 이미지 생성 토큰 잔액 조회
   */
  async getImageGenerationBalance(userId: string): Promise<{
    remainingTokens: number;
    usedThisMonth: number;
    monthlyLimit: number;
    userPlan: string;
  }> {
    try {
      console.log('🔍 [getImageGenerationBalance] 시작:', { userId, NODE_ENV: process.env.NODE_ENV });

      // 개발 모드에서는 기본값 반환
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ [getImageGenerationBalance] 개발 모드 - 무제한 반환');
        return {
          remainingTokens: 1000000, // 100만 토큰
          usedThisMonth: 0,
          monthlyLimit: 1000000,
          userPlan: 'PREMIUM'
        };
      }

      console.log('🔍 [getImageGenerationBalance] Prisma 조회 시작...');

      // 사용자 구독 정보 조회
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
        select: {
          plan: true,
          imageTokensTotal: true,
          imageTokensUsed: true
        }
      });

      console.log('📊 [getImageGenerationBalance] 구독 정보:', {
        found: !!subscription,
        plan: subscription?.plan,
        imageTokensTotal: subscription?.imageTokensTotal,
        imageTokensUsed: subscription?.imageTokensUsed
      });

      const userPlan = subscription?.plan || 'FREE';

      // 🔥 ADMIN 계정은 무제한 토큰 반환
      if (userPlan === 'ADMIN') {
        const adminResult = {
          remainingTokens: subscription?.imageTokensTotal || 999999999,
          usedThisMonth: subscription?.imageTokensUsed || 0,
          monthlyLimit: subscription?.imageTokensTotal || 999999999,
          userPlan: 'ADMIN',
        };
        console.log('✅ [getImageGenerationBalance] ADMIN 계정 - 무제한 반환:', adminResult);
        return adminResult;
      }

      const planConfig = PLAN_CONFIGS[userPlan as keyof typeof PLAN_CONFIGS] || PLAN_CONFIGS.FREE;
      const monthlyLimit = subscription?.imageTokensTotal || planConfig.imageTokens || 0;
      const usedThisMonth = subscription?.imageTokensUsed || 0;
      const remainingTokens = monthlyLimit - usedThisMonth;

      const result = {
        remainingTokens: Math.max(0, remainingTokens),
        usedThisMonth,
        monthlyLimit,
        userPlan,
      };

      console.log('✅ [getImageGenerationBalance] 결과:', result);
      return result;

    } catch (error) {
      console.error("❌ [getImageGenerationBalance] 에러 발생:", error);
      secureError("이미지 토큰 잔액 조회 오류", error);

      // 🚨 Prisma 실패 시 Supabase 직접 쿼리로 재시도
      try {
        console.log('🔄 [getImageGenerationBalance] Supabase 직접 쿼리로 재시도...');
        const supabase = await this.getSupabaseClient();
        const { data: subscription, error: supabaseError } = await supabase
          .from('subscription')
          .select('plan, imageTokensTotal, imageTokensUsed')
          .eq('userId', userId)
          .single();

        if (supabaseError || !subscription) {
          console.error('❌ [getImageGenerationBalance] Supabase 쿼리도 실패:', supabaseError);
          throw supabaseError || new Error('구독 정보 없음');
        }

        console.log('✅ [getImageGenerationBalance] Supabase 쿼리 성공:', subscription);

        const userPlan = subscription.plan || 'FREE';

        // ADMIN 계정은 무제한 토큰 반환
        if (userPlan === 'ADMIN') {
          const adminResult = {
            remainingTokens: subscription.imageTokensTotal || 999999999,
            usedThisMonth: subscription.imageTokensUsed || 0,
            monthlyLimit: subscription.imageTokensTotal || 999999999,
            userPlan: 'ADMIN',
          };
          console.log('✅ [getImageGenerationBalance] ADMIN 계정 - Supabase에서 무제한 반환:', adminResult);
          return adminResult;
        }

        const monthlyLimit = subscription.imageTokensTotal || 0;
        const usedThisMonth = subscription.imageTokensUsed || 0;
        const remainingTokens = monthlyLimit - usedThisMonth;

        return {
          remainingTokens: Math.max(0, remainingTokens),
          usedThisMonth,
          monthlyLimit,
          userPlan,
        };
      } catch (fallbackError) {
        console.error("❌ [getImageGenerationBalance] Supabase 재시도도 실패:", fallbackError);
        return {
          remainingTokens: 0,
          usedThisMonth: 0,
          monthlyLimit: 0,
          userPlan: 'FREE',
        };
      }
    }
  }

  async checkQuota(userId: string): Promise<{
    hasQuota: boolean;
    remainingTokens: number;
    plan: string;
    error?: string;
  }> {
    try {
      const supabase = await this.getSupabaseClient();
      
      const { data: subscription } = await supabase
        .from('subscription')
        .select('*')
        .eq('userId', userId)
        .single();

      if (!subscription) {
        return {
          hasQuota: false,
          remainingTokens: 0,
          plan: 'FREE',
          error: "구독 정보가 없습니다"
        };
      }

      return {
        hasQuota: subscription.monthlyTokens > 0,
        remainingTokens: subscription.monthlyTokens,
        plan: subscription.plan
      };

    } catch (error) {
      secureError("할당량 확인 오류", error);
      return {
        hasQuota: false,
        remainingTokens: 0,
        plan: 'FREE',
        error: "할당량 확인 중 오류가 발생했습니다"
      };
    }
  }

  // 🎯 새로운 단순한 AI 대본 생성 시스템 (횟수 기반)

  /**
   * AI 대본 생성 횟수 1회 차감 (단순 시스템)
   */
  async useScriptGeneration(userId: string): Promise<{
    success: boolean;
    remainingGenerations?: number;
    userPlan?: string;
    monthlyLimit?: number;
    error?: string;
  }> {
    try {
      console.log(`📝 AI 대본 생성 횟수 차감 시도 (1회)`);

      // 개발 모드에서는 항상 성공
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 개발 모드: 대본 생성 횟수 차감 스킵');
        return {
          success: true,
          remainingGenerations: 999,
          userPlan: 'PREMIUM',
          monthlyLimit: 1000
        };
      }

      let subscription;
      try {
        subscription = await prisma.subscription.findUnique({
          where: { userId },
          select: { 
            plan: true,
            scriptGenerationsTotal: true,
            scriptGenerationsUsed: true
          }
        });
      } catch (prismaError) {
        console.warn('⚠️ Prisma 연결 실패, Supabase 직접 쿼리로 대체:', prismaError);
        
        const supabase = await this.getSupabaseClient();
        const { data: supabaseSubscription, error: queryError } = await supabase
          .from('subscription')
          .select('plan, scriptGenerationsTotal, scriptGenerationsUsed')
          .eq('userId', userId)
          .single();
        
        if (queryError) {
          console.error('❌ Supabase 구독 조회 실패:', queryError);
          return {
            success: false,
            error: '구독 정보 조회에 실패했습니다'
          };
        }

        return await this.processScriptGenerationWithSupabase(userId, supabaseSubscription);
      }

      if (!subscription) {
        return {
          success: false,
          error: '구독 정보가 없습니다'
        };
      }

      const { plan, scriptGenerationsTotal, scriptGenerationsUsed } = subscription;
      const remainingGenerations = scriptGenerationsTotal - scriptGenerationsUsed;

      // 횟수 부족 검사
      if (remainingGenerations < 1) {
        console.warn(`❌ 대본 생성 횟수 부족: ${remainingGenerations}/${scriptGenerationsTotal}`);
        return {
          success: false,
          error: `AI 대본 생성 횟수가 부족합니다 (${plan} 플랜: ${remainingGenerations}/${scriptGenerationsTotal}회 잔여)`,
        };
      }

      // 횟수 차감 (Prisma 시도)
      try {
        await prisma.subscription.update({
          where: { userId },
          data: {
            scriptGenerationsUsed: scriptGenerationsUsed + 1
          }
        });
      } catch (prismaError) {
        console.warn('⚠️ Prisma 횟수 업데이트 실패, Supabase 직접 업데이트:', prismaError);
        
        const supabase = await this.getSupabaseClient();
        const { error: updateError } = await supabase
          .from('subscription')
          .update({
            scriptGenerationsUsed: scriptGenerationsUsed + 1
          })
          .eq('userId', userId);

        if (updateError) {
          console.error('❌ Supabase 횟수 업데이트 실패:', updateError);
          return {
            success: false,
            error: '대본 생성 횟수 업데이트에 실패했습니다'
          };
        }
      }

      console.log(`✅ AI 대본 생성 횟수 차감 완료: 1회 (잔여: ${remainingGenerations - 1}/${scriptGenerationsTotal})`);

      return {
        success: true,
        remainingGenerations: remainingGenerations - 1,
        userPlan: plan,
        monthlyLimit: scriptGenerationsTotal
      };

    } catch (error) {
      secureError("AI 대본 생성 횟수 차감 오류", error);
      return {
        success: false,
        error: "대본 생성 횟수 차감 중 오류가 발생했습니다",
      };
    }
  }

  /**
   * Supabase 직접 쿼리를 사용한 대본 생성 횟수 처리
   */
  private async processScriptGenerationWithSupabase(
    userId: string,
    subscription: any
  ): Promise<{
    success: boolean;
    remainingGenerations?: number;
    userPlan?: string;
    monthlyLimit?: number;
    error?: string;
  }> {
    try {
      const supabase = await this.getSupabaseClient();

      if (!subscription) {
        return {
          success: false,
          error: '구독 정보가 없습니다'
        };
      }

      const { plan, scriptGenerationsTotal, scriptGenerationsUsed } = subscription;
      const remainingGenerations = scriptGenerationsTotal - scriptGenerationsUsed;

      // 횟수 부족 검사
      if (remainingGenerations < 1) {
        console.warn(`❌ 대본 생성 횟수 부족: ${remainingGenerations}/${scriptGenerationsTotal}`);
        return {
          success: false,
          error: `AI 대본 생성 횟수가 부족합니다 (${plan} 플랜: ${remainingGenerations}/${scriptGenerationsTotal}회 잔여)`,
        };
      }

      // Supabase로 횟수 차감
      const { error: updateError } = await supabase
        .from('subscription')
        .update({
          scriptGenerationsUsed: scriptGenerationsUsed + 1
        })
        .eq('userId', userId);

      if (updateError) {
        console.error('❌ 대본 생성 횟수 업데이트 실패:', updateError);
        return {
          success: false,
          error: '대본 생성 횟수 업데이트에 실패했습니다'
        };
      }

      console.log(`✅ AI 대본 생성 횟수 차감 완료: 1회 (잔여: ${remainingGenerations - 1}/${scriptGenerationsTotal})`);

      return {
        success: true,
        remainingGenerations: remainingGenerations - 1,
        userPlan: plan,
        monthlyLimit: scriptGenerationsTotal
      };

    } catch (error) {
      console.error('❌ Supabase 대본 생성 횟수 처리 오류:', error);
      return {
        success: false,
        error: '대본 생성 횟수 처리 중 오류가 발생했습니다'
      };
    }
  }

  /**
   * AI 대본 생성 잔여 횟수 조회 (단순 시스템)
   */
  async getScriptGenerationBalance(userId: string): Promise<{
    remainingGenerations: number;
    usedThisMonth: number;
    monthlyLimit: number;
    userPlan: string;
  }> {
    try {
      // 개발 모드에서는 기본값 반환
      if (process.env.NODE_ENV === 'development') {
        return {
          remainingGenerations: 999,
          usedThisMonth: 1,
          monthlyLimit: 1000,
          userPlan: 'PREMIUM'
        };
      }

      // 사용자 구독 정보 조회
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
        select: { 
          plan: true,
          scriptGenerationsTotal: true,
          scriptGenerationsUsed: true
        }
      });

      const userPlan = subscription?.plan || 'FREE';
      const planConfig = PLAN_CONFIGS[userPlan as keyof typeof PLAN_CONFIGS] || PLAN_CONFIGS.FREE;
      const monthlyLimit = subscription?.scriptGenerationsTotal || planConfig.scriptGenerations;
      const usedThisMonth = subscription?.scriptGenerationsUsed || 0;
      const remainingGenerations = monthlyLimit - usedThisMonth;

      return {
        remainingGenerations: Math.max(0, remainingGenerations),
        usedThisMonth,
        monthlyLimit,
        userPlan,
      };

    } catch (error) {
      secureError("AI 대본 생성 잔여 횟수 조회 오류", error);
      return {
        remainingGenerations: 0,
        usedThisMonth: 0,
        monthlyLimit: PLAN_CONFIGS.FREE.scriptGenerations,
        userPlan: 'FREE',
      };
    }
  }

  // 🚨 기존 AI 이미지 생성 API 호환성을 위한 메서드들 복구

  /**
   * 이미지 생성용 토큰 잔액 조회 (기존 API 호환)
   */
  async getBalance(userId: string): Promise<{
    balance: number;
    total: number;
    estimatedImagesRemaining: number;
    userPlan: string;
  }> {
    try {
      // 개발 모드에서는 무제한 반환
      if (process.env.NODE_ENV === 'development') {
        return {
          balance: 999999,
          total: 999999,
          estimatedImagesRemaining: 999,
          userPlan: 'PREMIUM'
        };
      }

      const imageBalance = await this.getImageGenerationBalance(userId);
      
      return {
        balance: imageBalance.remainingTokens,
        total: imageBalance.monthlyLimit,
        estimatedImagesRemaining: Math.floor(imageBalance.remainingTokens / 1300), // 평균 1300토큰/이미지
        userPlan: imageBalance.userPlan
      };

    } catch (error) {
      secureError("이미지 토큰 잔액 조회 오류", error);
      return {
        balance: 0,
        total: 0,
        estimatedImagesRemaining: 0,
        userPlan: 'FREE'
      };
    }
  }

  /**
   * 낮은 잔액 확인 (기존 API 호환)
   */
  async checkLowBalance(userId: string): Promise<{
    isLowBalance: boolean;
    threshold: number;
    currentBalance: number;
  }> {
    try {
      const balance = await this.getBalance(userId);
      const threshold = balance.total * 0.1; // 10% 미만이면 낮은 잔액
      
      return {
        isLowBalance: balance.balance < threshold,
        threshold,
        currentBalance: balance.balance
      };

    } catch (error) {
      secureError("낮은 잔액 확인 오류", error);
      return {
        isLowBalance: true,
        threshold: 0,
        currentBalance: 0
      };
    }
  }

  /**
   * 월별 수익 분석 (기존 API 호환 - 단순화)
   */
  async getMonthlyProfitAnalysis(userId: string): Promise<{
    totalSpent: number;
    totalGenerated: number;
    efficiency: number;
  }> {
    try {
      // 단순화된 분석 (실제 구현은 복잡할 수 있음)
      return {
        totalSpent: 0,
        totalGenerated: 0,
        efficiency: 0
      };

    } catch (error) {
      secureError("월별 수익 분석 오류", error);
      return {
        totalSpent: 0,
        totalGenerated: 0,
        efficiency: 0
      };
    }
  }

  /**
   * 사용 내역 조회 (기존 API 호환 - 단순화)
   */
  async getUsageHistory(userId: string, limit: number = 20): Promise<any[]> {
    try {
      // 단순화된 내역 (실제로는 Transaction 테이블에서 조회)
      return [];

    } catch (error) {
      secureError("사용 내역 조회 오류", error);
      return [];
    }
  }
}

export const tokenManager = TokenManager.getInstance();