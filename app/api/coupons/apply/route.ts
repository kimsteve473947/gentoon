import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({
        success: false,
        error: '쿠폰 코드를 입력해주세요'
      }, { status: 400 });
    }

    // 사용자 인증 확인
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: '로그인이 필요합니다'
      }, { status: 401 });
    }

    // 쿠폰 조회
    const { data: coupon, error: couponError } = await supabase
      .from('coupon')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (couponError || !coupon) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 쿠폰 코드입니다'
      }, { status: 404 });
    }

    // 쿠폰 유효성 검사
    const now = new Date();
    const expiresAt = new Date(coupon.expiresat);

    if (expiresAt < now) {
      return NextResponse.json({
        success: false,
        error: '만료된 쿠폰입니다'
      }, { status: 400 });
    }

    if (!coupon.isactive) {
      return NextResponse.json({
        success: false,
        error: '사용할 수 없는 쿠폰입니다'
      }, { status: 400 });
    }

    // 사용량 제한 확인
    const { data: usageCount, error: usageError } = await supabase
      .from('user_coupon')
      .select('id')
      .eq('couponid', coupon.id);

    if (usageError) {
      throw usageError;
    }

    if (coupon.usagelimit > 0 && (usageCount?.length || 0) >= coupon.usagelimit) {
      return NextResponse.json({
        success: false,
        error: '쿠폰 사용 한도를 초과했습니다'
      }, { status: 400 });
    }

    // 첫 결제 전용 쿠폰인 경우 사용자의 결제 이력 확인
    if (coupon.first_payment_only) {
      const { data: paymentHistory, error: paymentError } = await supabase
        .from('transaction')
        .select('id')
        .eq('userId', user.id)
        .eq('type', 'SUBSCRIPTION')
        .eq('status', 'COMPLETED')
        .limit(1);

      if (paymentError) {
        throw paymentError;
      }

      if (paymentHistory && paymentHistory.length > 0) {
        return NextResponse.json({
          success: false,
          error: '이 쿠폰은 첫 결제 시에만 사용할 수 있습니다'
        }, { status: 400 });
      }
    }

    // 사용자별 중복 사용 확인
    const { data: existingUserCoupon, error: existingError } = await supabase
      .from('user_coupon')
      .select('id')
      .eq('userId', user.id)
      .eq('couponid', coupon.id)
      .single();

    if (existingUserCoupon && !existingError) {
      return NextResponse.json({
        success: false,
        error: '이미 사용한 쿠폰입니다'
      }, { status: 400 });
    }

    // 사용자 쿠폰 테이블에 추가
    const { data: userCoupon, error: insertError } = await supabase
      .from('user_coupon')
      .insert({
        userId: user.id,
        couponid: coupon.id,
        appliedat: new Date().toISOString(),
        isused: false
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // 추천인 추적 쿠폰인 경우 추천인에게 토큰 지급
    if (coupon.referral_tracking && coupon.referral_reward_tokens > 0) {
      // 사용자의 추천인 정보 조회
      const { data: userData } = await supabase
        .from('user')
        .select('referredBy')
        .eq('id', user.id)
        .single();

      if (userData?.referredBy) {
        // 추천인의 구독 정보 조회
        const { data: referrerSubscription } = await supabase
          .from('subscription')
          .select('id, tokensTotal')
          .eq('userId', userData.referredBy)
          .single();

        if (referrerSubscription) {
          // 추천인에게 토큰 지급
          await supabase
            .from('subscription')
            .update({
              tokensTotal: referrerSubscription.tokensTotal + coupon.referral_reward_tokens,
              updatedAt: new Date().toISOString()
            })
            .eq('id', referrerSubscription.id);

          // 추천 보상 기록 추가
          await supabase
            .from('referral_reward')
            .insert({
              referrerId: userData.referredBy,
              referredId: user.id,
              tokensRewarded: coupon.referral_reward_tokens,
              createdAt: new Date().toISOString()
            });

          console.log(`추천인 ${userData.referredBy}에게 ${coupon.referral_reward_tokens}토큰 지급 완료`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: '쿠폰이 성공적으로 적용되었습니다',
      coupon: {
        code: coupon.code,
        discount: coupon.discount,
        discountType: coupon.discounttype,
        description: coupon.description,
        expiresAt: coupon.expiresat,
        firstPaymentOnly: coupon.first_payment_only,
        referralTracking: coupon.referral_tracking
      }
    });

  } catch (error) {
    console.error('쿠폰 적용 오류:', error);
    return NextResponse.json({
      success: false,
      error: '쿠폰 적용 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}