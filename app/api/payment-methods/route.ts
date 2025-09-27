import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
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

    // 사용자의 구독 정보에서 결제 수단 조회
    const { data: subscription, error: paymentError } = await supabase
      .from('subscription')
      .select('tossBillingKey, tossCustomerKey, cardLast4, cardBrand')
      .eq('userId', user.id)
      .single();

    if (paymentError && paymentError.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw paymentError;
    }

    // 결제 수단이 등록된 경우 포맷팅
    const paymentMethods = [];
    if (subscription?.tossBillingKey && subscription?.cardLast4) {
      paymentMethods.push({
        id: subscription.tossBillingKey,
        type: 'CARD',
        brand: subscription.cardBrand || 'CARD',
        last4: subscription.cardLast4,
        expiryMonth: 12, // 실제로는 토스에서 받은 데이터 사용
        expiryYear: 2030, // 실제로는 토스에서 받은 데이터 사용
        isDefault: true
      });
    }

    // 적용된 쿠폰 조회
    const { data: coupons, error: couponError } = await supabase
      .from('user_coupon')
      .select(`
        *,
        coupon:couponid (
          code,
          discount,
          discounttype,
          description,
          expiresat
        )
      `)
      .eq('userId', user.id)
      .eq('isused', false);

    if (couponError) {
      console.error('쿠폰 조회 오류:', couponError);
    }

    const formattedCoupons = coupons?.map(userCoupon => ({
      ...userCoupon.coupon,
      appliedAt: userCoupon.appliedAt
    })) || [];

    return NextResponse.json({
      success: true,
      paymentMethods: paymentMethods || [],
      coupons: formattedCoupons
    });

  } catch (error) {
    console.error('결제 수단 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '결제 수단 조회 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}