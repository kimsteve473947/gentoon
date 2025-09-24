import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // 사용자 인증 확인
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: '로그인이 필요합니다'
      }, { status: 401 });
    }

    // 토스페이먼츠 결제 수단 등록을 위한 고객키 생성
    const customerKey = `customer_${user.id}`;

    // 토스페이먼츠 결제위젯 URL 생성
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.NEXT_PUBLIC_APP_URL 
      : 'http://localhost:3000';

    // 토스페이먼츠 결제수단 등록 페이지로 리다이렉트할 URL
    const tossPaymentUrl = `https://pay.toss.im/web/billing/register?` + new URLSearchParams({
      clientKey: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!,
      customerKey: customerKey,
      successUrl: `${baseUrl}/api/payment-methods/register/success`,
      failUrl: `${baseUrl}/api/payment-methods/register/fail`
    }).toString();

    return NextResponse.json({
      success: true,
      redirectUrl: tossPaymentUrl,
      customerKey
    });

  } catch (error) {
    console.error('결제 수단 등록 요청 오류:', error);
    return NextResponse.json({
      success: false,
      error: '결제 수단 등록 요청 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}