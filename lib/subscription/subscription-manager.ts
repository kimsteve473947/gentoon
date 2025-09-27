/**
 * 🎯 완벽한 구독 플랜 변경 관리 시스템
 * - 업그레이드/다운그레이드/신규 구독 처리
 * - 안전한 데이터 업데이트 및 결제 처리
 * - 관리자 수동 변경 지원
 */

import { createClient } from '@/lib/supabase/server';
import { PLAN_CONFIGS, type PlanType } from './plan-config';
import { executeAutoBilling, type TossPaymentsError } from '@/lib/payments/toss-billing-supabase';
import { updateStorageLimit, type MembershipType } from '@/lib/storage/storage-manager';
import { initializeTokenResetForNewSubscription } from './token-reset';

export interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  currentPlan?: PlanType;
  subscriptionId?: string;
  billingKey?: string;
  customerKey?: string;
  currentPeriodEnd?: Date;
  tokensUsed?: number;
  tokensTotal?: number;
}

export interface PlanChangeResult {
  success: boolean;
  changeType: 'new' | 'upgrade' | 'downgrade' | 'same' | 'admin';
  previousPlan?: PlanType;
  newPlan: PlanType;
  amountCharged?: number;
  refundAmount?: number;
  subscriptionId: string;
  paymentKey?: string;
  error?: string;
}

export type PlanChangeType = 'new' | 'upgrade' | 'downgrade' | 'same';

/**
 * 현재 구독 상태 조회
 */
export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  try {
    const supabase = await createClient();
    
    const { data: subscription, error } = await supabase
      .from('subscription')
      .select('*')
      .eq('userId', userId)
      .single();
    
    if (error || !subscription) {
      return { hasActiveSubscription: false };
    }
    
    return {
      hasActiveSubscription: true,
      currentPlan: subscription.plan as PlanType,
      subscriptionId: subscription.id,
      billingKey: subscription.tossBillingKey,
      customerKey: subscription.tossCustomerKey,
      currentPeriodEnd: subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : undefined,
      tokensUsed: subscription.tokensUsed || 0,
      tokensTotal: subscription.tokensTotal || 0,
    };
  } catch (error) {
    console.error('구독 상태 조회 오류:', error);
    return { hasActiveSubscription: false };
  }
}

/**
 * 플랜 변경 유형 판단
 */
export function determinePlanChangeType(currentPlan: PlanType | undefined, newPlan: PlanType): PlanChangeType {
  if (!currentPlan) return 'new';
  if (currentPlan === newPlan) return 'same';
  
  const planPriority: Record<PlanType, number> = {
    'FREE': 0,
    'STARTER': 1,
    'PRO': 2,
    'PREMIUM': 3,
    'ADMIN': 999
  };
  
  const currentPriority = planPriority[currentPlan];
  const newPriority = planPriority[newPlan];
  
  return newPriority > currentPriority ? 'upgrade' : 'downgrade';
}

/**
 * 차액 계산 (다운그레이드 정책 포함)
 */
export function calculatePlanChangeCost(
  currentPlan: PlanType | undefined, 
  newPlan: PlanType,
  discountAmount?: number
): { chargeAmount: number; refundAmount: number; isDowngrade: boolean } {
  if (!currentPlan) {
    // 신규 구독
    const newPlanPrice = PLAN_CONFIGS[newPlan].price;
    return { 
      chargeAmount: discountAmount || newPlanPrice, 
      refundAmount: 0,
      isDowngrade: false
    };
  }
  
  const currentPrice = PLAN_CONFIGS[currentPlan].price;
  const newPrice = PLAN_CONFIGS[newPlan].price;
  const finalNewPrice = discountAmount || newPrice;
  
  if (finalNewPrice > currentPrice) {
    // 업그레이드: 차액 즉시 결제
    return { 
      chargeAmount: finalNewPrice - currentPrice, 
      refundAmount: 0,
      isDowngrade: false
    };
  } else if (finalNewPrice < currentPrice) {
    // 다운그레이드: 다음 결제일에 적용 (즉시 결제 없음)
    return { 
      chargeAmount: 0, 
      refundAmount: 0,
      isDowngrade: true
    };
  } else {
    // 동일한 가격
    return { 
      chargeAmount: 0, 
      refundAmount: 0,
      isDowngrade: false
    };
  }
}

