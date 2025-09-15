import { loadTossPayments } from "@tosspayments/payment-sdk";
import { prisma } from "@/lib/db/prisma";
import { tokenManager } from "@/lib/subscription/token-manager";
import { SubscriptionPlan } from "@prisma/client";

// Toss Payments 클라이언트 초기화
export async function getTossClient() {
  const tossPayments = await loadTossPayments(
    process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!
  );
  return tossPayments;
}

// 구독 플랜 정보 (Gemini API 실제 비용 기반)
// 1 이미지 = 2토큰 = 약 25원 (실제 API 비용 0.25원의 100배 마진)
export const SUBSCRIPTION_PLANS = {
  FREE: {
    id: "FREE" as const,
    name: "무료",
    price: 0,
    tokens: 10,       // 10 토큰
    characters: 2,
    projects: 3,
    description: "무료 체험용 플랜",
  },
  PRO: {
    id: "PRO" as const,
    name: "프로",
    price: 30000,
    tokens: 500000,   // 50만 토큰
    characters: 3,
    projects: 999,
    description: "개인 창작자를 위한 플랜",
  },
  PREMIUM: {
    id: "PREMIUM" as const,
    name: "프리미엄",
    price: 100000,
    tokens: 2000000,  // 200만 토큰
    characters: 5,
    projects: 999,
    description: "전문 창작자를 위한 플랜",
  },
};

// 결제 요청 생성 (일반 결제)
export async function createPaymentRequest(
  userId: string,
  planId: keyof typeof SUBSCRIPTION_PLANS,
  customerEmail: string,
  customerName?: string
) {
  const plan = SUBSCRIPTION_PLANS[planId];
  const orderId = `order_${Date.now()}_${userId}`;
  
  return {
    amount: plan.price,
    orderId,
    orderName: `GenToon ${plan.name} 플랜`,
    successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/success`,
    failUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/fail`,
    customerEmail,
    customerName: customerName || "고객",
  };
}

// 빌링키 발급 요청 생성 (정기 결제용)
export async function createBillingKeyRequest(
  userId: string,
  planId: keyof typeof SUBSCRIPTION_PLANS,
  customerEmail: string,
  customerName?: string
) {
  const plan = SUBSCRIPTION_PLANS[planId];
  const customerKey = `customer_${userId}`; // 고객 고유 키
  
  return {
    amount: 0, // 빌링키 발급 시에는 0원 결제
    orderId: `billing_${Date.now()}_${userId}`,
    orderName: `GenToon ${plan.name} 플랜 정기결제 등록`,
    successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/billing-success`,
    failUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/fail`,
    customerEmail,
    customerName: customerName || "고객",
    customerKey,
  };
}

// 빌링키로 정기결제 실행
export async function executeBillingPayment(
  billingKey: string,
  customerKey: string,
  amount: number,
  orderName: string,
  orderId?: string
) {
  try {
    const response = await fetch(
      "https://api.tosspayments.com/v1/billing",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY! + ":").toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          billingKey,
          customerKey,
          amount,
          orderId: orderId || `order_${Date.now()}`,
          orderName,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "빌링 결제 실패");
    }

    return await response.json();
  } catch (error) {
    console.error("Billing payment error:", error);
    throw error;
  }
}

// 구독 생성 또는 업그레이드
export async function createOrUpdateSubscription(
  userId: string,
  planId: keyof typeof SUBSCRIPTION_PLANS,
  billingKey: string,
  customerKey: string
) {
  try {
    const plan = SUBSCRIPTION_PLANS[planId];
    
    // 기존 구독 조회
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId },
    });
    
    const subscriptionData = {
      plan: planId as SubscriptionPlan,
      tokensTotal: plan.tokens,
      tokensUsed: existingSubscription?.tokensUsed || 0,
      maxCharacters: plan.characters === Infinity ? 999 : plan.characters,
      maxProjects: plan.projects === Infinity ? 999 : plan.projects,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      tossBillingKey: billingKey,
      tossCustomerKey: customerKey,
      cancelAtPeriodEnd: false,
    };
    
    // 구독 생성 또는 업데이트
    const subscription = existingSubscription
      ? await prisma.subscription.update({
          where: { userId },
          data: subscriptionData,
        })
      : await prisma.subscription.create({
          data: {
            userId,
            ...subscriptionData,
          },
        });
    
    // 첫 결제 실행
    const payment = await executeBillingPayment(
      billingKey,
      customerKey,
      plan.price,
      `GenToon ${plan.name} 플랜 정기결제`
    );
    
    // 결제 기록 생성
    await prisma.transaction.create({
      data: {
        userId,
        type: "SUBSCRIPTION",
        amount: plan.price,
        tokens: plan.tokens,
        status: "COMPLETED",
        description: `${plan.name} 플랜 구독`,
        tossPaymentKey: payment.paymentKey,
        tossOrderId: payment.orderId,
      },
    });
    
    return subscription;
  } catch (error) {
    console.error("Subscription creation error:", error);
    throw error;
  }
}

