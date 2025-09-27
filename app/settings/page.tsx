'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  User,
  Shield,
  Mail,
  Settings,
  Building,
  CreditCard,
  FileText,
  ChevronRight,
  Crown,
  Camera,
  Upload,
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
  Gift
} from 'lucide-react';
import { useOptimizedSettings } from '@/hooks/useOptimizedSettings';
import { CardRegistrationModal } from '@/components/ui/card-registration-modal';
import Link from 'next/link';

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

export default function MyInfoPage() {
  const [selectedMenu, setSelectedMenu] = useState('account');
  const [profileForm, setProfileForm] = useState({ name: '', email: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Payment-related state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupons, setAppliedCoupons] = useState<Coupon[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  
  const {
    settingsData,
    userData,
    subscription,
    loading,
    error,
    hasData,
    updateUserProfile,
    deleteAccount
  } = useOptimizedSettings();

  // 프로필 폼 초기화
  React.useEffect(() => {
    if (userData) {
      setProfileForm({
        name: userData.name || '',
        email: userData.email || ''
      });
    }
  }, [userData]);

  // Load payment data when subscription menu is selected
  React.useEffect(() => {
    if (selectedMenu === 'subscription') {
      loadPaymentData();
    }
  }, [selectedMenu]);

  // Handle success/error messages from URL params
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentRegistered = urlParams.get('payment_registered');
    const error = urlParams.get('error');

    if (paymentRegistered === 'true') {
      alert('✅ 결제 수단이 성공적으로 등록되었습니다!');
      // Clean up URL
      window.history.replaceState({}, '', '/settings?tab=subscription');
      loadPaymentData(); // Refresh payment data
    } else if (error === 'billing_failed') {
      alert('❌ 결제 수단 등록에 실패했습니다. 다시 시도해주세요.');
      // Clean up URL
      window.history.replaceState({}, '', '/settings?tab=subscription');
    } else if (error === 'billing_registration_failed') {
      alert('❌ 결제 수단 등록 처리 중 오류가 발생했습니다.');
      // Clean up URL
      window.history.replaceState({}, '', '/settings?tab=subscription');
    }
  }, []);

  const loadPaymentData = async () => {
    try {
      setPaymentLoading(true);
      const response = await fetch('/api/payment-methods');
      const result = await response.json();
      
      if (result.success) {
        setPaymentMethods(result.paymentMethods || []);
        setAppliedCoupons(result.coupons || []);
      }
    } catch (error) {
      console.error('결제 정보 로드 실패:', error);
    } finally {
      setPaymentLoading(false);
    }
  };

  // 프로필 업데이트 함수
  const handleProfileUpdate = async () => {
    setProfileLoading(true);
    try {
      const result = await updateUserProfile({ name: profileForm.name });
      if (result.success) {
        alert('프로필이 업데이트되었습니다.');
      } else {
        alert('업데이트 실패: ' + result.error);
      }
    } catch (error) {
      alert('업데이트 중 오류가 발생했습니다.');
    } finally {
      setProfileLoading(false);
    }
  };

  // 계정 삭제 함수
  const handleDeleteAccount = async () => {
    if (!confirm('정말로 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }
    
    try {
      const result = await deleteAccount();
      if (result.success) {
        alert('계정이 삭제되었습니다.');
        window.location.href = '/';
      } else {
        alert('계정 삭제 실패: ' + result.error);
      }
    } catch (error) {
      alert('계정 삭제 중 오류가 발생했습니다.');
    }
  };

  // 프로필 이미지 업로드 함수
  const handleAvatarUpload = async (file: File) => {
    if (!file) return;

    // 파일 크기 검사 (5MB 제한)
    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하여야 합니다.');
      return;
    }

    // 파일 타입 검사
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    setAvatarUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-avatar', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (result.success) {
        // Supabase Auth 메타데이터 업데이트
        const updateResult = await updateUserProfile({ avatarUrl: result.url });
        if (updateResult.success) {
          // 성공시 부드러운 애니메이션 효과를 위해 약간의 지연
          setTimeout(() => {
            alert('✨ 프로필 사진이 성공적으로 업데이트되었습니다!');
          }, 500);
        } else {
          alert('❌ 프로필 사진 업데이트 실패: ' + updateResult.error);
        }
      } else {
        alert('❌ 업로드 실패: ' + result.error);
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      alert('❌ 업로드 중 오류가 발생했습니다.');
    } finally {
      setAvatarUploading(false);
    }
  };

  // 드래그 앤 드롭 처리
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleAvatarUpload(file);
    } else {
      alert('이미지 파일만 업로드 가능합니다.');
    }
  };

  // Payment-related functions
  const handleAddCard = async () => {
    if (!userData?.id) {
      alert('사용자 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setAddingCard(true);
    
    try {
      // 토스페이먼츠 SDK 초기화
      const tossPayments = (window as any).TossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY);
      
      // 고유한 customerKey 생성
      const customerKey = `customer_${userData.id}_${Date.now()}`;
      
      // 빌링키 발급 요청 (결제 수단 등록만)
      await tossPayments.requestBillingAuth('카드', {
        customerKey,
        successUrl: `${window.location.origin}/api/payments/billing-key-register`,
        failUrl: `${window.location.origin}/settings?tab=subscription&error=billing_failed`
      });
    } catch (error) {
      console.error('결제수단 등록 실패:', error);
      alert('결제수단 등록 중 오류가 발생했습니다.');
      setAddingCard(false);
    }
  };

  const handleCardRegistrationSuccess = async () => {
    await loadPaymentData(); // 결제 수단 목록 새로고침
    alert('카드가 성공적으로 등록되었습니다!');
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

  if (loading && !hasData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex">
          <div className="w-80 bg-white border-r p-6">
            <div className="animate-pulse space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full"></div>
                <div className="space-y-2">
                  <div className="h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-32"></div>
                  <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-20"></div>
                </div>
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-12 bg-gradient-to-r from-gray-200 to-gray-300 rounded flex items-center gap-3 p-3">
                    <div className="w-5 h-5 bg-gray-300 rounded"></div>
                    <div className="h-4 bg-gray-300 rounded flex-1"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 p-8">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-48"></div>
              <div className="space-y-4">
                <div className="h-32 bg-gradient-to-r from-gray-200 to-gray-300 rounded"></div>
                <div className="h-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded"></div>
                <div className="h-16 bg-gradient-to-r from-gray-200 to-gray-300 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">설정 로드 실패</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'PRO': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'PREMIUM': return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-transparent';
      case 'ADMIN': return 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-transparent';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
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

  // 계정 관련 필수 메뉴
  const accountMenus = [
    {
      id: 'account',
      title: '내 계정',
      icon: User,
    },
    {
      id: 'security',
      title: '로그인 및 보안',
      icon: Shield,
    },
    {
      id: 'notifications',
      title: '알림',
      icon: Mail,
    },
    {
      id: 'preferences',
      title: '환경설정',
      icon: Settings,
    }
  ];

  // 관리 관련 메뉴
  const managementMenus = [
    {
      id: 'workspace',
      title: '워크스페이스 설정',
      icon: Building,
    },
    {
      id: 'payment',
      title: '결제수단 관리',
      icon: CreditCard,
    },
    {
      id: 'subscription',
      title: '구독 관리',
      icon: Crown,
    },
    {
      id: 'billing',
      title: '결제 내역',
      icon: FileText,
    }
  ];

  // 결제 정보 설정 컨텐츠 컴포넌트
  const SubscriptionContent = () => {
    if (paymentLoading) {
      return (
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">결제 정보 설정</h1>
            <p className="text-gray-600">결제 수단과 쿠폰을 관리하세요</p>
          </div>
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-600" />
            <p className="text-gray-600">결제 정보를 불러오는 중...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">결제 정보 설정</h1>
          <p className="text-gray-600">결제 수단과 쿠폰을 관리하세요</p>
        </div>

        {/* 현재 요금제 */}
        <Card className="max-w-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-semibold">사용중인 요금제</h3>
            </div>
            <div className="space-y-4">
              <div className="text-center py-4">
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  현재 {subscription?.plan ? getPlanName(subscription.plan) : 'Free'} 요금제를 이용중입니다.
                </h3>
                <div className="flex justify-center items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-500" />
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 px-3 py-1">
                    {subscription?.plan ? getPlanName(subscription.plan) : 'Free'} 플랜
                  </Badge>
                </div>
              </div>
              
              {/* 구독 정보 */}
              {subscription?.plan && subscription.plan !== 'FREE' && (
                <div className="border-t pt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">구독 시작일</span>
                      <p className="font-medium text-gray-900">
                        {subscription.currentPeriodStart 
                          ? new Date(subscription.currentPeriodStart).toLocaleDateString('ko-KR')
                          : '정보 없음'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">다음 결제일</span>
                      <p className="font-medium text-gray-900">
                        {subscription.currentPeriodEnd 
                          ? new Date(subscription.currentPeriodEnd).toLocaleDateString('ko-KR')
                          : '정보 없음'}
                      </p>
                    </div>
                  </div>
                  
                  {/* 구독 상태 */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                      <span className="text-gray-500 text-sm">구독 상태</span>
                      <p className="font-medium">
                        {subscription.cancelAtPeriodEnd ? (
                          <span className="text-red-600">기간 만료 시 취소 예정</span>
                        ) : (
                          <span className="text-green-600">활성</span>
                        )}
                      </p>
                    </div>
                    
                    {!subscription.cancelAtPeriodEnd && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={async () => {
                          if (confirm('구독을 취소하시겠습니까? 현재 결제 기간이 끝나면 자동으로 무료 플랜으로 변경됩니다.')) {
                            try {
                              const response = await fetch('/api/settings', {
                                method: 'DELETE'
                              });
                              const result = await response.json();
                              if (result.success) {
                                alert('구독이 취소되었습니다. 현재 결제 기간까지는 계속 이용하실 수 있습니다.');
                                window.location.reload();
                              } else {
                                alert('구독 취소 실패: ' + result.error);
                              }
                            } catch (error) {
                              alert('구독 취소 중 오류가 발생했습니다.');
                            }
                          }
                        }}
                        className="text-red-600 hover:text-red-700 border-red-300 hover:bg-red-50"
                      >
                        구독 취소
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* 무료 플랜인 경우 업그레이드 유도 */}
              {(!subscription?.plan || subscription.plan === 'FREE') && (
                <div className="text-center pt-4 border-t">
                  <p className="text-gray-600 mb-3 text-sm">더 많은 기능을 이용하려면 유료 플랜으로 업그레이드하세요</p>
                  <Link href="/pricing">
                    <Button className="bg-purple-600 hover:bg-purple-700">
                      플랜 업그레이드
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 결제 수단 */}
        <Card className="max-w-2xl">
          <CardContent className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">결제 수단</h3>
              <p className="text-sm text-gray-600 mt-1">
                {paymentMethods.length === 0 
                  ? '등록된 결제 수단이 없습니다.' 
                  : '등록된 결제 수단을 관리하세요.'}
              </p>
            </div>
            <div className="space-y-4">
              {paymentMethods.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <p className="text-gray-600 mb-3">등록된 결제 수단이 없습니다.</p>
                    <Button 
                      onClick={handleAddCard} 
                      disabled={addingCard}
                      className="mt-2"
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
                        className={`p-3 border rounded-lg flex items-center justify-between ${
                          method.isDefault ? 'border-purple-300 bg-purple-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{getCardBrandIcon(method.brand)}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {method.brand.toUpperCase()} **** {method.last4}
                              </span>
                              {method.isDefault && (
                                <Badge variant="outline" className="text-xs">기본</Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              만료: {method.expiryMonth.toString().padStart(2, '0')}/{method.expiryYear}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {!method.isDefault && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetDefaultCard(method.id)}
                              className="text-xs px-2 py-1"
                            >
                              기본 설정
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm('이 카드를 새 카드로 교체하시겠습니까?')) {
                                handleAddCard();
                              }
                            }}
                            className="text-blue-600 hover:text-blue-700 px-2"
                          >
                            변경
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveCard(method.id)}
                            className="text-red-600 hover:text-red-700 px-2"
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
            </div>
          </CardContent>
        </Card>

        {/* 쿠폰/이용권 */}
        <Card className="max-w-2xl">
          <CardContent className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">쿠폰/이용권</h3>
              <p className="text-sm text-gray-600 mt-1">쿠폰 또는 이용권을 쿠폰함에 등록하고 사용하세요</p>
            </div>
            <div className="space-y-4">
              {appliedCoupons.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900 text-sm">적용된 쿠폰</h4>
                  {appliedCoupons.map((coupon, index) => (
                    <div key={index} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Gift className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-900 text-sm">{coupon.code}</span>
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            {coupon.discountType === 'PERCENT' ? `${coupon.discount}% 할인` : `${coupon.discount.toLocaleString()}원 할인`}
                          </Badge>
                        </div>
                        <span className="text-xs text-green-600">
                          {new Date(coupon.expiresAt).toLocaleDateString('ko-KR')}까지
                        </span>
                      </div>
                      <p className="text-xs text-green-700 mt-1">{coupon.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {!showCouponForm ? (
                <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <p className="text-gray-600 mb-3 text-sm">쿠폰 또는 이용권을 쿠폰함에 등록하고 사용하세요.</p>
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
                <div className="border border-dashed border-gray-300 rounded-lg p-4 space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="쿠폰 코드를 입력하세요"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      disabled={applyingCoupon}
                      className="text-sm"
                    />
                    <Button 
                      onClick={handleApplyCoupon}
                      disabled={applyingCoupon || !couponCode.trim()}
                      size="sm"
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
                    className="w-full text-xs"
                  >
                    닫기
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // 결제 내역 컨텐츠 컴포넌트
  const BillingContent = () => {
    const { paymentHistory, loading: paymentLoading } = useOptimizedSettings();

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'completed':
          return <Shield className="h-4 w-4 text-green-600" />;
        case 'failed':
          return <Shield className="h-4 w-4 text-red-600" />;
        case 'pending':
          return <Shield className="h-4 w-4 text-yellow-600" />;
        default:
          return <Shield className="h-4 w-4 text-gray-600" />;
      }
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'completed':
          return 'text-green-600 bg-green-50 border-green-200';
        case 'failed':
          return 'text-red-600 bg-red-50 border-red-200';
        case 'pending':
          return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        default:
          return 'text-gray-600 bg-gray-50 border-gray-200';
      }
    };

    const getStatusLabel = (status: string) => {
      switch (status) {
        case 'completed':
          return '결제완료';
        case 'failed':
          return '결제실패';
        case 'pending':
          return '결제중';
        default:
          return '미확인';
      }
    };

    const formatAmount = (amount: number) => {
      return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW'
      }).format(amount);
    };

    if (paymentLoading) {
      return (
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">결제 내역</h1>
            <p className="text-gray-600">결제 히스토리를 확인하세요</p>
          </div>
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-600" />
            <p className="text-gray-600">결제 내역을 불러오는 중...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">결제 내역</h1>
          <p className="text-gray-600">결제 히스토리를 확인하세요</p>
        </div>

        {/* 결제 내역 리스트 */}
        <Card className="max-w-4xl">
          <CardContent className="p-6">
            <div className="space-y-4">
              {paymentHistory && paymentHistory.length > 0 ? (
                paymentHistory.map((payment: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center border border-purple-200">
                        <CreditCard className="h-6 w-6 text-purple-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{payment.description || 'GenToon 구독'}</h3>
                          <Badge className={`text-xs border ${getStatusColor(payment.status)}`}>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(payment.status)}
                              {getStatusLabel(payment.status)}
                            </div>
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{payment.plan} 플랜</p>
                        <p className="text-xs text-gray-500">
                          {new Date(payment.createdAt).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{formatAmount(payment.amount)}</p>
                      {payment.method && (
                        <p className="text-sm text-gray-600">{payment.method}</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm">결제 내역이 없습니다</p>
                  <p className="text-gray-400 text-xs mt-1">구독을 시작하면 결제 내역을 확인할 수 있습니다</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 결제 정보 안내 */}
        <Card className="max-w-4xl border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900">결제 정보 안내</h3>
                <ul className="text-sm text-blue-700 mt-2 space-y-1">
                  <li>• 모든 결제는 토스페이먼츠를 통해 안전하게 처리됩니다</li>
                  <li>• 결제 영수증은 이메일로 자동 발송됩니다</li>
                  <li>• 구독 취소는 다음 결제일 전까지 가능합니다</li>
                  <li>• 환불 관련 문의는 고객지원팀으로 연락해주세요</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // 내 계정 컨텐츠 컴포넌트
  const AccountContent = () => (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">내 계정</h1>
      </div>

      <div className="space-y-6">
        {/* 프로필 사진 */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">내 프로필</h3>
          <div className="flex items-center gap-6">
            <div 
              className="relative group"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="absolute inset-0 border-2 border-dashed border-purple-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-purple-50 bg-opacity-50 flex items-center justify-center">
                <Upload className="h-8 w-8 text-purple-500" />
              </div>
              <Avatar className="w-24 h-24 transition-transform group-hover:scale-105">
                <AvatarImage 
                  src={userData?.avatarUrl} 
                  alt={userData?.name || '사용자'}
                  className="object-cover"
                />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-2xl font-bold">
                  {userData?.name?.charAt(0) || userData?.email?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="absolute -bottom-2 -right-2 w-8 h-8 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 shadow-md hover:shadow-lg transition-all"
              >
                {avatarUploading ? (
                  <Loader2 className="h-4 w-4 text-gray-600 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4 text-gray-600" />
                )}
              </button>
            </div>
            <div className="space-y-3">
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="flex items-center gap-2 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors"
              >
                {avatarUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    업로드 중...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    사진 업로드
                  </>
                )}
              </Button>
              <div className="text-xs text-gray-500 space-y-1">
                {userData?.avatarUrl && (
                  <p>
                    {userData.avatarUrl.includes('googleusercontent.com') 
                      ? '🔗 Google 계정 프로필 사진' 
                      : '📷 사용자 지정 프로필 사진'}
                  </p>
                )}
                <p>드래그 앤 드롭으로도 업로드 가능</p>
                <p>최대 5MB, JPG/PNG 형식</p>
              </div>
            </div>
          </div>
          
          {/* 숨겨진 파일 입력 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleAvatarUpload(file);
              }
            }}
          />
        </div>

        {/* 개인정보 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">이름</label>
            <Input
              value={profileForm.name}
              onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
              className="max-w-md"
              placeholder="이름을 입력하세요"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
            <Input
              value={profileForm.email}
              className="max-w-md"
              disabled
            />
          </div>

          <Button 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleProfileUpdate}
            disabled={profileLoading}
          >
            {profileLoading ? '저장 중...' : '변경사항 저장'}
          </Button>
        </div>


        {/* 계정 삭제 */}
        <div className="pt-8 border-t border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-red-900 mb-2">계정 삭제</h3>
            <p className="text-sm text-gray-600 mb-4">
              계정 삭제시 내가 참여중인 워크스페이스의 내 드라이브와 히점 항목이 모두 삭제됩니다.
            </p>
            <Button 
              variant="outline" 
              className="text-red-600 border-red-300 hover:bg-red-50"
              onClick={handleDeleteAccount}
            >
              계정 삭제
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (selectedMenu) {
      case 'account':
        return <AccountContent />;
      case 'security':
        return (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">로그인 및 보안</h1>
            <p className="text-gray-600">로그인 및 보안 설정 페이지입니다.</p>
          </div>
        );
      case 'notifications':
        return (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">알림</h1>
            <p className="text-gray-600">알림 설정 페이지입니다.</p>
          </div>
        );
      case 'preferences':
        return (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">환경설정</h1>
            <p className="text-gray-600">환경설정 페이지입니다.</p>
          </div>
        );
      case 'workspace':
        return (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">워크스페이스 설정</h1>
            <p className="text-gray-600">워크스페이스 설정 페이지입니다.</p>
          </div>
        );
      case 'payment':
        return (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">결제수단 관리</h1>
            <div className="space-y-6">
              {/* PaymentMethodSettings 컴포넌트를 여기에 렌더링 */}
              <div className="bg-white rounded-lg border p-6">
                <p className="text-gray-600 mb-4">결제수단 관리 기능을 준비 중입니다.</p>
                <p className="text-sm text-gray-500">
                  자동 결제를 위한 카드 등록, 결제수단 변경, 결제 내역 조회 등의 기능이 제공됩니다.
                </p>
              </div>
            </div>
          </div>
        );
      case 'subscription':
        return <SubscriptionContent />;
      case 'billing':
        return <BillingContent />;
      default:
        return <AccountContent />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* 왼쪽 사이드바 */}
        <div className="w-80 bg-white border-r">
          <div className="p-6 space-y-6">
            {/* 사용자 프로필 헤더 */}
            <div className="flex items-center gap-4 pb-4 border-b">
              <Avatar className="w-16 h-16">
                <AvatarImage 
                  src={userData?.avatarUrl} 
                  alt={userData?.name || '사용자'}
                  className="object-cover"
                />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xl font-bold">
                  {userData?.name?.charAt(0) || userData?.email?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-gray-900">
                    {userData?.name || userData?.email?.split('@')[0] || '사용자'}
                  </h2>
                  {subscription?.plan && ['PRO', 'PREMIUM', 'ADMIN'].includes(subscription.plan) && (
                    <Crown className={`h-4 w-4 ${subscription.plan === 'ADMIN' ? 'text-emerald-600' : 'text-purple-600'}`} />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`text-xs border ${getPlanColor(subscription?.plan || 'FREE')}`}>
                    {subscription?.plan && ['PREMIUM', 'ADMIN'].includes(subscription.plan) && (
                      <Crown className="h-3 w-3 mr-1" />
                    )}
                    {getPlanName(subscription?.plan || 'FREE')}
                  </Badge>
                  <span className="text-gray-600 text-sm">인증완료</span>
                </div>
              </div>
              <button className="p-1 text-gray-400 hover:text-gray-600">
                <ChevronRight className="h-4 w-4 rotate-90" />
              </button>
            </div>

            {/* 계정 메뉴 섹션 */}
            <div className="space-y-1">
              <p className="text-sm text-gray-500 px-3 mb-2">계정</p>
              <div className="space-y-1">
                {accountMenus.map((menu) => {
                  const Icon = menu.icon;
                  const isSelected = selectedMenu === menu.id;
                  return (
                    <button
                      key={menu.id}
                      onClick={() => setSelectedMenu(menu.id)}
                      className={`w-full p-3 rounded-lg flex items-center gap-3 text-left transition-colors ${
                        isSelected
                          ? 'bg-purple-50 text-purple-900 border border-purple-200'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${isSelected ? 'text-purple-600' : 'text-gray-500'}`} />
                      <span className="flex-1">{menu.title}</span>
                      {isSelected && <ChevronRight className="h-4 w-4 text-purple-600" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 관리 메뉴 섹션 */}
            <div className="space-y-1">
              <p className="text-sm text-gray-500 px-3 mb-2">관리</p>
              <div className="space-y-1">
                {managementMenus.map((menu) => {
                  const Icon = menu.icon;
                  const isSelected = selectedMenu === menu.id;
                  return (
                    <button
                      key={menu.id}
                      onClick={() => setSelectedMenu(menu.id)}
                      className={`w-full p-3 rounded-lg flex items-center gap-3 text-left transition-colors ${
                        isSelected
                          ? 'bg-purple-50 text-purple-900 border border-purple-200'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${isSelected ? 'text-purple-600' : 'text-gray-500'}`} />
                      <span className="flex-1">{menu.title}</span>
                      {isSelected && <ChevronRight className="h-4 w-4 text-purple-600" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽 컨텐츠 영역 */}
        <div className="flex-1">
          <div className="p-8">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* 카드 등록 모달 */}
      <CardRegistrationModal
        open={showCardModal}
        onOpenChange={setShowCardModal}
        onSuccess={handleCardRegistrationSuccess}
      />
    </div>
  );
}