/**
 * 안전한 구독 데이터 업데이트 (다운그레이드 정책 포함)
 */
export async function updateSubscriptionSafely(
  userId: string,
  newPlan: PlanType,
  billingKey?: string,
  customerKey?: string,
  paymentMethod?: string,
  subscriptionId?: string,
  isDowngrade: boolean = false,
  cardInfo?: any
): Promise<{ subscriptionId: string; subscription: any }> {
  const supabase = await createClient();
  const newPlanConfig = PLAN_CONFIGS[newPlan];
  
  let subscriptionData: any = {
    tossBillingKey: billingKey,
    tossCustomerKey: customerKey,
    paymentMethod: paymentMethod || 'CARD',
    updatedAt: new Date().toISOString(),
  };
  
  // 카드 정보가 있으면 저장
  if (cardInfo) {
    subscriptionData.cardLast4 = cardInfo.number?.slice(-4) || cardInfo.cardLast4;
    subscriptionData.cardBrand = cardInfo.issuerCode === '61' ? 'BC카드' : 
                                 cardInfo.issuerCode === '11' ? '국민카드' :
                                 cardInfo.issuerCode === '31' ? '삼성카드' :
                                 cardInfo.issuerCode === '51' ? '신한카드' :
                                 cardInfo.issuerCode === '71' ? '하나카드' :
                                 cardInfo.cardType || 'CARD';
  }
  
  if (isDowngrade) {
    // 다운그레이드: 다음 결제일에 적용되도록 예약
    console.log('🔄 다운그레이드 예약 - 다음 결제일에 적용됩니다');
    subscriptionData.pendingPlan = newPlan; // 예약된 플랜
    subscriptionData.cancelAtPeriodEnd = false; // 취소는 아니고 플랜 변경 예약
    // 현재 플랜과 혜택은 유지
  } else {
    // 업그레이드 또는 신규: 즉시 적용
    console.log('⚡ 플랜 즉시 적용');
    subscriptionData.plan = newPlan;
    subscriptionData.tokensTotal = newPlanConfig.platformTokens;
    subscriptionData.tokensUsed = 0; // 플랜 변경 시 토큰 사용량 리셋
    subscriptionData.maxCharacters = newPlanConfig.maxCharacters === Infinity ? 999 : newPlanConfig.maxCharacters;
    subscriptionData.maxProjects = newPlanConfig.maxCharacters === 2 ? 3 : 
                     newPlanConfig.maxCharacters === 5 ? 10 :
                     newPlanConfig.maxCharacters === 10 ? 25 : 
                     newPlanConfig.maxCharacters === 20 ? 50 : 999;
    subscriptionData.currentPeriodStart = new Date().toISOString();
    subscriptionData.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    subscriptionData.cancelAtPeriodEnd = false;
  }
  
  let result;
  
  if (subscriptionId) {
    // 기존 구독 업데이트
    const { data, error } = await supabase
      .from('subscription')
      .update(subscriptionData)
      .eq('id', subscriptionId)
      .eq('userId', userId) // 보안: userId도 함께 체크
      .select()
      .single();
    
    if (error) {
      console.error('구독 업데이트 오류:', error);
      throw new Error(`구독 업데이트 실패: ${error.message}`);
    }
    
    result = { subscriptionId, subscription: data };
  } else {
    // 신규 구독 생성
    const { data, error } = await supabase
      .from('subscription')
      .insert({
        userId,
        ...subscriptionData,
      })
      .select()
      .single();
    
    if (error) {
      console.error('구독 생성 오류:', error);
      throw new Error(`구독 생성 실패: ${error.message}`);
    }
    
    result = { subscriptionId: data.id, subscription: data };
  }
  
  console.log(`✅ 구독 ${subscriptionId ? '업데이트' : '생성'} 성공:`, result);
  return result;
}

/**
 * 리소스 재조정 (토큰, 용량, 캐릭터 한도)
 */
