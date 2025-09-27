import { prisma } from '@/lib/db/prisma';
import { PLAN_CONFIGS } from '@/lib/subscription/plan-config';

export interface BillingSchedule {
  userId: string;
  subscriptionId: string;
  billingKey: string;
  customerKey: string;
  amount: number;
  plan: string;
  nextBillingDate: Date;
  retryCount: number;
  isActive: boolean;
}

/**
 * 자동 결제 스케줄러
 * 매일 실행되어 결제가 필요한 구독을 확인하고 결제 진행
 */
export class BillingScheduler {
  
  /**
   * 오늘 결제가 필요한 구독 조회
   * 구독 만료일 당일 오전에 미리 결제 진행 (일반적인 멤버십 서비스 방식)
   */
  async getDueBillings(): Promise<BillingSchedule[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const subscriptions = await prisma.subscription.findMany({
      where: {
        plan: {
          not: 'FREE'
        },
        tossBillingKey: {
          not: null
        },
        currentPeriodEnd: {
          gte: today,      // 오늘 만료되는 구독들
          lt: tomorrow     // 내일 00:00:00 이전까지
        },
        cancelAtPeriodEnd: false
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    return subscriptions.map(sub => ({
      userId: sub.userId,
      subscriptionId: sub.id,
      billingKey: sub.tossBillingKey!,
      customerKey: sub.tossCustomerKey!,
      amount: PLAN_CONFIGS[sub.plan].price,
      plan: sub.plan,
      nextBillingDate: sub.currentPeriodEnd,
      retryCount: 0,
      isActive: true
    }));
  }

  /**
   * 자동 결제 실행
   */
  async processBilling(billing: BillingSchedule): Promise<{ success: boolean; error?: string }> {
    try {
      // 토스페이먼츠 자동 결제 API 호출
      const response = await fetch('https://api.tosspayments.com/v1/billing', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerKey: billing.customerKey,
          billingKey: billing.billingKey,
          amount: billing.amount,
          orderId: `subscription_${billing.subscriptionId}_${Date.now()}`,
          orderName: `GenToon ${billing.plan} 플랜 구독`,
          customerEmail: billing.userId // 실제로는 사용자 이메일 조회 필요
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('자동 결제 실패:', errorData);
        return { success: false, error: errorData.message || '결제 실패' };
      }

      const paymentData = await response.json();

      // 결제 성공 시 구독 기간 연장
      await this.extendSubscription(billing.subscriptionId, billing.userId, paymentData);

      // 결제 기록 저장
      await prisma.transaction.create({
        data: {
          userId: billing.userId,
          type: 'SUBSCRIPTION',
          amount: billing.amount,
          status: 'COMPLETED',
          tossPaymentKey: paymentData.paymentKey,
          tossOrderId: paymentData.orderId,
          description: `${billing.plan} 플랜 자동 결제`
        }
      });

      console.log('자동 결제 성공:', {
        userId: billing.userId,
        subscriptionId: billing.subscriptionId,
        amount: billing.amount,
        paymentKey: paymentData.paymentKey
      });

      return { success: true };

    } catch (error) {
      console.error('자동 결제 처리 오류:', error);
      return { success: false, error: '시스템 오류' };
    }
  }

  /**
   * 구독 기간 연장
   */
  private async extendSubscription(subscriptionId: string, userId: string, paymentData: any) {
    const currentSub = await prisma.subscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!currentSub) {
      throw new Error('구독 정보를 찾을 수 없습니다');
    }

    // 다음 결제일 계산 (현재 종료일에서 30일 추가)
    const newPeriodStart = currentSub.currentPeriodEnd;
    const newPeriodEnd = new Date(newPeriodStart);
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

    // 토큰 리셋 날짜도 업데이트
    const newTokensResetDate = new Date();
    const nextTokensReset = new Date(newTokensResetDate);
    nextTokensReset.setMonth(nextTokensReset.getMonth() + 1);

    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd: newPeriodEnd,
        tokensUsed: 0, // 토큰 사용량 리셋
        tokensResetDate: newTokensResetDate,
        nextTokensReset: nextTokensReset
      }
    });

    console.log('구독 기간 연장 완료:', {
      userId,
      subscriptionId,
      newPeriodEnd: newPeriodEnd.toISOString()
    });
  }

  /**
   * 결제 실패 시 재시도 로직
   */
  async handleFailedBilling(billing: BillingSchedule, error: string) {
    const maxRetries = 7; // 7일간 재시도
    
    if (billing.retryCount < maxRetries) {
      // 다음 날 재시도하도록 스케줄링
      console.log(`결제 재시도 예약: ${billing.userId}, 시도 횟수: ${billing.retryCount + 1}`);
      
      // 실제로는 큐 시스템이나 cron job으로 재시도 스케줄링
      // 여기서는 로그만 남김
    } else {
      // 최대 재시도 횟수 초과 시 구독 일시정지
      await this.suspendSubscription(billing.subscriptionId, billing.userId);
      
      // 사용자에게 결제 실패 알림
      console.log(`구독 일시정지: ${billing.userId}, 결제 실패 사유: ${error}`);
    }
  }

  /**
   * 구독 일시정지
   */
  private async suspendSubscription(subscriptionId: string, userId: string) {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        cancelAtPeriodEnd: true
        // 실제로는 suspended 상태나 별도 필드 필요
      }
    });

    // 결제 실패 기록 저장
    await prisma.transaction.create({
      data: {
        userId: userId,
        type: 'SUBSCRIPTION',
        amount: 0,
        status: 'FAILED',
        description: '자동 결제 실패로 구독 일시정지'
      }
    });
  }

  /**
   * 메인 스케줄러 실행 함수
   */
  async run() {
    console.log('빌링 스케줄러 시작:', new Date().toISOString());
    
    try {
      const dueBillings = await this.getDueBillings();
      console.log(`오늘 처리할 결제: ${dueBillings.length}건`);

      for (const billing of dueBillings) {
        const result = await this.processBilling(billing);
        
        if (!result.success) {
          await this.handleFailedBilling(billing, result.error || '알 수 없는 오류');
        }
        
        // API 호출 간격 (과부하 방지)
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('빌링 스케줄러 완료');
    } catch (error) {
      console.error('빌링 스케줄러 오류:', error);
    }
  }
}

// 스케줄러 인스턴스 생성
export const billingScheduler = new BillingScheduler();