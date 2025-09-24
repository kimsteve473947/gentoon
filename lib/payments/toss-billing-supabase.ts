import { loadTossPayments } from "@tosspayments/payment-sdk";
import { createClient } from "@/lib/supabase/server";
import { tokenManager } from "@/lib/subscription/token-manager";

// 토스페이먼츠 빌링 v2 API 클라이언트
const TOSS_API_BASE_URL = "https://api.tosspayments.com/v1";
const BILLING_AUTH_API = `${TOSS_API_BASE_URL}/billing/authorizations`;
const BILLING_API = `${TOSS_API_BASE_URL}/billing`;

// API 인증 헤더 생성
function createAuthHeader(): string {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    throw new Error("TOSS_SECRET_KEY 환경변수가 설정되지 않았습니다");
  }
  return `Basic ${Buffer.from(secretKey + ":").toString("base64")}`;
}

// 구독 플랜 정보 (실제 Gemini API 비용 기반)
export const SUBSCRIPTION_PLANS = {
  FREE: {
    id: "FREE",
    name: "Free",
    price: 0,
    tokens: 10000,      // 1만 토큰
    characters: 1,
    projects: 3,
    description: "취미로 시작하는 분들께",
  },
  PRO: {
    id: "PRO",
    name: "Basic",
    price: 30000,
    tokens: 400000,     // 40만 토큰
    characters: 3,
    projects: Infinity,
    description: "정기적으로 창작하는 분들께",
  },
  PREMIUM: {
    id: "PREMIUM",
    name: "Pro",
    price: 100000,
    tokens: 1500000,    // 150만 토큰
    characters: 5,
    projects: Infinity,
    description: "전문 창작자를 위한",
  },
};

// 토스페이먼츠 에러 클래스
export class TossPaymentsError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "TossPaymentsError";
  }

  // 사용자 친화적 메시지 반환
  getUserFriendlyMessage(): string {
    switch (this.code) {
      case "PAY_PROCESS_CANCELED":
        return "결제가 취소되었습니다.";
      case "REJECT_CARD_COMPANY":
        return "카드사에서 결제를 거부했습니다. 다른 카드를 사용해주세요.";
      case "INVALID_CARD_EXPIRATION":
        return "카드 유효기간이 만료되었습니다.";
      case "NOT_SUPPORTED_CARD_TYPE":
        return "지원하지 않는 카드입니다.";
      case "EXCEED_MAX_AUTH_COUNT":
        return "결제 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.";
      case "BILLING_KEY_NOT_FOUND":
        return "등록된 카드 정보를 찾을 수 없습니다. 카드를 다시 등록해주세요.";
      case "UNAUTHORIZED_KEY":
        return "인증되지 않은 키입니다.";
      case "FORBIDDEN_REQUEST":
        return "허용되지 않은 요청입니다.";
      case "INVALID_REQUEST":
        return "잘못된 요청입니다.";
      default:
        return "결제 처리 중 오류가 발생했습니다. 고객센터에 문의해주세요.";
    }
  }
}

// 빌링키 발급 요청 생성 (토스페이먼츠 v2 API 준수)
export async function createBillingAuthRequest(
  userId: string,
  planId: keyof typeof SUBSCRIPTION_PLANS,
  customerEmail: string,
  customerName?: string,
  discountedAmount?: number
) {
  const plan = SUBSCRIPTION_PLANS[planId];
  const customerKey = `customer_${userId}`; // 고객 고유 키 (영숫자, 하이픈, 언더스코어만 허용)
  const amount = discountedAmount || plan.price;
  
  return {
    customerKey,
    customerEmail,
    customerName: customerName || "고객",
    successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/billing-success?planId=${planId}&customerKey=${customerKey}&amount=${amount}`,
    failUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/billing-fail`,
  };
}

