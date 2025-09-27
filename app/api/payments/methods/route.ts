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

    // 사용자의 구독 정보에서 등록된 결제수단 조회
    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
      select: {
        tossBillingKey: true,
        tossCustomerKey: true,
        updatedAt: true
      }
    });

    // Mock 데이터 (실제로는 토스페이먼츠 API로 빌링키 정보 조회)
    const methods = [];
    
    if (subscription?.tossBillingKey) {
      // 실제 구현에서는 토스페이먼츠 API를 호출하여 빌링키 정보 조회
      // 현재는 Mock 데이터로 대체
      methods.push({
        id: subscription.tossBillingKey,
        type: 'card',
        brand: 'VISA', // 실제로는 API에서 조회
        last4Digits: '1234', // 실제로는 API에서 조회
        expiryDate: '12/26', // 실제로는 API에서 조회
        isDefault: true,
        billingKey: subscription.tossBillingKey,
        registeredAt: subscription.updatedAt.toISOString(),
        cardCompany: '신한카드' // 실제로는 API에서 조회
      });
    }

    return NextResponse.json({
      success: true,
      methods
    });

  } catch (error) {
    console.error('결제수단 조회 오류:', error);
    return NextResponse.json(
      { error: '결제수단을 조회하는데 실패했습니다' },
      { status: 500 }
    );
  }
}