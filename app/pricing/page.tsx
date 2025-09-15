'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import { createBrowserClient } from '@supabase/ssr';
import { Check, X, Crown, Tag, Gift, Star, Users, Clock, Shield, Zap, TrendingUp, Award, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface User {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
  };
}

export default function PricingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState('');
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [referralDiscount, setReferralDiscount] = useState(0);
  const [referralError, setReferralError] = useState<string | null>(null);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    getUser();
  }, []);

  const plans = [
    {
      name: "Free",
      description: "취미로 시작하는 분들께",
      price: "₩0",
      features: [
        { text: "1만 토큰 제공", included: true },
        { text: "1GB 저장공간", included: true },
        { text: "캐릭터 1개 등록", included: true },
        { text: "프로젝트 3개", included: true },
        { text: "기본 템플릿", included: true },
        { text: "워터마크 포함", included: true },
        { text: "무제한 프로젝트", included: false },
        { text: "프리미엄 템플릿", included: false }
      ],
      buttonText: "무료 시작",
      buttonVariant: "outline" as const,
      popular: false,
      planId: "FREE"
    },
    {
      name: "Basic",
      description: "정기적으로 창작하는 분들께",
      price: "₩30,000",
      originalPrice: 30000,
      priceUnit: "/월",
      features: [
        { text: "40만 토큰 제공", included: true },
        { text: "10GB 저장공간", included: true },
        { text: "캐릭터 3개 등록", included: true },
        { text: "무제한 프로젝트", included: true },
        { text: "모든 기본 템플릿", included: true },
        { text: "워터마크 제거", included: true },
        { text: "프리미엄 템플릿", included: true },
        { text: "우선 지원", included: false }
      ],
      buttonText: "선택하기",
      buttonVariant: "default" as const,
      popular: true,
      planId: "PRO"
    },
    {
      name: "Pro",
      description: "전문 창작자를 위한",
      price: "₩100,000",
      originalPrice: 100000,
      priceUnit: "/월",
      features: [
        { text: "150만 토큰 제공", included: true },
        { text: "50GB 저장공간", included: true },
        { text: "캐릭터 5개 등록", included: true },
        { text: "무제한 프로젝트", included: true },
        { text: "모든 템플릿", included: true },
        { text: "워터마크 제거", included: true },
        { text: "프리미엄 템플릿", included: true },
        { text: "우선 지원", included: true }
      ],
      buttonText: "선택하기",
      buttonVariant: "default" as const,
      popular: false,
      planId: "PREMIUM"
    }
  ];

  // 추천인 코드 확인
  const validateReferralCode = async (code: string) => {
    if (!code.trim()) {
      setReferralDiscount(0);
      setReferralError(null);
      return;
    }

    setIsValidatingCode(true);
    setReferralError(null);

    try {
      const response = await fetch('/api/payments/validate-referral', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ referralCode: code }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        setReferralDiscount(20); // 20% 할인 (첫 달)
        setReferralError(null);
      } else {
        setReferralDiscount(0);
        setReferralError(data.message || '유효하지 않은 추천인 코드입니다.');
      }
    } catch (error) {
      setReferralDiscount(0);
      setReferralError('추천인 코드 확인 중 오류가 발생했습니다.');
    } finally {
      setIsValidatingCode(false);
    }
  };

  // 할인된 가격 계산
  const getDiscountedPrice = (originalPrice: number) => {
    if (referralDiscount > 0) {
      return Math.floor(originalPrice * (1 - referralDiscount / 100));
    }
    return originalPrice;
  };

  const handlePlanSelection = async (planName: string, planId: string, originalPrice?: number) => {
    if (planId === "FREE") {
      router.push('/studio');
      return;
    }

    // 로그인 확인
    if (!user) {
      alert("결제를 진행하려면 먼저 로그인해주세요.");
      router.push('/sign-in');
      return;
    }

    setProcessingPlan(planId);
    
    try {
      console.log('Starting payment process for plan:', planId);
      console.log('User:', user);
      
      // 빌링키 등록 API 호출
      const response = await fetch('/api/payments/billing-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          customerEmail: user.email,
          customerName: user.user_metadata?.full_name || '고객',
          referralCode: referralCode.trim() || undefined,
          discountRate: referralDiscount,
          finalAmount: originalPrice ? getDiscountedPrice(originalPrice) : undefined,
        }),
      });

      console.log('API Response status:', response.status);
      
      const data = await response.json();
      console.log('API Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || '결제 요청에 실패했습니다');
      }

      // 토스페이먼츠 SDK 로드
      const tossPayments = await loadTossPayments(
        process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!
      );

      console.log('TossPayments SDK loaded, requesting billing auth...');
      console.log('Billing auth data:', data.billingAuthRequest);

      // 빌링키 발급 요청
      await tossPayments.requestBillingAuth('카드', {
        customerKey: data.billingAuthRequest.customerKey,
        successUrl: data.billingAuthRequest.successUrl,
        failUrl: data.billingAuthRequest.failUrl,
      });

    } catch (error) {
      console.error('Payment initiation error:', error);
      alert(error instanceof Error ? error.message : "결제 처리 중 오류가 발생했습니다.");
    } finally {
      setProcessingPlan(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-100 to-pink-100 px-4 py-1.5 text-sm font-medium mb-8 border border-purple-200">
            <Sparkles className="mr-2 h-4 w-4 text-purple-600" />
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-semibold">
              12,000+ 창작자가 선택한 플랫폼
            </span>
          </div>
          
          <h1 className="text-4xl font-bold mb-6">
            GenToon과 함께 
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              창작을 시작하세요
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            AI 기반 웹툰 제작 도구로 여러분의 창작 여정을 시작하세요. 
            언제든 플랜을 변경할 수 있습니다.
          </p>
          
          {/* 신뢰 지표 */}
          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground mb-8">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span>4.9/5 평점</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>12,000+ 창작자</span>
            </div>
            <div className="flex items-center gap-1">
              <Shield className="h-4 w-4" />
              <span>30일 환불 보장</span>
            </div>
          </div>
        </div>

        {/* Referral Code Input */}
        <div className="max-w-2xl mx-auto mb-12">
          <Card className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-lg">추천인 코드 입력</h3>
              {referralDiscount > 0 && (
                <Badge className="ml-auto bg-green-500">
                  첫 달 {referralDiscount}% 할인 적용!
                </Badge>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="추천인 코드 입력 (선택사항)"
                  value={referralCode}
                  onChange={(e) => {
                    setReferralCode(e.target.value);
                    if (e.target.value.length === 36) {
                      validateReferralCode(e.target.value);
                    }
                  }}
                  onBlur={() => validateReferralCode(referralCode)}
                  className="flex-1"
                />
                <Button
                  onClick={() => validateReferralCode(referralCode)}
                  disabled={isValidatingCode || !referralCode.trim()}
                  variant="outline"
                >
                  {isValidatingCode ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600" />
                  ) : (
                    '확인'
                  )}
                </Button>
              </div>
              {referralError && (
                <p className="text-sm text-red-500">{referralError}</p>
              )}
              {referralDiscount > 0 && (
                <p className="text-sm text-green-600">
                  ✨ 추천인 코드가 확인되었습니다! 모든 유료 플랜에 첫 달 20% 할인이 적용됩니다.
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`relative overflow-hidden ${
                plan.popular ? 'border-purple-200 shadow-lg scale-105' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-1 rounded-full flex items-center gap-1">
                    <Crown className="h-4 w-4" />
                    <span className="text-sm font-medium">인기</span>
                  </div>
                </div>
              )}
              
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="text-base">{plan.description}</CardDescription>
                <div className="mt-4">
                  {plan.originalPrice && referralDiscount > 0 ? (
                    <div>
                      <span className="text-2xl line-through text-gray-400">
                        ₩{plan.originalPrice.toLocaleString()}
                      </span>
                      <div>
                        <span className="text-4xl font-bold text-green-600">
                          ₩{getDiscountedPrice(plan.originalPrice).toLocaleString()}
                        </span>
                        {plan.priceUnit && <span className="text-muted-foreground">{plan.priceUnit}</span>}
                      </div>
                      <Badge className="mt-2 bg-green-500">
                        첫 달 {referralDiscount}% 할인 적용
                      </Badge>
                    </div>
                  ) : (
                    <>
                      <span className="text-4xl font-bold">{plan.price}</span>
                      {plan.priceUnit && <span className="text-muted-foreground">{plan.priceUnit}</span>}
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-3">
                      {feature.included ? (
                        <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <X className="h-5 w-5 text-gray-300 flex-shrink-0" />
                      )}
                      <span className={`text-sm ${!feature.included ? 'text-gray-400' : ''}`}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button 
                  className={`w-full ${
                    plan.popular ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700' : ''
                  }`}
                  variant={plan.buttonVariant}
                  disabled={processingPlan === plan.planId}
                  onClick={() => handlePlanSelection(plan.name, plan.planId, plan.originalPrice)}
                >
                  {processingPlan === plan.planId ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      처리 중...
                    </>
                  ) : (
                    plan.buttonText
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Enterprise Plan */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">기업 맞춤 플랜</h2>
                <p className="text-muted-foreground">
                  대량 제작이 필요한 기업을 위한 맞춤형 솔루션을 제공합니다
                </p>
              </div>
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                onClick={() => window.open('mailto:contact@gentoon.com', '_blank')}
              >
                문의하기
              </Button>
            </div>
          </div>
        </div>

        {/* FAQ or Additional Info */}
        <div className="max-w-4xl mx-auto mt-16">
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-4">안전한 결제</h3>
            <p className="text-muted-foreground">
              토스페이먼츠를 통한 안전한 결제 처리 • 언제든 구독 취소 가능 • 30일 환불 보장
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}