import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';

export async function DELETE(
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

    // 사용자의 구독에서 해당 빌링키 제거
    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id }
    });

    if (!subscription || subscription.tossBillingKey !== billingKeyId) {
      return NextResponse.json(
        { error: '해당 결제수단을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 활성 구독이 있는 경우 결제수단 삭제 제한
    if (subscription.plan !== 'FREE') {
      return NextResponse.json(
        { error: '활성 구독이 있는 동안은 결제수단을 삭제할 수 없습니다. 먼저 구독을 취소해주세요.' },
        { status: 400 }
      );
    }

    // 빌링키 정보 삭제 (데이터베이스에서)
    await prisma.subscription.update({
      where: { userId: user.id },
      data: {
        tossBillingKey: null,
        tossCustomerKey: null
      }
    });

    // TODO: 실제 토스페이먼츠 API를 통한 빌링키 삭제 요청
    // 현재는 데이터베이스에서만 삭제

    console.log('결제수단 삭제 완료:', {
      userId: user.id,
      billingKeyId,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: '결제수단이 삭제되었습니다'
    });

  } catch (error) {
    console.error('결제수단 삭제 오류:', error);
    return NextResponse.json(
      { error: '결제수단 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}