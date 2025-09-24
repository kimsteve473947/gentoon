import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const billingKey = searchParams.get('billingKey');
    const customerKey = searchParams.get('customerKey');

    if (!billingKey || !customerKey) {
      return NextResponse.redirect(
        new URL('/settings/subscription?error=invalid_params', request.url)
      );
    }

    // customerKey에서 사용자 ID 추출
    const userId = customerKey.replace('customer_', '');

    // 토스페이먼츠 API를 통해 결제수단 정보 조회
    const response = await fetch(`https://api.tosspayments.com/v1/billing/${billingKey}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('결제수단 정보 조회 실패');
    }

    const billingData = await response.json();
    const cardInfo = billingData.card;

    // Supabase에 결제 수단 정보 저장
    const supabase = await createClient();

    // 기존 결제수단이 있는지 확인
    const { data: existingMethods } = await supabase
      .from('payment_method')
      .select('id')
      .eq('userId', userId);

    const isFirstPaymentMethod = !existingMethods || existingMethods.length === 0;

    // 결제 수단 저장
    const { data: paymentMethod, error: insertError } = await supabase
      .from('payment_method')
      .insert({
        userId: userId,
        type: 'CARD',
        brand: cardInfo.company.toLowerCase(),
        last4: cardInfo.number.slice(-4),
        expirymonth: parseInt(cardInfo.month),
        expiryyear: parseInt(cardInfo.year),
        billingkey: billingKey,
        isdefault: isFirstPaymentMethod // 첫 번째 결제수단은 기본으로 설정
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // 성공 페이지로 리다이렉트
    return NextResponse.redirect(
      new URL('/settings/subscription?success=payment_method_added', request.url)
    );

  } catch (error) {
    console.error('결제 수단 등록 성공 처리 오류:', error);
    return NextResponse.redirect(
      new URL('/settings/subscription?error=registration_failed', request.url)
    );
  }
}