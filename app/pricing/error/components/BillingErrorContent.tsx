'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { XCircle, RefreshCw, ArrowLeft, AlertTriangle, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ErrorCodeMap {
  [key: string]: {
    title: string;
    description: string;
    suggestion: string;
  };
}

const ERROR_CODES: ErrorCodeMap = {
  'PAY_PROCESS_CANCELED': {
    title: '결제가 취소되었습니다',
    description: '사용자가 결제 과정을 취소했습니다.',
    suggestion: '다시 시도하거나 다른 결제수단을 이용해주세요.'
  },
  'PAY_PROCESS_ABORTED': {
    title: '결제가 중단되었습니다',
    description: '결제 진행 중 오류가 발생하여 중단되었습니다.',
    suggestion: '잠시 후 다시 시도해주세요.'
  },
  'REJECT_CARD_COMPANY': {
    title: '카드사에서 승인을 거부했습니다',
    description: '카드 한도 초과 또는 카드사 정책에 의해 결제가 거부되었습니다.',
    suggestion: '다른 카드를 이용하거나 카드사에 문의해주세요.'
  },
  'INVALID_CARD_COMPANY': {
    title: '유효하지 않은 카드입니다',
    description: '카드 정보가 올바르지 않거나 사용할 수 없는 카드입니다.',
    suggestion: '카드 정보를 다시 확인하고 시도해주세요.'
  },
  'NOT_SUPPORTED_INSTALLMENT': {
    title: '할부가 지원되지 않는 카드입니다',
    description: '선택하신 할부 개월수는 해당 카드에서 지원하지 않습니다.',
    suggestion: '일시불 또는 다른 할부 개월수를 선택해주세요.'
  },
  'EXCEED_MAX_DAILY_PAYMENT_COUNT': {
    title: '일일 결제 한도를 초과했습니다',
    description: '하루 최대 결제 횟수를 초과했습니다.',
    suggestion: '내일 다시 시도하거나 다른 결제수단을 이용해주세요.'
  },
  'NOT_SUPPORTED_MONTHLY_INSTALLMENT': {
    title: '월 정기결제가 지원되지 않는 카드입니다',
    description: '해당 카드는 정기 결제를 지원하지 않습니다.',
    suggestion: '다른 카드를 이용해주세요.'
  },
  'EXCEED_MAX_PAYMENT_MONEY': {
    title: '결제 한도를 초과했습니다',
    description: '설정된 최대 결제 금액을 초과했습니다.',
    suggestion: '결제 금액을 확인하고 다시 시도해주세요.'
  },
  'NOT_FOUND_TERMINAL_ID': {
    title: '결제 단말기 오류',
    description: '결제 처리 중 시스템 오류가 발생했습니다.',
    suggestion: '잠시 후 다시 시도해주세요.'
  },
  'INVALID_AUTHORIZE_AUTH': {
    title: '인증 오류',
    description: '결제 인증 과정에서 오류가 발생했습니다.',
    suggestion: '다시 시도하거나 고객센터에 문의해주세요.'
  }
};

export default function BillingErrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const code = searchParams.get('code') || searchParams.get('errorCode');
  const message = searchParams.get('message') || searchParams.get('errorMsg');
  const orderId = searchParams.get('orderId');

  const errorInfo = code && ERROR_CODES[code] ? ERROR_CODES[code] : {
    title: '결제 중 오류가 발생했습니다',
    description: message || '알 수 없는 오류가 발생했습니다.',
    suggestion: '다시 시도하거나 고객센터에 문의해주세요.'
  };

  const handleRetry = () => {
    router.push('/pricing');
  };

  const handleGoBack = () => {
    router.push('/pricing');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          {/* Error Icon */}
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          {/* Error Message */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {errorInfo.title}
          </h1>
          <p className="text-gray-600 mb-6">
            {errorInfo.description}
          </p>

          {/* Error Details */}
          <Alert className="mb-6 text-left">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">해결 방법:</p>
                <p className="text-sm">{errorInfo.suggestion}</p>
                
                {code && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">오류 코드:</span>
                      <span className="font-mono">{code}</span>
                    </div>
                  </div>
                )}
                
                {orderId && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">주문 번호:</span>
                    <span className="font-mono">{orderId}</span>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              onClick={handleRetry}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              다시 시도하기
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleGoBack}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              요금제 페이지로 돌아가기
            </Button>
          </div>

          {/* Support Section */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <CreditCard className="w-4 h-4 mr-2 text-gray-600" />
              <span className="text-sm font-medium text-gray-900">도움이 필요하신가요?</span>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              문제가 지속되면 아래 정보와 함께 고객센터로 문의해주세요.
            </p>
            
            <div className="space-y-1 text-xs text-left">
              {code && (
                <div className="flex justify-between">
                  <span className="text-gray-500">오류 코드:</span>
                  <span className="font-mono">{code}</span>
                </div>
              )}
              {orderId && (
                <div className="flex justify-between">
                  <span className="text-gray-500">주문 ID:</span>
                  <span className="font-mono">{orderId}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">발생 시간:</span>
                <span>{new Date().toLocaleString('ko-KR')}</span>
              </div>
            </div>

            <Button 
              variant="link" 
              size="sm"
              onClick={() => window.open('mailto:support@instatoon.com', '_blank')}
              className="mt-3 text-purple-600 hover:text-purple-700 p-0"
            >
              고객센터 문의하기
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}