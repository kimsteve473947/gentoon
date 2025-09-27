import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createBillingAuthRequest, SUBSCRIPTION_PLANS } from "@/lib/payments/toss-billing-supabase";
import { getSubscriptionStatus, determinePlanChangeType } from "@/lib/subscription/subscription-manager";
import { type PlanType } from "@/lib/subscription/plan-config";

// 빌링키 등록 요청 (구독 시작)
export async function POST(req: NextRequest) {
  try {
    console.log('=== Billing register API called ===');
    console.log('환경변수 체크:', {
      tossClientKey: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ? 'present' : 'missing',
      tossSecretKey: process.env.TOSS_SECRET_KEY ? 'present' : 'missing',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'present' : 'missing'
    });
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    console.log('User from getUser():', user ? { id: user.id, email: user.email } : 'null');
    
    if (!user) {
      console.log('User not authenticated');
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const body = await req.json();
    console.log('Request body:', body);
    
    const { planId, referralCode, discountRate, finalAmount, paymentMethod } = body;
    
    console.log('Plan ID received:', planId);
    
    if (!planId || !["FREE", "STARTER", "PRO", "PREMIUM"].includes(planId)) {
      console.log('Invalid plan ID:', planId);
      return NextResponse.json(
        { error: "유효하지 않은 플랜입니다" },
        { status: 400 }
      );
    }

    // 사용자 정보 조회 또는 생성
    console.log('Looking up user in database...');
    const { data: dbUser, error: userError } = await supabase
      .from('user')
      .select('*')
      .eq('id', user.id)
      .single();
    
    console.log('DB User found:', dbUser ? { id: dbUser.id, email: dbUser.email } : 'null');

    let finalDbUser = dbUser;
    
    if (!dbUser) {
      console.log('Creating new user in database...');
      
      // 추천인 코드가 있으면 추천인 찾기
      let referrerId = null;
      if (referralCode) {
        const { data: referrer } = await supabase
          .from('user')
          .select('id')
          .eq('referralCode', referralCode)
          .single();
        
        if (referrer) {
          referrerId = referrer.id;
        }
      }
      
      // 신규 사용자 생성
      const { data: newUser, error: createError } = await supabase
        .from('user')
        .insert({
          id: user.id,
          email: user.email || "",
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || "사용자",
          avatarUrl: user.user_metadata?.avatar_url,
          referredBy: referrerId,
        })
        .select()
        .single();
      
      if (createError) throw createError;
      finalDbUser = newUser;
      console.log('New user created:', { id: newUser.id, email: newUser.email, referredBy: referrerId });
      
      // 추천인 보상 처리
      if (referrerId) {
        // 추천인 보상 생성
        await supabase
          .from('referralreward')
          .insert({
            referrerId,
            referredId: finalDbUser.id,
            tokensRewarded: 50 // 추천인 50토큰 보상
          });
        
        // 추천인의 구독에 토큰 추가
        const { data: referrerSub } = await supabase
          .from('subscription')
          .select('tokensTotal')
          .eq('userId', referrerId)
          .single();
        
        if (referrerSub) {
          await supabase
            .from('subscription')
            .update({ tokensTotal: (referrerSub.tokensTotal || 0) + 50 })
            .eq('userId', referrerId);
        }
        
        console.log('Referral reward created for referrer:', referrerId);
      }
    } else if (referralCode && !dbUser.referredBy) {
      // 기존 사용자이지만 추천인이 없는 경우
      const { data: referrer } = await supabase
        .from('user')
        .select('id')
        .eq('referralCode', referralCode)
        .single();
      
      if (referrer && referrer.id !== dbUser.id) {
        // 추천인 정보 업데이트
        await supabase
          .from('user')
          .update({ referredBy: referrer.id })
          .eq('id', dbUser.id);
        
        // 추천인 보상 처리
        await supabase
          .from('referralreward')
          .insert({
            referrerId: referrer.id,
            referredId: dbUser.id,
            tokensRewarded: 50
          });
        
        // 추천인의 구독에 토큰 추가
        const { data: referrerSub } = await supabase
          .from('subscription')
          .select('tokensTotal')
          .eq('userId', referrer.id)
          .single();
        
        if (referrerSub) {
          await supabase
            .from('subscription')
            .update({ tokensTotal: (referrerSub.tokensTotal || 0) + 50 })
            .eq('userId', referrer.id);
        }
        
        console.log('Referral applied for existing user:', dbUser.id);
      }
    }

    // 🔍 기존 구독 상태 확인
    console.log('기존 구독 상태 확인 중...');
    const subscriptionStatus = await getSubscriptionStatus(finalDbUser.id);
    console.log('구독 상태:', subscriptionStatus);
    
    // 플랜 변경 유형 판단
    const changeType = determinePlanChangeType(subscriptionStatus.currentPlan, planId as PlanType);
    console.log('플랜 변경 유형:', changeType, `(${subscriptionStatus.currentPlan} → ${planId})`);
    
    // 동일 플랜 구독 시도 차단
    if (changeType === 'same') {
      console.log('동일한 플랜 구독 시도 차단');
      return NextResponse.json(
        { 
          error: "이미 동일한 플랜을 사용 중입니다",
          currentPlan: subscriptionStatus.currentPlan,
          changeType: 'same'
        },
        { status: 400 }
      );
    }

    // 빌링키 등록 요청 생성 (v2 API)
    console.log('Creating billing auth request with discount...');
    console.log('Discount rate:', discountRate, 'Final amount:', finalAmount, 'Change type:', changeType);
    
    // 결제수단 매핑 (프론트엔드 값을 DB enum 값으로 변환)
    const paymentMethodMapping: Record<string, string> = {
      '카드': 'CARD',
      '토스페이': 'TOSSPAY', 
      '카카오페이': 'KAKAOPAY'
    };
    const mappedPaymentMethod = paymentMethodMapping[paymentMethod] || 'CARD';
    
    const billingAuthRequest = await createBillingAuthRequest(
      finalDbUser.id,
      planId,
      user.email || "",
      user.user_metadata?.full_name || user.email?.split('@')[0] || undefined,
      finalAmount, // 할인된 금액 전달
      mappedPaymentMethod // 결제수단 전달
    );
    
    console.log('Billing auth request created:', billingAuthRequest);

    const response = {
      success: true,
      billingAuthRequest,
      planInfo: {
        ...SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS],
        discountRate,
        finalAmount
      },
      subscriptionInfo: {
        changeType,
        currentPlan: subscriptionStatus.currentPlan,
        hasActiveSubscription: subscriptionStatus.hasActiveSubscription,
        isUpgrade: changeType === 'upgrade',
        isDowngrade: changeType === 'downgrade',
        isNew: changeType === 'new'
      }
    };
    
    console.log('Returning successful response:', response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("Billing register error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "빌링키 등록 요청 생성 실패",
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}