// 빌링키 발급 (authKey로 빌링키 조회)
export async function issueBillingKey(
  authKey: string,
  customerKey: string
): Promise<{ billingKey: string; card: any }> {
  try {
    const response = await fetch(`${BILLING_AUTH_API}/${authKey}`, {
      method: "POST",
      headers: {
        Authorization: createAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerKey,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new TossPaymentsError(error.code, error.message);
    }

    const data = await response.json();
    return {
      billingKey: data.billingKey,
      card: data.card,
    };
  } catch (error) {
    console.error("Issue billing key error:", error);
    throw error;
  }
}

// 자동결제 승인 (빌링키로 정기결제 실행)
export async function executeAutoBilling(
  billingKey: string,
  customerKey: string,
  amount: number,
  orderName: string,
  orderId?: string
): Promise<any> {
  try {
    const response = await fetch(BILLING_API, {
      method: "POST",
      headers: {
        Authorization: createAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        billingKey,
        customerKey,
        amount,
        orderId: orderId || `auto_${Date.now()}_${customerKey}`,
        orderName,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new TossPaymentsError(error.code, error.message);
    }

    return await response.json();
  } catch (error) {
    console.error("Auto billing error:", error);
    throw error;
  }
}

// 구독 생성 또는 업그레이드 (빌링키 등록 후 첫 결제) - Supabase 버전
export async function createOrUpdateSubscription(
  userId: string,
  planId: keyof typeof SUBSCRIPTION_PLANS,
  billingKey: string,
  customerKey: string,
  cardInfo: any,
  discountedAmount?: number
) {
  try {
    const plan = SUBSCRIPTION_PLANS[planId];
    const supabase = await createClient();
    
    // 기존 구독 조회
    const { data: existingSubscription } = await supabase
      .from('subscription')
      .select('*')
      .eq('userId', userId)
      .single();
    
    const subscriptionData = {
      plan: planId,
      tokensTotal: plan.tokens,
      tokensUsed: existingSubscription?.tokensUsed || 0,
      maxCharacters: plan.characters === Infinity ? 999 : plan.characters,
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      tossBillingKey: billingKey,
      tossCustomerKey: customerKey,
      cancelAtPeriodEnd: false,
    };
    
    // 구독 생성 또는 업데이트
    let subscription;
    if (existingSubscription) {
      const { data, error } = await supabase
        .from('subscription')
        .update(subscriptionData)
        .eq('userId', userId)
        .select()
        .single();
      
      if (error) throw error;
      subscription = data;
    } else {
      const { data, error } = await supabase
        .from('subscription')
        .insert({
          userId,
          ...subscriptionData,
        })
        .select()
        .single();
      
      if (error) throw error;
      subscription = data;
    }
    
    // 첫 결제 실행 (구독 시작)
    const finalAmount = discountedAmount || plan.price;
    const payment = await executeAutoBilling(
      billingKey,
      customerKey,
      finalAmount,
      `GenToon ${plan.name} 플랜 구독 시작${discountedAmount ? ' (할인 적용)' : ''}`,
      `sub_start_${Date.now()}_${userId}`
    );
    
    // 결제 기록 생성
    await supabase
      .from('transaction')
      .insert({
        userId,
        type: "SUBSCRIPTION",
        amount: finalAmount,
        tokens: plan.tokens,
        status: "COMPLETED",
        description: `${plan.name} 플랜 구독 시작${discountedAmount ? ' (추천인 할인 적용)' : ''}`,
        tossPaymentKey: payment.paymentKey,
        tossOrderId: payment.orderId,
      });
    
    // 카드 정보 로깅 (보안상 마스킹)
    console.log(`Subscription created for user ${userId} with card ending in ${cardInfo.number?.slice(-4)}`);
    
    return { subscription, payment };
  } catch (error) {
    console.error("Subscription creation error:", error);
    throw error;
  }
}

// 구독 취소 (빌링키는 유지, 다음 결제만 중지)
export async function cancelSubscription(userId: string) {
  try {
    const supabase = await createClient();
    
    const { data: subscription, error } = await supabase
      .from('subscription')
      .update({ cancelAtPeriodEnd: true })
      .eq('userId', userId)
      .select()
      .single();
    
    if (error) throw error;
    return subscription;
  } catch (error) {
    console.error("Subscription cancellation error:", error);
    throw error;
  }
}

// 자동 결제 처리 (크론잡에서 실행) - Supabase 버전
export async function processRecurringPayments() {
  try {
    const supabase = await createClient();
    
    // 결제일이 된 활성 구독 조회 (하루 전부터 처리)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const { data: subscriptions, error } = await supabase
      .from('subscription')
      .select(`
        *,
        user!inner(*)
      `)
      .eq('cancelAtPeriodEnd', false)
      .lte('currentPeriodEnd', tomorrow.toISOString())
      .not('tossBillingKey', 'is', null)
      .not('tossCustomerKey', 'is', null);
    
    if (error) throw error;

    console.log(`Found ${subscriptions?.length || 0} subscriptions to renew`);
    const results = [];
    
    for (const subscription of subscriptions || []) {
      try {
        const plan = SUBSCRIPTION_PLANS[subscription.plan as keyof typeof SUBSCRIPTION_PLANS];
        if (!plan) {
          throw new Error(`Invalid plan: ${subscription.plan}`);
        }
        
        // 자동결제 실행
        const payment = await executeAutoBilling(
          subscription.tossBillingKey!,
          subscription.tossCustomerKey!,
          plan.price,
          `GenToon ${plan.name} 플랜 정기결제`,
          `recurring_${Date.now()}_${subscription.userId}`
        );
        
        // 구독 기간 갱신 및 토큰 리셋
        const newPeriodStart = new Date();
        const newPeriodEnd = new Date(newPeriodStart);
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1); // 정확한 1개월 후
        
        await supabase
          .from('subscription')
          .update({
            currentPeriodStart: newPeriodStart.toISOString(),
            currentPeriodEnd: newPeriodEnd.toISOString(),
            tokensTotal: plan.tokens,
            tokensUsed: 0, // 토큰 사용량 리셋
          })
          .eq('id', subscription.id);
        
        // 결제 성공 기록
        await supabase
          .from('transaction')
          .insert({
            userId: subscription.userId,
            type: "SUBSCRIPTION",
            amount: plan.price,
            tokens: plan.tokens,
            status: "COMPLETED",
            description: `${plan.name} 플랜 정기결제 (${newPeriodStart.toLocaleDateString()})`,
            tossPaymentKey: payment.paymentKey,
            tossOrderId: payment.orderId,
          });
        
        results.push({
          subscriptionId: subscription.id,
          userId: subscription.userId,
          planId: subscription.plan,
          status: "success",
          amount: plan.price,
          paymentKey: payment.paymentKey,
          nextBillingDate: newPeriodEnd.toISOString(),
        });
        
        console.log(`Recurring payment successful for user ${subscription.userId}`);
      } catch (error) {
        console.error(`Recurring payment failed for subscription ${subscription.id}:`, error);
        
        const errorMessage = error instanceof TossPaymentsError 
          ? error.getUserFriendlyMessage() 
          : "정기결제 처리 중 오류가 발생했습니다";
        
        // 결제 실패 기록
        await supabase
          .from('transaction')
          .insert({
            userId: subscription.userId,
            type: "SUBSCRIPTION",
            amount: 0,
            status: "FAILED",
            description: `정기결제 실패: ${errorMessage}`,
          });
        
        // 3회 연속 실패 시 구독 자동 취소 로직
        const { count: recentFailures } = await supabase
          .from('transaction')
          .select('*', { count: 'exact', head: true })
          .eq('userId', subscription.userId)
          .eq('type', 'SUBSCRIPTION')
          .eq('status', 'FAILED')
          .gte('createdAt', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
        
        if (recentFailures && recentFailures >= 3) {
          await supabase
            .from('subscription')
            .update({ cancelAtPeriodEnd: true })
            .eq('id', subscription.id);
          
          console.log(`Auto-cancelled subscription ${subscription.id} due to repeated failures`);
        }
        
        results.push({
          subscriptionId: subscription.id,
          userId: subscription.userId,
          status: "failed",
          error: errorMessage,
          failureCount: recentFailures || 0,
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error("Process recurring payments error:", error);
    throw error;
  }
}

// 결제 검증 (웹훅 처리용)
export async function verifyPayment(paymentKey: string, orderId: string, amount: number) {
  try {
    const response = await fetch(`${TOSS_API_BASE_URL}/payments/confirm`, {
      method: "POST",
      headers: {
        Authorization: createAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new TossPaymentsError(error.code, error.message);
    }
    
    const payment = await response.json();
    return payment;
  } catch (error) {
    console.error("Payment verification error:", error);
    throw error;
  }
}

// 환불 처리
export async function processRefund(
  userId: string,
  transactionId: string,
  refundAmount: number,
  reason: string
) {
  try {
    const supabase = await createClient();
    
    // 트랜잭션 조회
    const { data: transaction, error: fetchError } = await supabase
      .from('transaction')
      .select('*')
      .eq('id', transactionId)
      .single();
    
    if (fetchError || !transaction || !transaction.tossPaymentKey) {
      throw new Error("결제 정보를 찾을 수 없습니다");
    }
    
    // Toss API로 환불 요청
    const response = await fetch(
      `${TOSS_API_BASE_URL}/payments/${transaction.tossPaymentKey}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: createAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cancelReason: reason,
          cancelAmount: refundAmount,
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new TossPaymentsError(error.code, error.message);
    }
    
    // 트랜잭션 상태 업데이트
    await supabase
      .from('transaction')
      .update({ status: "REFUNDED" })
      .eq('id', transactionId);
    
    // 환불 기록 생성
    await supabase
      .from('transaction')
      .insert({
        userId,
        type: "REFUND",
        amount: -refundAmount,
        status: "COMPLETED",
        description: `환불: ${reason}`,
      });
    
    return true;
  } catch (error) {
    console.error("Refund processing error:", error);
    throw error;
  }
}

// 결제 내역 조회
export async function getPaymentHistory(userId: string, limit = 10) {
  try {
    const supabase = await createClient();
    
    const { data: transactions, error } = await supabase
      .from('transaction')
      .select('*')
      .eq('userId', userId)
      .in('type', ["SUBSCRIPTION", "TOKEN_PURCHASE", "REFUND"])
      .order('createdAt', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return transactions || [];
  } catch (error) {
    console.error("Get payment history error:", error);
    return [];
  }
}

// 토스 SDK 초기화
export async function getTossClient() {
  const tossPayments = await loadTossPayments(
    process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!
  );
  return tossPayments;
}