export async function adjustResourcesForNewPlan(userId: string, newPlan: PlanType): Promise<void> {
  console.log(`🔧 ${newPlan} 플랜에 맞는 리소스 재조정 시작...`);
  
  // 스토리지 제한 업데이트
  const membershipType = newPlan as MembershipType;
  try {
    await updateStorageLimit(userId, membershipType);
    console.log(`✅ 스토리지 제한 업데이트 완료: ${PLAN_CONFIGS[newPlan].storageLimit} bytes`);
  } catch (error) {
    console.error('스토리지 제한 업데이트 오류:', error);
    throw error;
  }
  
  // 토큰 리셋 날짜 초기화
  try {
    await initializeTokenResetForNewSubscription(userId, newPlan, new Date());
    console.log(`✅ 토큰 리셋 일정 초기화 완료`);
  } catch (error) {
    console.error('토큰 리셋 초기화 오류:', error);
    throw error;
  }
}

/**
 * 결제 처리 (업그레이드 시 차액 결제)
 */
export async function processPaymentForPlanChange(
  billingKey: string,
  customerKey: string,
  chargeAmount: number,
  planName: string,
  userId: string,
  changeType: PlanChangeType
): Promise<{ paymentKey?: string; orderId?: string } | null> {
  if (chargeAmount <= 0) {
    console.log('결제할 금액이 없어 결제 생략');
    return null;
  }
  
  console.log(`💳 ${changeType} 차액 결제 시작: ${chargeAmount}원`);
  
  try {
    const payment = await executeAutoBilling(
      billingKey,
      customerKey,
      chargeAmount,
      `GenToon ${planName} 플랜 ${changeType === 'upgrade' ? '업그레이드' : '변경'}`,
      `plan_${changeType}_${Date.now()}_${userId}`
    );
    
    console.log('✅ 차액 결제 성공:', payment);
    return payment;
  } catch (error) {
    console.error('❌ 차액 결제 실패:', error);
    throw error;
  }
}

/**
 * 트랜잭션 기록 생성 (중복 방지)
 */
export async function createTransactionRecord(
  userId: string,
  amount: number,
  tokens: number,
  planName: string,
  changeType: PlanChangeType,
  paymentKey?: string,
  orderId?: string
): Promise<void> {
  if (amount <= 0) {
    console.log('결제 금액이 0원이므로 트랜잭션 기록 생략');
    return;
  }
  
  const supabase = await createClient();
  
  // 동일한 paymentKey가 있는지 확인 (중복 방지)
  if (paymentKey) {
    const { data: existingTransaction } = await supabase
      .from('transaction')
      .select('id')
      .eq('tossPaymentKey', paymentKey)
      .single();
    
    if (existingTransaction) {
      console.log('ℹ️ 동일한 paymentKey로 이미 생성된 트랜잭션이 있음:', paymentKey);
      return;
    }
  }
  
  const { data, error } = await supabase
    .from('transaction')
    .insert({
      userId,
      type: "SUBSCRIPTION",
      amount,
      tokens,
      status: "COMPLETED",
      description: `${planName} 플랜 ${changeType === 'upgrade' ? '업그레이드' : '변경'}`,
      tossPaymentKey: paymentKey,
      tossOrderId: orderId,
    })
    .select()
    .single();
  
  if (error) {
    console.error('트랜잭션 기록 생성 오류:', error);
    throw error;
  }
  
  console.log('✅ 트랜잭션 기록 생성 완료:', data);
}

/**
 * 관리자 사용자 확인
 */
export function isAdminUser(userId: string): boolean {
  const adminUserIds = [
    '4e10fdf1-dc5e-423c-a303-8731be910168', // 김중휘
    // 여기에 다른 관리자 ID 추가 가능
  ];
  return adminUserIds.includes(userId);
}

/**
 * 🎯 메인 플랜 변경 함수 (완벽한 처리)
 */
