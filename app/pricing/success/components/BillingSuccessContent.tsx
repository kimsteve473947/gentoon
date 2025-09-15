'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, CreditCard, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function BillingSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(5);

  const paymentKey = searchParams.get('paymentKey');
  const orderId = searchParams.get('orderId');
  const amount = searchParams.get('amount');

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          router.push("/pricing");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          {/* Success Icon */}
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          {/* Success Message */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            결제가 완료되었습니다!
          </h1>
          <p className="text-gray-600 mb-6">
            구독이 성공적으로 활성화되었습니다.
          </p>

          {/* Payment Details */}
          {(paymentKey || orderId || amount) && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                <CreditCard className="w-4 h-4 mr-2" />
                결제 정보
              </h3>
              <div className="space-y-2 text-sm">
                {orderId && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">주문번호:</span>
                    <span className="font-mono text-gray-900">{orderId}</span>
                  </div>
                )}
                {amount && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">결제금액:</span>
                    <span className="font-semibold text-gray-900">
                      {Number(amount).toLocaleString()}원
                    </span>
                  </div>
                )}
                {paymentKey && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">결제키:</span>
                    <span className="font-mono text-xs text-gray-900 truncate max-w-[120px]">
                      {paymentKey}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Auto Redirect Notice */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center text-blue-600 mb-2">
              <Clock className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">자동 이동</span>
            </div>
            <p className="text-sm text-blue-700">
              {countdown}초 후 요금제 페이지로 이동합니다
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              onClick={() => router.push("/pricing")}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              요금제 페이지로 이동
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => router.push("/studio")}
              className="w-full"
            >
              스튜디오 시작하기
            </Button>
          </div>

          {/* Support Link */}
          <p className="text-xs text-gray-500 mt-6">
            결제 관련 문의사항이 있으시면{' '}
            <a href="mailto:support@instatoon.com" className="text-purple-600 hover:underline">
              고객센터
            </a>
            로 연락해주세요.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}