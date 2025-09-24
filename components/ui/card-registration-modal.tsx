'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { X, CreditCard, Loader2 } from 'lucide-react';

interface CardRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CardRegistrationModal({ open, onOpenChange, onSuccess }: CardRegistrationModalProps) {
  const [cardData, setCardData] = useState({
    cardNumber: '',
    expiryDate: '',
    birth: ''
  });
  
  const [agreements, setAgreements] = useState({
    allAgree: false,
    terms: false,
    privacy: false,
    cardPolicy: false
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + (v.length > 2 ? '/' + v.substring(2, 4) : '');
    }
    return v;
  };

  const handleCardDataChange = (field: string, value: string) => {
    let formattedValue = value;
    
    if (field === 'cardNumber') {
      formattedValue = formatCardNumber(value);
      if (formattedValue.replace(/\s/g, '').length > 16) return;
    } else if (field === 'expiryDate') {
      formattedValue = formatExpiryDate(value);
      if (formattedValue.replace('/', '').length > 4) return;
    } else if (field === 'birth') {
      formattedValue = value.replace(/[^0-9]/g, '');
      if (formattedValue.length > 10) return;
    }
    
    setCardData(prev => ({ ...prev, [field]: formattedValue }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleAllAgreeChange = (checked: boolean) => {
    setAgreements({
      allAgree: checked,
      terms: checked,
      privacy: checked,
      cardPolicy: checked
    });
  };

  const handleIndividualAgreeChange = (field: string, checked: boolean) => {
    const newAgreements = { ...agreements, [field]: checked };
    newAgreements.allAgree = newAgreements.terms && newAgreements.privacy && newAgreements.cardPolicy;
    setAgreements(newAgreements);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!cardData.cardNumber || cardData.cardNumber.replace(/\s/g, '').length < 16) {
      newErrors.cardNumber = '카드번호를 정확히 입력해주세요';
    }
    
    if (!cardData.expiryDate || cardData.expiryDate.length < 5) {
      newErrors.expiryDate = '유효기간을 정확히 입력해주세요';
    }
    
    
    if (!cardData.birth || cardData.birth.length < 6) {
      newErrors.birth = '생년월일 6자리 또는 사업자번호 10자리를 입력해주세요';
    }
    
    if (!agreements.terms) {
      newErrors.terms = '이용약관에 동의해주세요';
    }
    
    if (!agreements.privacy) {
      newErrors.privacy = '개인정보처리방침에 동의해주세요';
    }
    
    if (!agreements.cardPolicy) {
      newErrors.cardPolicy = '결제대행 서비스 이용약관에 동의해주세요';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      // 실제로는 토스페이먼츠 API를 호출하여 빌링키를 발급받아야 합니다
      const response = await fetch('/api/payment-methods/register-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardNumber: cardData.cardNumber.replace(/\s/g, ''),
          expiryMonth: cardData.expiryDate.split('/')[0],
          expiryYear: '20' + cardData.expiryDate.split('/')[1],
          birth: cardData.birth
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        onSuccess();
        onOpenChange(false);
        // 폼 초기화
        setCardData({ cardNumber: '', expiryDate: '', birth: '' });
        setAgreements({ allAgree: false, terms: false, privacy: false, cardPolicy: false });
      } else {
        alert('카드 등록 실패: ' + result.error);
      }
    } catch (error) {
      console.error('카드 등록 오류:', error);
      alert('카드 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            카드 등록
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* 카드번호 */}
          <div className="space-y-2">
            <Label htmlFor="cardNumber" className="text-sm font-medium">카드번호</Label>
            <Input
              id="cardNumber"
              placeholder="0000 0000 0000 0000"
              value={cardData.cardNumber}
              onChange={(e) => handleCardDataChange('cardNumber', e.target.value)}
              className={errors.cardNumber ? 'border-red-500' : ''}
            />
            {errors.cardNumber && (
              <p className="text-xs text-red-500">{errors.cardNumber}</p>
            )}
          </div>
          
          {/* 유효기간 */}
          <div className="space-y-2">
            <Label htmlFor="expiryDate" className="text-sm font-medium">유효기간</Label>
            <Input
              id="expiryDate"
              placeholder="MM/YY"
              value={cardData.expiryDate}
              onChange={(e) => handleCardDataChange('expiryDate', e.target.value)}
              className={errors.expiryDate ? 'border-red-500' : ''}
            />
            {errors.expiryDate && (
              <p className="text-xs text-red-500">{errors.expiryDate}</p>
            )}
          </div>
          
          {/* 생년월일/사업자번호 */}
          <div className="space-y-2">
            <Label htmlFor="birth" className="text-sm font-medium">생년월일 6자리 (또는 사업자번호 10자리)</Label>
            <Input
              id="birth"
              placeholder="숫자만 입력"
              value={cardData.birth}
              onChange={(e) => handleCardDataChange('birth', e.target.value)}
              className={errors.birth ? 'border-red-500' : ''}
            />
            {errors.birth && (
              <p className="text-xs text-red-500">{errors.birth}</p>
            )}
          </div>
          
          {/* 동의사항 */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allAgree"
                checked={agreements.allAgree}
                onCheckedChange={handleAllAgreeChange}
              />
              <Label htmlFor="allAgree" className="text-sm font-medium">
                아래 내용에 모두 동의합니다. <span className="text-red-500">(필수)</span>
              </Label>
            </div>
            
            <div className="pl-6 space-y-2 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="terms"
                    checked={agreements.terms}
                    onCheckedChange={(checked) => handleIndividualAgreeChange('terms', checked)}
                  />
                  <Label htmlFor="terms">GenToon</Label>
                </div>
                <div className="flex gap-2">
                  <a href="/terms" target="_blank" className="text-blue-500 hover:underline">
                    이용약관
                  </a>
                  <span>및</span>
                  <a href="/privacy" target="_blank" className="text-blue-500 hover:underline">
                    개인정보 취급방침
                  </a>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="cardPolicy"
                    checked={agreements.cardPolicy}
                    onCheckedChange={(checked) => handleIndividualAgreeChange('cardPolicy', checked)}
                  />
                  <Label htmlFor="cardPolicy">결제 대행 서비스</Label>
                </div>
                <a href="/payment-terms" target="_blank" className="text-blue-500 hover:underline">
                  이용약관
                </a>
              </div>
            </div>
            
            {(errors.terms || errors.privacy || errors.cardPolicy) && (
              <p className="text-xs text-red-500 pl-6">* 필수 동의사항입니다.</p>
            )}
          </div>
          
          {/* 등록 버튼 */}
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-gray-800 hover:bg-gray-900"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                등록 중...
              </>
            ) : (
              '결제 수단 등록'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}