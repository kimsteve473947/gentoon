import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    // 사용자의 결제 기록 조회 (최근 6개월)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        type: 'SUBSCRIPTION',
        createdAt: {
          gte: sixMonthsAgo
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50 // 최대 50개
    });

    // 구독 정보도 함께 조회
    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id }
    });

    // 결제 기록을 BillingHistory 형태로 변환
    const history = transactions.map(transaction => ({
      id: transaction.id,
      amount: transaction.amount,
      status: transaction.status === 'COMPLETED' ? 'success' as const : 
              transaction.status === 'FAILED' ? 'failed' as const : 'pending' as const,
      billedAt: transaction.createdAt.toISOString(),
      nextBillingDate: subscription?.currentPeriodEnd?.toISOString() || null,
      failureReason: transaction.status === 'FAILED' ? transaction.description : undefined
    }));

    return NextResponse.json({
      success: true,
      history
    });

  } catch (error) {
    console.error('결제 내역 조회 오류:', error);
    return NextResponse.json(
      { error: '결제 내역을 조회하는데 실패했습니다' },
      { status: 500 }
    );
  }
}