export async function changePlan(
  userId: string,
  newPlan: PlanType,
  billingKey?: string,
  customerKey?: string,
  paymentMethod?: string,
  discountAmount?: number,
  isAdminChange: boolean = false,
  cardInfo?: any
): Promise<PlanChangeResult> {
  console.log(`🚀 플랜 변경 시작: userId=${userId}, newPlan=${newPlan}, isAdmin=${isAdminChange}`);
  
  try {
    // 🛡️ 관리자 사용자 보호: 관리자는 항상 ADMIN 권한 유지
    if (isAdminUser(userId) && !isAdminChange) {
      console.log('🛡️ 관리자 사용자 감지 - ADMIN 권한으로 자동 조정');
      newPlan = 'ADMIN';
    }
    
    // 1. 현재 구독 상태 확인
    const status = await getSubscriptionStatus(userId);
    console.log('📊 현재 구독 상태:', status);
    
    // 2. 변경 유형 판단
    const changeType = isAdminChange ? 'admin' : determinePlanChangeType(status.currentPlan, newPlan);
    console.log('🔄 변경 유형:', changeType);
    
    // 3. 동일 플랜 변경 시도 차단 (관리자 제외)
    if (changeType === 'same' && !isAdminChange) {
      return {
        success: false,
        changeType,
        previousPlan: status.currentPlan,
        newPlan,
        subscriptionId: status.subscriptionId || '',
        error: '이미 동일한 플랜을 사용 중입니다.'
      };
    }
    
    // 4. 결제 금액 계산 (다운그레이드 정책 포함)
    const { chargeAmount, refundAmount, isDowngrade } = calculatePlanChangeCost(
      status.currentPlan, 
      newPlan, 
      discountAmount
    );
    console.log('💰 결제 정보:', { chargeAmount, refundAmount, isDowngrade });
    
    // 5. 결제 처리 (업그레이드 시에만)
    let payment = null;
    if (chargeAmount > 0 && !isAdminChange) {
      if (!billingKey || !customerKey) {
        throw new Error('결제 정보가 누락되었습니다.');
      }
      
      payment = await processPaymentForPlanChange(
        billingKey,
        customerKey,
        chargeAmount,
        PLAN_CONFIGS[newPlan].name,
        userId,
        changeType as PlanChangeType
      );
    }
    
    // 6. 구독 데이터 안전 업데이트 (다운그레이드 정책 적용)
    const { subscriptionId } = await updateSubscriptionSafely(
      userId,
      newPlan,
      billingKey || status.billingKey,
      customerKey || status.customerKey,
      paymentMethod,
      status.subscriptionId,
      isDowngrade && !isAdminChange, // 관리자 변경이 아닌 다운그레이드만 지연 적용
      cardInfo // 카드 정보 전달
    );
    
    // 7. 리소스 재조정 (다운그레이드가 아니거나 관리자 변경인 경우에만 즉시 적용)
    if (!isDowngrade || isAdminChange) {
      await adjustResourcesForNewPlan(userId, newPlan);
    } else {
      console.log('🔄 다운그레이드 - 리소스는 다음 결제일에 조정됩니다');
    }
    
    // 8. 트랜잭션 기록 생성
    if (!isAdminChange) {
      await createTransactionRecord(
        userId,
        chargeAmount,
        PLAN_CONFIGS[newPlan].platformTokens,
        PLAN_CONFIGS[newPlan].name,
        changeType as PlanChangeType,
        payment?.paymentKey,
        payment?.orderId
      );
    }
    
    console.log(`✅ 플랜 변경 완료: ${status.currentPlan || 'FREE'} → ${newPlan}`);
    
    return {
      success: true,
      changeType: changeType as any,
      previousPlan: status.currentPlan,
      newPlan,
      amountCharged: chargeAmount,
      refundAmount,
      subscriptionId,
      paymentKey: payment?.paymentKey,
    };
    
  } catch (error) {
    console.error('❌ 플랜 변경 실패:', error);
    
    return {
      success: false,
      changeType: 'new',
      newPlan,
      subscriptionId: '',
      error: error instanceof Error ? error.message : '플랜 변경 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 관리자용 수동 플랜 변경
 */
export async function adminChangePlan(
  userId: string,
  newPlan: PlanType,
  reason?: string
): Promise<PlanChangeResult> {
  console.log(`👨‍💼 관리자 플랜 변경: userId=${userId}, newPlan=${newPlan}, reason=${reason}`);
  
  const result = await changePlan(userId, newPlan, undefined, undefined, undefined, undefined, true);
  
  if (result.success && reason) {
    // 관리자 변경 로그 기록
    const supabase = await createClient();
    await supabase
      .from('transaction')
      .insert({
        userId,
        type: "SUBSCRIPTION",
        amount: 0,
        tokens: PLAN_CONFIGS[newPlan].platformTokens,
        status: "COMPLETED",
        description: `관리자 플랜 변경: ${result.previousPlan || 'FREE'} → ${newPlan} (사유: ${reason})`,
      });
  }
  
  return result;
}