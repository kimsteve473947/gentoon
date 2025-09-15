import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { TransactionStatus } from "@prisma/client";
import { TossPaymentsError } from "@/lib/payments/toss-billing-v2";

// 토스페이먼츠 웹훅 처리 (v2 API)
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("toss-signature");
    
    // 서명 검증 (프로덕션에서 필수)
    if (process.env.NODE_ENV === "production") {
      const webhookSecret = process.env.TOSS_WEBHOOK_SECRET;
      if (!webhookSecret || !signature) {
        return NextResponse.json(
          { error: "웹훅 검증 실패" },
          { status: 401 }
        );
      }

      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(body)
        .digest("hex");

      if (signature !== expectedSignature) {
        return NextResponse.json(
          { error: "서명 검증 실패" },
          { status: 401 }
        );
      }
    }

    const event = JSON.parse(body);
    console.log("Webhook received:", event.eventType);

    switch (event.eventType) {
      case "PAYMENT_STATUS_CHANGED":
        await handlePaymentStatusChanged(event.data);
        break;
        
      case "BILLING_KEY_ISSUED":
        // 빌링키 발급 완료
        await handleBillingKeyIssued(event.data);
        break;
        
      case "BILLING_PAYMENT_DONE":
        // 빌링 결제 완료
        await handleBillingPaymentDone(event.data);
        break;
        
      case "BILLING_PAYMENT_FAILED":
        // 빌링 결제 실패
        await handleBillingPaymentFailed(event.data);
        break;
        
      case "PAYMENT_DONE":
        // 일반 결제 완료
        await handlePaymentDone(event.data);
        break;
        
      case "PAYMENT_CANCELED":
        // 결제 취소
        await handlePaymentCanceled(event.data);
        break;
        
      default:
        console.log("Unknown event type:", event.eventType, event.data);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "웹훅 처리 실패" },
      { status: 500 }
    );
  }
}

// 결제 상태 변경 처리
async function handlePaymentStatusChanged(data: any) {
  const { paymentKey, orderId, status } = data;
  
  try {
    // 트랜잭션 업데이트
    await prisma.transaction.updateMany({
      where: { tossPaymentKey: paymentKey },
      data: {
        status: status === "DONE" ? TransactionStatus.COMPLETED : TransactionStatus.FAILED,
      },
    });
  } catch (error) {
    console.error("Payment status change error:", error);
  }
}

// 빌링키 발급 완료 처리 (v2 API)
async function handleBillingKeyIssued(data: any) {
  const { billingKey, customerKey } = data;
  
  try {
    const userId = customerKey.replace("customer_", "");
    
    // 구독 정보 업데이트
    await prisma.subscription.update({
      where: { userId },
      data: {
        tossBillingKey: billingKey,
        tossCustomerKey: customerKey,
      },
    });
    
    console.log(`Billing key issued for user ${userId}`);
  } catch (error) {
    console.error("Billing issued error:", error);
  }
}

// 빌링 결제 완료 처리 (v2 API)
async function handleBillingPaymentDone(data: any) {
  const { paymentKey, orderId, totalAmount, customerKey } = data;
  
  try {
    const userId = customerKey.replace("customer_", "");
    
    // 결제 완료 상태 업데이트
    await prisma.transaction.updateMany({
      where: { 
        tossPaymentKey: paymentKey,
        userId: userId,
      },
      data: {
        status: TransactionStatus.COMPLETED,
      },
    });
    
    console.log(`Billing payment completed: ${paymentKey}, Amount: ${totalAmount}`);
  } catch (error) {
    console.error("Billing payment done error:", error);
  }
}

// 빌링 결제 실패 처리 (v2 API)
async function handleBillingPaymentFailed(data: any) {
  const { customerKey, errorCode, errorMessage, paymentKey } = data;
  
  console.error(`Billing payment failed for ${customerKey}:`, errorCode, errorMessage);
  
  try {
    const userId = customerKey.replace("customer_", "");
    
    // 결제 실패 상태 업데이트
    if (paymentKey) {
      await prisma.transaction.updateMany({
        where: { 
          tossPaymentKey: paymentKey,
          userId: userId,
        },
        data: {
          status: TransactionStatus.FAILED,
        },
      });
    }
    
    // 새로운 실패 기록 추가
    await prisma.transaction.create({
      data: {
        userId,
        type: "SUBSCRIPTION",
        amount: 0,
        status: TransactionStatus.FAILED,
        description: `정기결제 실패: ${errorMessage || errorCode}`,
        tossPaymentKey: paymentKey,
      },
    });
    
    // 3회 연속 실패 시 구독 자동 취소
    const recentFailures = await prisma.transaction.count({
      where: {
        userId,
        type: "SUBSCRIPTION",
        status: "FAILED",
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    });
    
    if (recentFailures >= 3) {
      await prisma.subscription.update({
        where: { userId },
        data: { cancelAtPeriodEnd: true },
      });
      
      console.log(`Auto-cancelled subscription for user ${userId} due to repeated failures`);
    }
  } catch (error) {
    console.error("Billing payment failed record error:", error);
  }
}

// 결제 완료 처리
async function handlePaymentDone(data: any) {
  const { paymentKey, orderId, totalAmount } = data;
  
  try {
    // 트랜잭션 상태 업데이트
    await prisma.transaction.updateMany({
      where: { 
        tossPaymentKey: paymentKey,
        status: TransactionStatus.PENDING,
      },
      data: {
        status: TransactionStatus.COMPLETED,
      },
    });
    
    console.log(`Payment completed: ${paymentKey}, Amount: ${totalAmount}`);
  } catch (error) {
    console.error("Payment done error:", error);
  }
}

// 결제 취소 처리
async function handlePaymentCanceled(data: any) {
  const { paymentKey, canceledAmount, cancelReason } = data;
  
  try {
    // 트랜잭션 상태 업데이트
    await prisma.transaction.updateMany({
      where: { tossPaymentKey: paymentKey },
      data: {
        status: TransactionStatus.CANCELLED,
      },
    });
    
    // 환불 기록 생성
    const transaction = await prisma.transaction.findFirst({
      where: { tossPaymentKey: paymentKey },
    });
    
    if (transaction) {
      await prisma.transaction.create({
        data: {
          userId: transaction.userId,
          type: "REFUND",
          amount: -canceledAmount,
          status: TransactionStatus.COMPLETED,
          description: `환불: ${cancelReason}`,
          tossPaymentKey: paymentKey,
        },
      });
    }
    
    console.log(`Payment canceled: ${paymentKey}, Amount: ${canceledAmount}`);
  } catch (error) {
    console.error("Payment canceled error:", error);
  }
}