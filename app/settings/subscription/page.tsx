'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Crown,
  CreditCard,
  Plus,
  Trash2,
  ChevronDown,
  Gift,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { useOptimizedSettings } from '@/hooks/useOptimizedSettings';

interface PaymentMethod {
  id: string;
  type: 'CARD';
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

interface Coupon {
  code: string;
  discount: number;
  discountType: 'PERCENT' | 'FIXED';
  description: string;
  expiresAt: string;
}

export default function PaymentSettingsPage() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupons, setAppliedCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingCard, setAddingCard] = useState(false);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [showCouponForm, setShowCouponForm] = useState(false);

  const {
    userData,
    subscription,
    loading: settingsLoading
  } = useOptimizedSettings();

  useEffect(() => {
    loadPaymentData();
  }, []);

  const loadPaymentData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/payment-methods');
      const result = await response.json();
      
      if (result.success) {
        setPaymentMethods(result.paymentMethods || []);
        setAppliedCoupons(result.coupons || []);
      }
    } catch (error) {
      console.error('결제 정보 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCard = async () => {
    setAddingCard(true);
    
    try {
      // 토스페이먼츠 결제 수단 등록 위젯 로드
      const response = await fetch('/api/payment-methods/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 토스페이먼츠 결제위젯으로 리다이렉트
        window.location.href = result.redirectUrl;
      } else {
        alert('카드 등록 요청 실패: ' + result.error);
      }
    } catch (error) {
      console.error('카드 등록 실패:', error);
      alert('카드 등록 중 오류가 발생했습니다.');
    } finally {
      setAddingCard(false);
    }
  };

  const handleRemoveCard = async (cardId: string) => {
    if (!confirm('이 결제 수단을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/payment-methods/${cardId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setPaymentMethods(prev => prev.filter(method => method.id !== cardId));
        alert('결제 수단이 삭제되었습니다.');
      } else {
        alert('삭제 실패: ' + result.error);
      }
    } catch (error) {
      console.error('결제 수단 삭제 실패:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleSetDefaultCard = async (cardId: string) => {
    try {
      const response = await fetch(`/api/payment-methods/${cardId}/default`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setPaymentMethods(prev => 
          prev.map(method => ({
            ...method,
            isDefault: method.id === cardId
          }))
        );
      } else {
        alert('기본 결제 수단 설정 실패: ' + result.error);
      }
    } catch (error) {
      console.error('기본 결제 수단 설정 실패:', error);
      alert('설정 중 오류가 발생했습니다.');
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      alert('쿠폰 코드를 입력해주세요.');
      return;
    }

    setApplyingCoupon(true);
    
    try {
      const response = await fetch('/api/coupons/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setAppliedCoupons(prev => [...prev, result.coupon]);
        setCouponCode('');
        setShowCouponForm(false);
        alert('쿠폰이 성공적으로 적용되었습니다!');
      } else {
        alert('쿠폰 적용 실패: ' + result.error);
      }
    } catch (error) {
      console.error('쿠폰 적용 실패:', error);
      alert('쿠폰 적용 중 오류가 발생했습니다.');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const getCardBrandIcon = (brand: string) => {
    switch (brand.toLowerCase()) {
      case 'visa':
        return '💳';
      case 'mastercard':
        return '💳';
      case 'american_express':
        return '💳';
      default:
        return '💳';
    }
  };

  const getPlanName = (plan: string) => {
    switch (plan) {
      case 'PRO': return 'Pro';
      case 'PREMIUM': return 'Premium';
      case 'ADMIN': return 'Admin';
      default: return 'Free';
    }
  };

  if (loading || settingsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">결제 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/settings">
              <Button variant="outline" size="sm" className="text-gray-600">
                <ArrowLeft className="h-4 w-4 mr-2" />
                돌아가기
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">결제 정보 설정</h1>
              <p className="text-gray-600 mt-1">결제 수단과 쿠폰을 관리하세요</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-4xl mx-auto space-y-6">
        {/* 현재 요금제 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-purple-600" />
              사용중인 요금제
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                현재 {subscription?.plan ? getPlanName(subscription.plan) : 'Free'} 요금제를 이용중입니다.
              </h3>
              <div className="flex justify-center items-center gap-2 mt-4">
                <Crown className="h-6 w-6 text-yellow-500" />
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 px-4 py-2">
                  {subscription?.plan ? getPlanName(subscription.plan) : 'Free'} 체험판 사용
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 결제 수단 */}
        <Card>
          <CardHeader>
            <CardTitle>결제 수단</CardTitle>
            <p className="text-sm text-gray-600">
              {paymentMethods.length === 0 
                ? '등록된 결제 수단이 없습니다.' 
                : '등록된 결제 수단을 관리하세요.'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {paymentMethods.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <p className="text-gray-600 text-lg mb-2">등록된 결제 수단이 없습니다.</p>
                  <Button 
                    onClick={handleAddCard} 
                    disabled={addingCard}
                    className="mt-4"
                  >
                    {addingCard ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        등록 중...
                      </>
                    ) : (
                      '결제 수단 등록'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className={`p-4 border rounded-lg flex items-center justify-between ${
                        method.isDefault ? 'border-purple-300 bg-purple-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getCardBrandIcon(method.brand)}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {method.brand.toUpperCase()} **** {method.last4}
                            </span>
                            {method.isDefault && (
                              <Badge variant="outline" className="text-xs">기본</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            만료: {method.expiryMonth.toString().padStart(2, '0')}/{method.expiryYear}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!method.isDefault && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetDefaultCard(method.id)}
                          >
                            기본으로 설정
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveCard(method.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <Button 
                  variant="outline" 
                  onClick={handleAddCard}
                  disabled={addingCard}
                  className="w-full"
                >
                  {addingCard ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      등록 중...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      새 결제 수단 추가
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* 쿠폰/이용권 */}
        <Card>
          <CardHeader>
            <CardTitle>쿠폰/이용권</CardTitle>
            <p className="text-sm text-gray-600">쿠폰 또는 이용권을 쿠폰함에 등록하고 사용하세요</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {appliedCoupons.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">적용된 쿠폰</h4>
                {appliedCoupons.map((coupon, index) => (
                  <div key={index} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Gift className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-900">{coupon.code}</span>
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          {coupon.discountType === 'PERCENT' ? `${coupon.discount}% 할인` : `${coupon.discount.toLocaleString()}원 할인`}
                        </Badge>
                      </div>
                      <span className="text-xs text-green-600">
                        {new Date(coupon.expiresAt).toLocaleDateString('ko-KR')}까지
                      </span>
                    </div>
                    <p className="text-sm text-green-700 mt-1">{coupon.description}</p>
                  </div>
                ))}
              </div>
            )}

            {!showCouponForm ? (
              <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
                <p className="text-gray-600 mb-4">쿠폰 또는 이용권을 쿠폰함에 등록하고 사용하세요.</p>
                <Button
                  variant="outline"
                  onClick={() => setShowCouponForm(true)}
                  className="border-dashed"
                >
                  쿠폰함 열기
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </div>
            ) : (
              <div className="border border-dashed border-gray-300 rounded-lg p-4 space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="쿠폰 코드를 입력하세요"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    disabled={applyingCoupon}
                  />
                  <Button 
                    onClick={handleApplyCoupon}
                    disabled={applyingCoupon || !couponCode.trim()}
                  >
                    {applyingCoupon ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      '적용'
                    )}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCouponForm(false);
                    setCouponCode('');
                  }}
                  className="w-full"
                >
                  닫기
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}