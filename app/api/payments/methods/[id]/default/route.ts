import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const billingKeyId = params.id;

    // 사용자의 구독에서 해당 빌링키 확인
    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id }
    });

    if (!subscription || subscription.tossBillingKey !== billingKeyId) {
      return NextResponse.json(
        { error: '해당 결제수단을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 이미 기본 결제수단인 경우
    if (subscription.tossBillingKey === billingKeyId) {
      return NextResponse.json({
        success: true,
        message: '이미 기본 결제수단으로 설정되어 있습니다'
      });
    }

    // 기본 결제수단으로 설정
    await prisma.subscription.update({
      where: { userId: user.id },
      data: {
        tossBillingKey: billingKeyId,
        updatedAt: new Date()
      }
    });

    console.log('기본 결제수단 설정 완료:', {
      userId: user.id,
      billingKeyId,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: '기본 결제수단이 설정되었습니다'
    });

  } catch (error) {
    console.error('기본 결제수단 설정 오류:', error);
    return NextResponse.json(
      { error: '기본 결제수단 설정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}