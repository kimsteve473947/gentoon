'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle,
  Calendar,
  Shield,
  RefreshCw
} from 'lucide-react';
import { useOptimizedSettings } from '@/hooks/useOptimizedSettings';

interface PaymentMethod {
  id: string;
  type: 'card';
  brand: string; // VISA, MASTERCARD, 등
  last4Digits: string;
  expiryDate: string; // MM/YY 형태
  isDefault: boolean;
  billingKey: string;
  registeredAt: string;
  cardCompany?: string; // 신한, 삼성, 현대 등
}

interface BillingHistory {
  id: string;
  amount: number;
  status: 'success' | 'failed' | 'pending';
  billedAt: string;
  nextBillingDate?: string;
  failureReason?: string;
}

export default function PaymentMethodSettings() {
  const { user, subscription, loading } = useOptimizedSettings();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [billingHistory, setBillingHistory] = useState<BillingHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingCard, setIsAddingCard] = useState(false);

  useEffect(() => {
    if (user) {
      loadPaymentMethods();
      loadBillingHistory();
    }
  }, [user]);

  const loadPaymentMethods = async () => {
    try {
      const response = await fetch('/api/payments/methods');
      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data.methods || []);
      }
    } catch (error) {
      console.error('결제수단 로드 실패:', error);
    }
  };

  const loadBillingHistory = async () => {
    try {
      const response = await fetch('/api/payments/billing-history');
      if (response.ok) {
        const data = await response.json();
        setBillingHistory(data.history || []);
      }
    } catch (error) {
      console.error('결제내역 로드 실패:', error);
    }
  };

  const handleAddPaymentMethod = async () => {
    setIsAddingCard(true);
    
    try {
      // 토스페이먼츠 SDK 초기화
      const tossPayments = (window as any).TossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY);
      
      // 고유한 customerKey 생성 (UUID 사용)
      const customerKey = `customer_${user?.id}_${Date.now()}`;
      
      // 빌링키 발급 요청
      await tossPayments.requestBillingAuth('카드', {
        customerKey,
        successUrl: `${window.location.origin}/api/payments/billing-success`,
        failUrl: `${window.location.origin}/settings?tab=payment&error=billing_failed`
      });
    } catch (error) {
      console.error('결제수단 등록 실패:', error);
      alert('결제수단 등록 중 오류가 발생했습니다.');
      setIsAddingCard(false);
    }
  };

  const handleDeletePaymentMethod = async (methodId: string) => {
    if (!confirm('이 결제수단을 삭제하시겠습니까?')) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/payments/methods/${methodId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadPaymentMethods();
        alert('결제수단이 삭제되었습니다.');
      } else {
        const data = await response.json();
        alert(data.error || '결제수단 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('결제수단 삭제 실패:', error);
      alert('결제수단 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDefaultPaymentMethod = async (methodId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/payments/methods/${methodId}/default`, {
        method: 'POST'
      });

      if (response.ok) {
        await loadPaymentMethods();
      } else {
        const data = await response.json();
        alert(data.error || '기본 결제수단 설정에 실패했습니다.');
      }
    } catch (error) {
      console.error('기본 결제수단 설정 실패:', error);
      alert('기본 결제수단 설정 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCardNumber = (last4: string, brand: string) => {
    return `**** **** **** ${last4}`;
  };

  const getCardBrandIcon = (brand: string) => {
    // 실제로는 각 카드사별 아이콘을 사용
    return <CreditCard className="h-6 w-6" />;
  };

  const getNextBillingDate = () => {
    if (!subscription?.currentPeriodEnd) return null;
    return new Date(subscription.currentPeriodEnd);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 bg-gray-200 rounded-lg"></div>
        <div className="h-32 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 현재 구독 상태 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            구독 상태
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={subscription?.plan === 'FREE' ? 'secondary' : 'default'}>
                  {subscription?.plan === 'FREE' ? '무료 플랜' : 
                   subscription?.plan === 'STARTER' ? '스타터 플랜' :
                   subscription?.plan === 'PRO' ? '프로 플랜' :
                   subscription?.plan === 'PREMIUM' ? '프리미엄 플랜' : '알 수 없음'}
                </Badge>
                {subscription?.plan !== 'FREE' && (
                  <Badge variant="outline" className="text-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    활성
                  </Badge>
                )}
              </div>
              {subscription?.plan !== 'FREE' && getNextBillingDate() && (
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  다음 결제일: {getNextBillingDate()?.toLocaleDateString('ko-KR')}
                </p>
              )}
            </div>
            
            {subscription?.plan !== 'FREE' && paymentMethods.length === 0 && (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">결제수단 등록 필요</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 등록된 결제수단 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                등록된 결제수단
              </CardTitle>
              <CardDescription>
                구독 갱신 시 자동으로 결제됩니다.
              </CardDescription>
            </div>
            <Button 
              onClick={handleAddPaymentMethod}
              disabled={isAddingCard}
              className="flex items-center gap-2"
            >
              {isAddingCard ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  등록 중...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  카드 등록
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {paymentMethods.length > 0 ? (
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div 
                  key={method.id} 
                  className={`p-4 border rounded-lg transition-all ${
                    method.isDefault ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getCardBrandIcon(method.brand)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg">
                            {formatCardNumber(method.last4Digits, method.brand)}
                          </span>
                          {method.isDefault && (
                            <Badge variant="outline" className="text-blue-600">
                              기본 결제수단
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {method.cardCompany && `${method.cardCompany} • `}
                          만료일: {method.expiryDate}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {!method.isDefault && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDefaultPaymentMethod(method.id)}
                          disabled={isLoading}
                        >
                          기본으로 설정
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePaymentMethod(method.id)}
                        disabled={isLoading}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <CreditCard className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p className="font-medium mb-1">등록된 결제수단이 없습니다</p>
              <p className="text-sm">카드를 등록하여 자동 결제를 설정하세요</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 결제 내역 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            최근 결제 내역
          </CardTitle>
          <CardDescription>
            최근 6개월간의 결제 내역입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {billingHistory.length > 0 ? (
            <div className="space-y-3">
              {billingHistory.map((history) => (
                <div key={history.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        ₩{history.amount.toLocaleString()}
                      </span>
                      <Badge variant={
                        history.status === 'success' ? 'default' :
                        history.status === 'failed' ? 'destructive' : 'secondary'
                      }>
                        {history.status === 'success' ? '결제완료' :
                         history.status === 'failed' ? '결제실패' : '대기중'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(history.billedAt).toLocaleDateString('ko-KR')}
                      {history.failureReason && ` • ${history.failureReason}`}
                    </p>
                  </div>
                  
                  {history.status === 'success' && history.nextBillingDate && (
                    <div className="text-right text-sm text-gray-500">
                      다음 결제: {new Date(history.nextBillingDate).toLocaleDateString('ko-KR')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p className="font-medium mb-1">결제 내역이 없습니다</p>
              <p className="text-sm">첫 결제 후 내역을 확인할 수 있습니다</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 자동 결제 안내 */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-medium text-blue-900">자동 결제 안내</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• 구독 갱신일에 등록된 카드로 자동 결제됩니다.</p>
                <p>• 결제 실패 시 7일간 재시도하며, 실패 시 서비스가 중단될 수 있습니다.</p>
                <p>• 결제수단 변경 시 즉시 적용됩니다.</p>
                <p>• 언제든 구독을 취소할 수 있습니다.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}