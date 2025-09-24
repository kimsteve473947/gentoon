import { loadTossPayments } from "@tosspayments/payment-sdk";
import { createClient } from "@/lib/supabase/server";
import { tokenManager } from "@/lib/subscription/token-manager";

// token-manager.ts에서 플랜 설정 가져오기
const SUBSCRIPTION_CONFIG = {
  FREE: {
    id: "FREE",
    name: "무료",
    price: 0,
    tokens: 10000,      // 1만 토큰
    characters: 2,
    projects: 3,
    description: "무료 체험용 플랜",
  },
  PRO: {
    id: "PRO",
    name: "베이직",
    price: 30000,
    tokens: 400000,     // 40만 토큰
    characters: 7,
    projects: 999,
    description: "정기적으로 창작하는 분들께",
  },
  PREMIUM: {
    id: "PREMIUM",
    name: "프로",
    price: 100000,
    tokens: 1500000,    // 150만 토큰
    characters: 15,
    projects: 999,
    description: "전문 창작자를 위한",
  },
} as const;

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

// 기존 SUBSCRIPTION_PLANS 대신 SUBSCRIPTION_CONFIG 사용
export const SUBSCRIPTION_PLANS = SUBSCRIPTION_CONFIG;

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

// 구독 생성 또는 업그레이드 (빌링키 등록 후 첫 결제) - 🚀 트랜잭션 적용
export async function createOrUpdateSubscription(
  userId: string,
  planId: keyof typeof SUBSCRIPTION_PLANS,
  billingKey: string,
  customerKey: string,
  cardInfo: any,
  discountedAmount?: number
) {
  // 🚀 데이터베이스 트랜잭션으로 데이터 일관성 보장
  return await prisma.$transaction(async (tx) => {
    const plan = SUBSCRIPTION_PLANS[planId];
    
    // 기존 구독 조회 (트랜잭션 내에서)
    const existingSubscription = await tx.subscription.findUnique({
      where: { userId },
    });
    
    const subscriptionData = {
      plan: planId as SubscriptionPlan,
      tokensTotal: plan.tokens,
      tokensUsed: existingSubscription?.tokensUsed || 0,
      maxCharacters: plan.characters === Infinity ? 999 : plan.characters,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      tossBillingKey: billingKey,
      tossCustomerKey: customerKey,
      cancelAtPeriodEnd: false,
      nextTokensReset: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
    
    // 구독 생성 또는 업데이트 (트랜잭션 내에서)
    const subscription = existingSubscription
      ? await tx.subscription.update({
          where: { userId },
          data: subscriptionData,
        })
      : await tx.subscription.create({
          data: {
            userId,
            ...subscriptionData,
          },
        });
    
    // 🚀 외부 API 호출은 트랜잭션 외부에서 수행 (네트워크 오류 시 롤백 방지)
    // 첫 결제 실행 (구독 시작)
    const finalAmount = discountedAmount || plan.price;
    let payment;
    
    try {
      payment = await executeAutoBilling(
        billingKey,
        customerKey,
        finalAmount,
        `GenToon ${plan.name} 플랜 구독 시작${discountedAmount ? ' (할인 적용)' : ''}`,
        `sub_start_${Date.now()}_${userId}`
      );
    } catch (paymentError) {
      console.error(`결제 실패, 구독 데이터 롤백: ${userId}`, paymentError);
      throw new Error(`결제 처리 실패: ${paymentError instanceof Error ? paymentError.message : String(paymentError)}`);
    }
    
    // 결제 성공 시 트랜잭션 기록 생성 (트랜잭션 내에서)
    await tx.transaction.create({
      data: {
        userId,
        type: "SUBSCRIPTION",
        amount: finalAmount,
        tokens: plan.tokens,
        status: "COMPLETED",
        description: `${plan.name} 플랜 구독 시작${discountedAmount ? ' (추천인 할인 적용)' : ''}`,
        tossPaymentKey: payment.paymentKey,
        tossOrderId: payment.orderId,
      },
    });
    
    // 카드 정보 로깅 (보안상 마스킹)
    console.log(`✅ 트랜잭션 완료: 사용자 ${userId} 구독 생성, 카드 끝자리: ${cardInfo.number?.slice(-4)}`);
    
    return { subscription, payment };
  }, {
    timeout: 30000, // 30초 타임아웃
  });
}

// 구독 취소 (빌링키는 유지, 다음 결제만 중지)
export async function cancelSubscription(userId: string) {
  try {
    const subscription = await prisma.subscription.update({
      where: { userId },
      data: {
        cancelAtPeriodEnd: true,
      },
    });
    
    return subscription;
  } catch (error) {
    console.error("Subscription cancellation error:", error);
    throw error;
  }
}

// 자동 결제 처리 (크론잡에서 실행) - 토스페이먼츠 v2 API 기반
export async function processRecurringPayments() {
  try {
    // 결제일이 된 활성 구독 조회 (하루 전부터 처리)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const subscriptions = await prisma.subscription.findMany({
      where: {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: {
          lte: tomorrow, // 하루 여유를 두고 처리
        },
        tossBillingKey: {
          not: null,
        },
        tossCustomerKey: {
          not: null,
        },
      },
      include: {
        user: true,
      },
    });

    console.log(`Found ${subscriptions.length} subscriptions to renew`);
    const results = [];
    
    for (const subscription of subscriptions) {
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
        
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            currentPeriodStart: newPeriodStart,
            currentPeriodEnd: newPeriodEnd,
            tokensTotal: plan.tokens,
            tokensUsed: 0, // 토큰 사용량 리셋
          },
        });
        
        // 결제 성공 기록
        await prisma.transaction.create({
          data: {
            userId: subscription.userId,
            type: "SUBSCRIPTION",
            amount: plan.price,
            tokens: plan.tokens,
            status: "COMPLETED",
            description: `${plan.name} 플랜 정기결제 (${newPeriodStart.toLocaleDateString()})`,
            tossPaymentKey: payment.paymentKey,
            tossOrderId: payment.orderId,
          },
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
        await prisma.transaction.create({
          data: {
            userId: subscription.userId,
            type: "SUBSCRIPTION",
            amount: 0,
            status: "FAILED",
            description: `정기결제 실패: ${errorMessage}`,
          },
        });
        
        // 3회 연속 실패 시 구독 자동 취소 로직
        const recentFailures = await prisma.transaction.count({
          where: {
            userId: subscription.userId,
            type: "SUBSCRIPTION",
            status: "FAILED",
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 최근 30일
            },
          },
        });
        
        if (recentFailures >= 3) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { cancelAtPeriodEnd: true },
          });
          
          console.log(`Auto-cancelled subscription ${subscription.id} due to repeated failures`);
        }
        
        results.push({
          subscriptionId: subscription.id,
          userId: subscription.userId,
          status: "failed",
          error: errorMessage,
          failureCount: recentFailures,
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

// 환불 처리 - 🚀 트랜잭션 적용
export async function processRefund(
  userId: string,
  transactionId: string,
  refundAmount: number,
  reason: string
) {
  // 🚀 데이터베이스 트랜잭션으로 환불 처리 원자성 보장
  return await prisma.$transaction(async (tx) => {
    // 트랜잭션 조회 (트랜잭션 내에서)
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
    });
    
    if (!transaction || !transaction.tossPaymentKey) {
      throw new Error("결제 정보를 찾을 수 없습니다");
    }
    
    // 🚀 외부 API 호출 (Toss API로 환불 요청)
    let refundResult;
    try {
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
      
      refundResult = await response.json();
    } catch (refundError) {
      console.error(`환불 API 호출 실패, 트랜잭션 롤백: ${transactionId}`, refundError);
      throw new Error(`환불 처리 실패: ${refundError instanceof Error ? refundError.message : String(refundError)}`);
    }
    
    // 환불 성공 시 DB 업데이트 (트랜잭션 내에서)
    // 1. 원본 트랜잭션 상태 업데이트
    await tx.transaction.update({
      where: { id: transactionId },
      data: {
        status: "REFUNDED",
      },
    });
    
    // 2. 환불 기록 생성
    await tx.transaction.create({
      data: {
        userId,
        type: "REFUND",
        amount: -refundAmount,
        status: "COMPLETED",
        description: `환불: ${reason}`,
        tossPaymentKey: refundResult.paymentKey, // 환불 결과의 paymentKey
      },
    });
    
    console.log(`✅ 환불 트랜잭션 완료: 사용자 ${userId}, 금액 ${refundAmount}원`);
    return true;
  }, {
    timeout: 30000, // 30초 타임아웃
  });
}

// 결제 내역 조회
export async function getPaymentHistory(userId: string, limit = 10) {
  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: {
          in: ["SUBSCRIPTION", "TOKEN_PURCHASE", "REFUND"],
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    
    return transactions;
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