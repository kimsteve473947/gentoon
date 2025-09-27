'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle, CreditCard, DollarSign, Calculator, Info, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
// import { 
//   RefundCategory, 
//   RefundPolicyType, 
//   RefundCalculator, 
//   RefundUtils 
// } from '@/lib/payments/toss-refund';

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    name: string;
    email: string;
    subscription?: {
      id: string;
      plan: string;
      currentPeriodStart: string;
      currentPeriodEnd: string;
    };
    latestTransaction?: {
      id: string;
      amount: number;
      createdAt: string;
      tossPaymentKey?: string;
    };
  };
  onRefundSuccess: () => void;
}

export default function RefundModal({ 
  isOpen, 
  onClose, 
  user, 
  onRefundSuccess 
}: RefundModalProps) {
  const [refundType, setRefundType] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [partialAmount, setPartialAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const latestTransaction = user.latestTransaction;
  const canRefund = latestTransaction && latestTransaction.amount > 0;
  const maxRefundAmount = latestTransaction?.amount || 0;
  const paymentDate = latestTransaction ? new Date(latestTransaction.createdAt) : null;
  const daysSincePayment = paymentDate ? 
    Math.floor((Date.now() - paymentDate.getTime()) / (1000 * 60 * 60 * 24)) : 999;

  const handleRefund = async () => {
    if (!canRefund || !latestTransaction) {
      setError('환불할 수 있는 결제 내역이 없습니다.');
      return;
    }

    if (!reason.trim() || reason.trim().length < 5) {
      setError('환불 사유를 5자 이상 입력해주세요.');
      return;
    }

    if (refundType === 'PARTIAL') {
      const amount = parseInt(partialAmount);
      if (isNaN(amount) || amount <= 0 || amount > maxRefundAmount) {
        setError(`환불 금액은 1원 이상 ${maxRefundAmount.toLocaleString()}원 이하여야 합니다.`);
        return;
      }
    }

    setIsProcessing(true);
    setError('');

    try {
      console.log('🔄 환불 요청 시작:', {
        userId: user.id,
        refundType,
        amount: refundType === 'PARTIAL' ? parseInt(partialAmount) : undefined,
        reason
      });

      const response = await fetch('/api/admin-473947/refunds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          transactionId: latestTransaction.id,
          refundAmount: refundType === 'PARTIAL' ? parseInt(partialAmount) : maxRefundAmount,
          refundType: refundType,
          reason: reason.trim(),
          adminNote: `관리자 환불 처리 - ${refundType === 'FULL' ? '전액' : '부분'} 환불`
        }),
      });

      const data = await response.json();
      console.log('📦 환불 API 응답:', data);

      if (!response.ok) {
        throw new Error(data.error || '환불 처리에 실패했습니다.');
      }

      alert(`환불이 성공적으로 처리되었습니다.\n환불 번호: ${data.refund.refundNo}\n환불 금액: ${data.refund.refundAmount.toLocaleString()}원`);
      
      onRefundSuccess();
      onClose();

    } catch (error) {
      console.error('💥 환불 처리 오류:', error);
      setError(error instanceof Error ? error.message : '환불 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">환불 처리</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {/* 사용자 정보 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">사용자 정보</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">이름:</span>
                  <span className="ml-2">{user.name}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">이메일:</span>
                  <span className="ml-2">{user.email}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">구독 플랜:</span>
                  <span className="ml-2">{user.subscription?.plan || 'FREE'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">구독 ID:</span>
                  <span className="ml-2 text-xs font-mono">{user.subscription?.id || 'N/A'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 결제 정보 */}
          {latestTransaction ? (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  최근 결제 정보
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">결제 금액:</span>
                    <span className="ml-2 font-semibold text-blue-600">
                      {latestTransaction.amount.toLocaleString()}원
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">결제일:</span>
                    <span className="ml-2">
                      {new Date(latestTransaction.createdAt).toLocaleDateString('ko-KR')}
                      ({daysSincePayment}일 전)
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium text-gray-700">거래 ID:</span>
                    <span className="ml-2 text-xs font-mono">{latestTransaction.id}</span>
                  </div>
                </div>

                {/* 환불 가능 여부 알림 */}
                {daysSincePayment > 30 ? (
                  <Alert className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      결제일로부터 30일이 초과되어 환불이 제한될 수 있습니다.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="mt-4 border-green-200 bg-green-50">
                    <AlertDescription className="text-green-800">
                      환불 가능 기간 내입니다. (30일 기준 {30 - daysSincePayment}일 남음)
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ) : (
            <Alert className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                환불할 수 있는 결제 내역이 없습니다.
              </AlertDescription>
            </Alert>
          )}

          {/* 환불 설정 */}
          {canRefund && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  환불 설정
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 환불 유형 선택 */}
                <div>
                  <Label htmlFor="refundType">환불 유형</Label>
                  <Select
                    value={refundType}
                    onValueChange={(value: 'FULL' | 'PARTIAL') => setRefundType(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL">
                        전액 환불 ({maxRefundAmount.toLocaleString()}원)
                      </SelectItem>
                      <SelectItem value="PARTIAL">부분 환불</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 부분 환불 금액 입력 */}
                {refundType === 'PARTIAL' && (
                  <div>
                    <Label htmlFor="partialAmount">환불 금액 (원)</Label>
                    <Input
                      id="partialAmount"
                      type="number"
                      min="1"
                      max={maxRefundAmount}
                      value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)}
                      placeholder={`1 ~ ${maxRefundAmount.toLocaleString()}`}
                    />
                  </div>
                )}

                {/* 환불 사유 */}
                <div>
                  <Label htmlFor="reason">환불 사유 *</Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="환불 사유를 상세히 입력해주세요 (최소 5자)"
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    현재 {reason.length}자 (최소 5자 필요)
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 오류 메시지 */}
          {error && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isProcessing}
            >
              취소
            </Button>
            {canRefund && (
              <Button
                onClick={handleRefund}
                disabled={isProcessing || !reason.trim() || reason.trim().length < 5}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    환불 처리 중...
                  </>
                ) : (
                  `환불 처리 (${refundType === 'FULL' ? maxRefundAmount.toLocaleString() : partialAmount || '0'}원)`
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}