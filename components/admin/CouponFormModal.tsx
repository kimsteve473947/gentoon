'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';

interface CouponFormData {
  code: string;
  discount: number;
  discounttype: 'PERCENT' | 'FIXED';
  description: string;
  usagelimit: number;
  expiresat: string;
  isactive: boolean;
  first_payment_only: boolean;
  referral_tracking: boolean;
  referral_reward_tokens: number;
}

interface CouponFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  coupon?: any;
  isEdit?: boolean;
}

export default function CouponFormModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  coupon, 
  isEdit = false 
}: CouponFormModalProps) {
  const { showError, showSuccess } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CouponFormData>({
    code: coupon?.code || '',
    discount: coupon?.discount || 0,
    discounttype: coupon?.discounttype || 'PERCENT',
    description: coupon?.description || '',
    usagelimit: coupon?.usagelimit || 0,
    expiresat: coupon?.expiresat ? new Date(coupon.expiresat).toISOString().split('T')[0] : '',
    isactive: coupon?.isactive ?? true,
    first_payment_only: coupon?.first_payment_only ?? false,
    referral_tracking: coupon?.referral_tracking ?? false,
    referral_reward_tokens: coupon?.referral_reward_tokens ?? 0
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.code || !formData.discount || !formData.expiresat) {
      showError('필수 필드를 모두 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      
      const url = isEdit ? `/api/admin-473947/coupons/${coupon.id}` : '/api/admin-473947/coupons';
      const method = isEdit ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(data.message || `쿠폰이 ${isEdit ? '수정' : '생성'}되었습니다.`);
        onSuccess();
        onClose();
      } else {
        throw new Error(data.error || `쿠폰 ${isEdit ? '수정' : '생성'}에 실패했습니다`);
      }
    } catch (error) {
      console.error('쿠폰 처리 오류:', error);
      showError(error instanceof Error ? error.message : `쿠폰 ${isEdit ? '수정' : '생성'} 중 오류가 발생했습니다.`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof CouponFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? '쿠폰 수정' : '새 쿠폰 생성'}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? '쿠폰 정보를 수정하세요.' : '새로운 쿠폰을 생성하세요.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">쿠폰 코드*</Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
              placeholder="WELCOME20"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="discounttype">할인 타입*</Label>
              <Select 
                value={formData.discounttype} 
                onValueChange={(value) => handleInputChange('discounttype', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="할인 타입 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">퍼센트 (%)</SelectItem>
                  <SelectItem value="FIXED">고정 금액 (원)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="discount">할인값*</Label>
              <Input
                id="discount"
                type="number"
                value={formData.discount}
                onChange={(e) => handleInputChange('discount', parseInt(e.target.value) || 0)}
                placeholder={formData.discounttype === 'PERCENT' ? '20' : '5000'}
                required
                min="1"
                max={formData.discounttype === 'PERCENT' ? 100 : undefined}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">설명*</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="신규 가입 20% 할인"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiresat">만료일*</Label>
              <Input
                id="expiresat"
                type="date"
                value={formData.expiresat}
                onChange={(e) => handleInputChange('expiresat', e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="usagelimit">사용 제한</Label>
              <Input
                id="usagelimit"
                type="number"
                value={formData.usagelimit}
                onChange={(e) => handleInputChange('usagelimit', parseInt(e.target.value) || 0)}
                placeholder="0 (무제한)"
                min="0"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isactive"
                checked={formData.isactive}
                onChange={(e) => handleInputChange('isactive', e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="isactive">활성화</Label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="first_payment_only"
                checked={formData.first_payment_only}
                onChange={(e) => handleInputChange('first_payment_only', e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="first_payment_only">첫 결제 전용 쿠폰</Label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="referral_tracking"
                checked={formData.referral_tracking}
                onChange={(e) => handleInputChange('referral_tracking', e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="referral_tracking">추천인 추적 쿠폰</Label>
            </div>

            {formData.referral_tracking && (
              <div className="space-y-2">
                <Label htmlFor="referral_reward_tokens">추천인 보상 토큰</Label>
                <Input
                  id="referral_reward_tokens"
                  type="number"
                  value={formData.referral_reward_tokens}
                  onChange={(e) => handleInputChange('referral_reward_tokens', parseInt(e.target.value) || 0)}
                  placeholder="50"
                  min="0"
                />
                <p className="text-sm text-gray-500">
                  쿠폰 사용 시 추천인에게 지급할 토큰 수 (0이면 지급 안함)
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '처리 중...' : (isEdit ? '수정' : '생성')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}