import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { cardNumber, expiryMonth, expiryYear, birth } = await request.json();

    // 사용자 인증 확인
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: '로그인이 필요합니다'
      }, { status: 401 });
    }

    // 입력 데이터 검증
    if (!cardNumber || !expiryMonth || !expiryYear || !birth) {
      return NextResponse.json({
        success: false,
        error: '모든 필드를 입력해주세요'
      }, { status: 400 });
    }

    // 카드번호 형식 검증
    if (cardNumber.length !== 16 || !/^\d+$/.test(cardNumber)) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 카드번호입니다'
      }, { status: 400 });
    }

    // 유효기간 검증
    const month = parseInt(expiryMonth);
    const year = parseInt(expiryYear);
    if (month < 1 || month > 12 || year < new Date().getFullYear()) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 유효기간입니다'
      }, { status: 400 });
    }

    // 토스페이먼츠 빌링키 발급 요청
    const customerKey = `customer_${user.id}`;
    const authKey = `${process.env.TOSS_SECRET_KEY}:`;
    const encodedAuthKey = Buffer.from(authKey).toString('base64');

    try {
      const tossResponse = await fetch('https://api.tosspayments.com/v1/billing/authorizations/card', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${encodedAuthKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerKey,
          cardNumber,
          cardExpirationMonth: expiryMonth.padStart(2, '0'),
          cardExpirationYear: expiryYear,
          customerIdentityNumber: birth
        })
      });

      const tossResult = await tossResponse.json();

      if (!tossResponse.ok) {
        console.error('토스페이먼츠 빌링키 발급 실패:', tossResult);
        return NextResponse.json({
          success: false,
          error: tossResult.message || '카드 등록에 실패했습니다'
        }, { status: 400 });
      }

      // 카드 정보를 데이터베이스에 저장
      const { error: insertError } = await supabase
        .from('payment_method')
        .insert({
          userId: user.id,
          type: 'CARD',
          brand: tossResult.card?.company || 'UNKNOWN',
          last4: cardNumber.slice(-4),
          expirymonth: month,
          expiryyear: year,
          billingkey: tossResult.billingKey,
          isdefault: false
        });

      if (insertError) {
        console.error('결제 수단 저장 실패:', insertError);
        throw insertError;
      }

      // 첫 번째 카드라면 기본 카드로 설정
      const { data: existingMethods } = await supabase
        .from('payment_method')
        .select('id')
        .eq('userId', user.id);

      if (existingMethods?.length === 1) {
        await supabase
          .from('payment_method')
          .update({ isdefault: true })
          .eq('userId', user.id)
          .eq('billingkey', tossResult.billingKey);
      }

      return NextResponse.json({
        success: true,
        message: '카드가 성공적으로 등록되었습니다'
      });

    } catch (tossError: any) {
      console.error('토스페이먼츠 API 호출 실패:', tossError);
      return NextResponse.json({
        success: false,
        error: '카드 등록 서비스에 일시적인 문제가 발생했습니다'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('카드 등록 오류:', error);
    return NextResponse.json({
      success: false,
      error: '카드 등록 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}