'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Crown,
  Calendar,
  DollarSign,
  CreditCard,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import Link from 'next/link';

interface SubscriptionSettingsProps {
  subscription: any;
  paymentHistory: any[];
  onUpdate: () => void;
  onCancelSubscription?: () => Promise<{ success: boolean; message?: string; error?: string }>;
  loading?: boolean;
}

export function SubscriptionSettings({ 
  subscription, 
  paymentHistory, 
  onUpdate, 
  onCancelSubscription,
  loading = false 
}: SubscriptionSettingsProps) {
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const getPlanDetails = (plan: string) => {
    switch (plan) {
      case 'PRO':
        return {
          name: 'Pro',
          price: '₩30,000',
          color: 'bg-purple-100 text-purple-800',
          features: ['인스타툰 30편 생성', 'AI 대본 생성 (대용량)', '캐릭터 7개 등록']
        };
      case 'PREMIUM':
        return {
          name: 'Premium',
          price: '₩100,000',
          color: 'bg-amber-100 text-amber-800',
          features: ['인스타툰 120편~160편 생성', 'AI 대본 생성 (초대용량)', '캐릭터 15개 등록']
        };
      default:
        return {
          name: 'Free',
          price: '₩0',
          color: 'bg-gray-100 text-gray-800',
          features: ['무료체험용', 'AI 대본 생성 Demo', '캐릭터 2개 등록']
        };
    }
  };

  const handleCancelSubscription = async () => {
    if (!onCancelSubscription) return;
    
    setCancelLoading(true);
    try {
      const result = await onCancelSubscription();
      
      if (result.success) {
        alert(result.message || '구독이 해지되었습니다.');
        onUpdate();
        setShowCancelConfirm(false);
      } else {
        alert(result.error || '구독 해지 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Cancel subscription error:', error);
      alert('구독 해지 중 오류가 발생했습니다.');
    } finally {
      setCancelLoading(false);
    }
  };

  const planDetails = getPlanDetails(subscription?.plan || 'FREE');
  const nextBillingDate = subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
  const isFreePlan = subscription?.plan === 'FREE' || !subscription?.plan;

  return (
    <div className="space-y-6">
      {/* 현재 구독 정보 */}
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Crown className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">구독 관리</h2>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Crown className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-semibold text-gray-900">{planDetails.name} 플랜</h3>
                  <Badge className={`${planDetails.color} px-2 py-1 text-xs font-medium`}>
                    {planDetails.name}
                  </Badge>
                  {subscription?.cancelAtPeriodEnd && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">
                      해지 예정
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-sm">
                  {planDetails.features.join(' • ')}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">
                {planDetails.price}
              </p>
              <p className="text-sm text-gray-500">
                {isFreePlan ? '영구 무료' : '월 요금'}
              </p>
            </div>
          </div>
        </div>

        {/* 다음 결제일 */}
        {!isFreePlan && nextBillingDate && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mt-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">
                  {subscription?.cancelAtPeriodEnd ? '구독 종료일' : '다음 결제일'}
                </p>
                <p className="text-sm text-gray-600">
                  {nextBillingDate.toLocaleDateString('ko-KR')} ({
                    formatDistanceToNow(nextBillingDate, { addSuffix: true, locale: ko })
                  })
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 토큰 사용량 */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-gray-900">이번 달 토큰 사용량</span>
            <span className="text-sm text-gray-600">
              {(subscription?.tokensUsed || 0).toLocaleString()} / {(subscription?.tokensTotal || 0).toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${Math.min(((subscription?.tokensUsed || 0) / (subscription?.tokensTotal || 1)) * 100, 100)}%` 
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>사용됨: {((subscription?.tokensUsed || 0) / (subscription?.tokensTotal || 1) * 100).toFixed(1)}%</span>
            <span>남은 토큰: {((subscription?.tokensTotal || 0) - (subscription?.tokensUsed || 0)).toLocaleString()}개</span>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-3 mt-6">
          {isFreePlan ? (
            <Link href="/pricing" className="flex-1">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium">
                <Crown className="h-4 w-4 mr-2" />
                플랜 업그레이드
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/pricing" className="flex-1">
                <Button variant="outline" className="w-full border-gray-300 hover:bg-gray-50">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  플랜 변경
                </Button>
              </Link>
              {!subscription?.cancelAtPeriodEnd && (
                <Button 
                  variant="outline" 
                  className="px-4 border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => setShowCancelConfirm(true)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  구독 해지
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 결제 내역 */}
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <CreditCard className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">결제 내역</h2>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg">
          {paymentHistory.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {paymentHistory.map((payment) => (
                <div key={payment.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        payment.status === 'COMPLETED' ? 'bg-green-500' :
                        payment.status === 'FAILED' ? 'bg-red-500' : 'bg-yellow-500'
                      }`} />
                      <div>
                        <p className="font-medium text-gray-900">{payment.description}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(payment.createdAt).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {payment.amount > 0 ? `₩${payment.amount.toLocaleString()}` : '무료'}
                      </p>
                      <p className={`text-xs ${
                        payment.status === 'COMPLETED' ? 'text-green-600' :
                        payment.status === 'FAILED' ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        {payment.status === 'COMPLETED' ? '결제 완료' :
                         payment.status === 'FAILED' ? '결제 실패' : '처리 중'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">결제 내역이 없습니다</p>
              <p className="text-gray-400 text-sm mt-1">첫 구독을 시작하면 여기에 표시됩니다</p>
            </div>
          )}
        </div>
      </div>

      {/* 구독 해지 확인 모달 */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-full max-w-md mx-4 bg-white rounded-lg shadow-lg">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">구독 해지 확인</h3>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-800 text-sm">
                  구독을 해지하면 현재 결제 기간 종료 후 무료 플랜으로 전환됩니다.
                </p>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-gray-900 mb-2">해지 시 제한사항</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• 토큰 한도가 크게 줄어듭니다</li>
                  <li>• 캐릭터 등록 개수가 제한됩니다</li>
                  <li>• 고급 기능 사용이 제한됩니다</li>
                </ul>
              </div>
              
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={cancelLoading}
                >
                  취소
                </Button>
                <Button 
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleCancelSubscription}
                  disabled={cancelLoading}
                >
                  {cancelLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      처리 중...
                    </>
                  ) : (
                    '해지하기'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}