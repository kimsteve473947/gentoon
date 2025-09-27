import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 결제 수단 등록을 위한 빌링키 발급 성공 처리
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const authKey = searchParams.get("authKey");
    const customerKey = searchParams.get("customerKey");

    if (!authKey || !customerKey) {
      return NextResponse.json(
        { error: "필수 파라미터가 누락되었습니다" },
        { status: 400 }
      );
    }

    // customerKey에서 userId 추출 (customer_userId_timestamp 형식)
    const userIdMatch = customerKey.match(/^customer_(.+)_\d+$/);
    if (!userIdMatch) {
      return NextResponse.json(
        { error: "잘못된 customerKey 형식입니다" },
        { status: 400 }
      );
    }
    const userId = userIdMatch[1];

    // Supabase 클라이언트 생성
    const supabase = await createClient();

    // 사용자 확인
    const { data: user, error: userError } = await supabase
      .from('user')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: "사용자를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 토스페이먼츠 API를 통해 빌링키 발급
    const billingKeyResponse = await fetch("https://api.tosspayments.com/v1/billing/authorizations", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ":").toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        authKey,
        customerKey,
      }),
    });

    if (!billingKeyResponse.ok) {
      const errorData = await billingKeyResponse.json();
      console.error("빌링키 발급 실패:", errorData);
      return NextResponse.json(
        { error: "빌링키 발급에 실패했습니다" },
        { status: 400 }
      );
    }

    const billingData = await billingKeyResponse.json();

    // 사용자의 구독 정보에 빌링키 저장
    const { data: subscription, error: subError } = await supabase
      .from('subscription')
      .select('*')
      .eq('userId', userId)
      .single();

    if (subscription) {
      // 기존 구독이 있는 경우 업데이트
      await supabase
        .from('subscription')
        .update({
          tossBillingKey: billingData.billingKey,
          tossCustomerKey: customerKey,
          cardLast4: billingData.card?.number?.slice(-4) || null,
          cardBrand: billingData.card?.company || null,
        })
        .eq('userId', userId);
    } else {
      // 구독이 없는 경우 무료 플랜으로 생성
      await supabase
        .from('subscription')
        .insert({
          userId,
          plan: 'FREE',
          tossBillingKey: billingData.billingKey,
          tossCustomerKey: customerKey,
          cardLast4: billingData.card?.number?.slice(-4) || null,
          cardBrand: billingData.card?.company || null,
          tokensTotal: 8,
          tokensUsed: 0,
          charactersTotal: 2,
          charactersUsed: 0,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일 후
          tokensResetDate: new Date(),
          nextTokensReset: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
        });
    }

    console.log(`Payment method registered for user ${userId}`);

    // 성공 페이지로 리다이렉트
    return NextResponse.redirect(
      new URL("/settings?tab=subscription&payment_registered=true", req.nextUrl.origin)
    );
  } catch (error) {
    console.error("Payment method registration error:", error);
    
    return NextResponse.redirect(
      new URL("/settings?tab=subscription&error=billing_registration_failed", req.nextUrl.origin)
    );
  }
}