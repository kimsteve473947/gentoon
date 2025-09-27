'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import { createBrowserClient } from '@supabase/ssr';
import { Check, ArrowRight, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PLAN_CONFIGS, PlanType, getPublicPlans } from '@/lib/subscription/plan-config';

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

  // 🎯 중앙집중식 플랜 설정 사용 (유료 플랜만)
  const plans = [
    // STARTER 플랜
    {
      name: PLAN_CONFIGS.STARTER.name,
      description: "개인 창작자 추천",
      price: `₩${PLAN_CONFIGS.STARTER.price.toLocaleString()}`,
      priceUnit: "/월",
      originalPrice: PLAN_CONFIGS.STARTER.price,
      features: PLAN_CONFIGS.STARTER.features,
      buttonText: `${PLAN_CONFIGS.STARTER.name} 시작하기`,
      planId: "STARTER" as PlanType,
      recommended: false
    },
    // PRO 플랜 (추천)
    {
      name: PLAN_CONFIGS.PRO.name,
      description: "개인 사업자 추천",
      price: `₩${PLAN_CONFIGS.PRO.price.toLocaleString()}`,
      priceUnit: "/월",
      originalPrice: PLAN_CONFIGS.PRO.price,
      features: PLAN_CONFIGS.PRO.features,
      buttonText: `${PLAN_CONFIGS.PRO.name} 시작하기`,
      planId: "PRO" as PlanType,
      recommended: true
    },
    // PREMIUM 플랜
    {
      name: PLAN_CONFIGS.PREMIUM.name,
      description: "기업 및 전문가 추천",
      price: `₩${PLAN_CONFIGS.PREMIUM.price.toLocaleString()}`,
      priceUnit: "/월",
      originalPrice: PLAN_CONFIGS.PREMIUM.price,
      features: PLAN_CONFIGS.PREMIUM.features,
      buttonText: `${PLAN_CONFIGS.PREMIUM.name} 시작하기`,
      planId: "PREMIUM" as PlanType,
      recommended: false
    }
  ];

  const handlePlanSelection = async (planId: string, originalPrice?: number) => {
    if (planId === "FREE") {
      if (!user) {
        alert("무료 플랜을 사용하려면 먼저 로그인해주세요.");
        router.push('/sign-in');
        return;
      }
      router.push('/projects');
      return;
    }

    if (!user) {
      alert("결제를 진행하려면 먼저 로그인해주세요.");
      router.push('/sign-in');
      return;
    }

    setProcessingPlan(planId);
    
    try {
      console.log('🔄 결제 요청 시작:', { 
        planId, 
        userEmail: user.email,
        tossClientKey: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ? 'present' : 'missing'
      });
      
      const response = await fetch('/api/payments/billing-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          customerEmail: user.email,
          customerName: user.user_metadata?.full_name || '고객',
        }),
      });

      console.log('📡 API 응답 상태:', response.status);
      console.log('📡 API 응답 헤더:', Object.fromEntries(response.headers.entries()));

      // HTML 응답인지 확인
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('❌ 예상치 못한 응답 타입:', contentType);
        const text = await response.text();
        console.error('❌ 응답 내용:', text.substring(0, 200));
        throw new Error('서버에서 올바르지 않은 응답을 반환했습니다');
      }

      const data = await response.json();
      console.log('📦 API 응답 데이터:', data);

      if (!response.ok) {
        throw new Error(data.error || '결제 요청에 실패했습니다');
      }

      // API 응답 데이터 검증
      if (!data || !data.billingAuthRequest) {
        console.error('❌ API 응답에 billingAuthRequest가 없습니다:', data);
        throw new Error('서버 응답이 올바르지 않습니다');
      }

      console.log('🎫 빌링키 등록 요청 데이터:', {
        customerKey: data.billingAuthRequest.customerKey,
        customerEmail: data.billingAuthRequest.customerEmail,
        customerName: data.billingAuthRequest.customerName,
      });

      console.log('🔑 Toss Payments SDK 로딩 중...');
      const tossPayments = await loadTossPayments(
        process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!
      );
      console.log('✅ Toss Payments SDK 로딩 완료');

      // 🎯 토스페이먼츠 공식 가이드에 따른 빌링키 등록
      console.log('🔑 토스페이먼츠 빌링키 등록 시작 (공식 SDK 방식)');
      
      // 토스페이먼츠 호스팅 결제창을 통한 빌링키 등록
      const billingResult = await tossPayments.requestBillingAuth('CARD', {
        customerKey: data.billingAuthRequest.customerKey,
        successUrl: data.billingAuthRequest.successUrl,
        failUrl: data.billingAuthRequest.failUrl,
        customerEmail: data.billingAuthRequest.customerEmail,
        customerName: data.billingAuthRequest.customerName,
      });
      
      console.log('✅ 빌링키 등록 결과:', billingResult);
      
      console.log('✅ requestBillingAuth 호출 완료 (리다이렉트 예정)');

    } catch (error) {
      console.error('💥 결제 요청 오류:', error);
      
      let errorMessage = "결제 처리 중 오류가 발생했습니다.";
      
      if (error instanceof Error) {
        if (error.message.includes('JSON')) {
          errorMessage = "서버 연결에 문제가 있습니다. 페이지를 새로고침 후 다시 시도해주세요.";
        } else {
          errorMessage = error.message;
        }
      }
      
      alert(errorMessage);
    } finally {
      setProcessingPlan(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <div className="container mx-auto px-4 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            간단하고 투명한 요금제
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            필요한 만큼만 사용하세요. 언제든 변경 가능합니다.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`relative transition-all duration-200 hover:shadow-xl flex flex-col h-full ${
                plan.recommended 
                  ? 'border-purple-500 shadow-xl scale-[1.02] ring-2 ring-purple-200' 
                  : 'border-gray-200 hover:scale-[1.01]'
              }`}
            >
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                    <Crown className="h-4 w-4" />
                    가장 인기있는 플랜
                  </div>
                </div>
              )}
              
              <CardHeader className="text-center pb-6 pt-8">
                <CardTitle className="text-2xl font-bold text-gray-900">
                  {plan.name}
                </CardTitle>
                <CardDescription className="text-gray-600 mt-2">
                  {plan.description}
                </CardDescription>
                
                <div className="mt-6">
                  <span className={`text-4xl font-bold ${
                    plan.recommended 
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent'
                      : 'text-gray-900'
                  }`}>
                    {plan.price}
                  </span>
                  {plan.priceUnit && (
                    <span className="text-gray-500 text-lg">{plan.priceUnit}</span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-0 flex flex-col h-full">
                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <Check className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                        plan.recommended ? 'text-purple-600' : 'text-green-600'
                      }`} />
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  className={`w-full h-14 font-medium transition-all duration-200 mt-auto ${
                    plan.recommended 
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl' 
                      : 'bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-200 hover:border-gray-300'
                  }`}
                  disabled={processingPlan === plan.planId}
                  onClick={() => handlePlanSelection(plan.planId, plan.originalPrice)}
                >
                  {processingPlan === plan.planId ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      처리 중...
                    </>
                  ) : (
                    <>
                      {plan.buttonText}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Info */}
        <div className="text-center mt-16">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 max-w-4xl mx-auto border border-gray-200 shadow-lg">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              모든 플랜에 포함된 혜택
            </h3>
            <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-600">
              <div className="flex items-center justify-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span>토스페이먼츠 안전결제</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span>실시간 고객 지원</span>
              </div>
            </div>
          </div>
        </div>

        {/* Enterprise CTA */}
        <div className="max-w-4xl mx-auto mt-16">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-8 text-center text-white">
            <h2 className="text-2xl font-bold mb-4">기업 맞춤 플랜이 필요하신가요?</h2>
            <p className="text-purple-100 mb-6">
              대량 제작이 필요한 기업을 위한 맞춤형 솔루션을 제공합니다
            </p>
            <Button 
              size="lg" 
              variant="secondary"
              className="bg-white text-purple-600 hover:bg-gray-100"
              onClick={() => window.open('mailto:support@gentoon.com', '_blank')}
            >
              기업 상담 문의하기
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}