// 일회성 토큰 구매
export async function purchaseTokens(
  userId: string,
  tokenAmount: number,
  price: number,
  paymentKey: string
) {
  try {
    // 토큰 추가
    await tokenManager.addTokens(userId, tokenAmount);
    
    // 결제 기록 생성
    await prisma.transaction.create({
      data: {
        userId,
        type: "TOKEN_PURCHASE",
        amount: price,
        tokens: tokenAmount,
        status: "COMPLETED",
        description: `토큰 ${tokenAmount}개 구매`,
        tossPaymentKey: paymentKey,
      },
    });
    
    return true;
  } catch (error) {
    console.error("Token purchase error:", error);
    throw error;
  }
}

// 결제 검증
export async function verifyPayment(paymentKey: string, orderId: string, amount: number) {
  try {
    const response = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY! + ":").toString("base64")}`,
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
      throw new Error(error.message || "결제 검증 실패");
    }
    
    const payment = await response.json();
    return payment;
  } catch (error) {
    console.error("Payment verification error:", error);
    throw error;
  }
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

// 빌링키 조회
export async function getBillingKey(authKey: string, customerKey: string) {
  try {
    const response = await fetch(
      `https://api.tosspayments.com/v1/billing/authorizations/${authKey}`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY! + ":").toString("base64")}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "빌링키 조회 실패");
    }

    const data = await response.json();
    return data.billingKey;
  } catch (error) {
    console.error("Get billing key error:", error);
    throw error;
  }
}

// 자동 결제 처리 (크론잡에서 실행)
export async function processRecurringPayments() {
  try {
    // 결제일이 된 활성 구독 조회
    const subscriptions = await prisma.subscription.findMany({
      where: {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: {
          lte: new Date(),
        },
        tossBillingKey: {
          not: null,
        },
      },
      include: {
        user: true,
      },
    });

    const results = [];
    
    for (const subscription of subscriptions) {
      try {
        const plan = SUBSCRIPTION_PLANS[subscription.plan as keyof typeof SUBSCRIPTION_PLANS];
        
        // 빌링 결제 실행
        const payment = await executeBillingPayment(
          subscription.tossBillingKey!,
          subscription.tossCustomerKey!,
          plan.price,
          `GenToon ${plan.name} 플랜 정기결제`
        );
        
        // 구독 기간 갱신
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            tokensTotal: plan.tokens,
            tokensUsed: 0,
          },
        });
        
        // 결제 기록 생성
        await prisma.transaction.create({
          data: {
            userId: subscription.userId,
            type: "SUBSCRIPTION",
            amount: plan.price,
            tokens: plan.tokens,
            status: "COMPLETED",
            description: `${plan.name} 플랜 자동결제`,
            tossPaymentKey: payment.paymentKey,
            tossOrderId: payment.orderId,
          },
        });
        
        results.push({
          subscriptionId: subscription.id,
          status: "success",
          paymentKey: payment.paymentKey,
        });
      } catch (error) {
        console.error(`Recurring payment failed for subscription ${subscription.id}:`, error);
        
        // 결제 실패 기록
        await prisma.transaction.create({
          data: {
            userId: subscription.userId,
            type: "SUBSCRIPTION",
            amount: 0,
            status: "FAILED",
            description: "정기결제 실패",
          },
        });
        
        results.push({
          subscriptionId: subscription.id,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error("Process recurring payments error:", error);
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
    // 트랜잭션 조회
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    
    if (!transaction || !transaction.tossPaymentKey) {
      throw new Error("결제 정보를 찾을 수 없습니다");
    }
    
    // Toss API로 환불 요청
    const response = await fetch(
      `https://api.tosspayments.com/v1/payments/${transaction.tossPaymentKey}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY! + ":").toString("base64")}`,
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
      throw new Error(error.message || "환불 처리 실패");
    }
    
    // 트랜잭션 상태 업데이트
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: "REFUNDED",
      },
    });
    
    // 환불 기록 생성
    await prisma.transaction.create({
      data: {
        userId,
        type: "REFUND",
        amount: -refundAmount,
        status: "COMPLETED",
        description: `환불: ${reason}`,
      },
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