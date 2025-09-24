'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Crown,
  Zap,
  Star,
  ArrowRight,
  Users,
  Check,
  X,
  Sparkles
} from "lucide-react";
import { useRouter } from 'next/navigation';

interface CharacterLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: 'FREE' | 'PRO' | 'PREMIUM';
  currentCount: number;
  maxCount: number;
}

const PLAN_CONFIG = {
  FREE: {
    name: '무료',
    price: '₩0',
    characters: 2,
    images: 8,
    icon: Star,
    color: 'from-gray-500 to-gray-600',
    textColor: 'text-gray-600',
    badgeColor: 'bg-gray-100 text-gray-700'
  },
  PRO: {
    name: '프로',
    price: '₩30,000',
    characters: 7,
    images: 310,
    icon: Zap,
    color: 'from-purple-500 to-purple-600',
    textColor: 'text-purple-600',
    badgeColor: 'bg-purple-100 text-purple-700',
    popular: true
  },
  PREMIUM: {
    name: '프리미엄',
    price: '₩100,000',
    characters: 15,
    images: 1163,
    icon: Crown,
    color: 'from-amber-500 to-orange-500',
    textColor: 'text-amber-600',
    badgeColor: 'bg-amber-100 text-amber-700'
  }
} as const;

export function CharacterLimitModal({ 
  open, 
  onOpenChange, 
  currentPlan, 
  currentCount, 
  maxCount 
}: CharacterLimitModalProps) {
  const router = useRouter();
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (open) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 600);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleUpgrade = () => {
    router.push('/pricing');
    onOpenChange(false);
  };

  const currentPlanConfig = PLAN_CONFIG[currentPlan];
  const Icon = currentPlanConfig.icon;

  const plans = Object.entries(PLAN_CONFIG).map(([key, config]) => ({
    key: key as keyof typeof PLAN_CONFIG,
    ...config
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        {/* 헤더 영역 */}
        <div className={`bg-gradient-to-r ${currentPlanConfig.color} p-6 text-white relative overflow-hidden`}>
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-full bg-white/20 ${isAnimating ? 'animate-pulse' : ''}`}>
                  <Users className="h-6 w-6" />
                </div>
                <DialogTitle className="text-xl font-bold text-white">
                  캐릭터 생성 한도 초과
                </DialogTitle>
              </div>
              <DialogDescription className="text-white/90 text-base">
                현재 <span className="font-semibold">{currentPlanConfig.name}</span> 플랜에서 
                <span className="font-semibold"> {maxCount}개</span>의 캐릭터를 모두 사용하셨습니다
              </DialogDescription>
            </DialogHeader>
          </div>
          
          {/* 배경 장식 */}
          <div className="absolute -right-8 -top-8 opacity-10">
            <Sparkles className="h-24 w-24" />
          </div>
        </div>

        {/* 현재 상태 */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gradient-to-r ${currentPlanConfig.color}`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{currentPlanConfig.name} 플랜</p>
                <p className="text-sm text-gray-500">
                  캐릭터 {currentCount}/{maxCount}개 사용 중
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r ${currentPlanConfig.color} transition-all duration-500`}
                  style={{ width: `${Math.min((currentCount / maxCount) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">가득참</p>
            </div>
          </div>
        </div>

        {/* 플랜 비교 */}
        <div className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-purple-500" />
            더 많은 캐릭터가 필요하신가요?
          </h3>
          
          <div className="space-y-3">
            {plans.map((plan) => {
              const PlanIcon = plan.icon;
              const isCurrent = plan.key === currentPlan;
              const isUpgrade = plan.characters > maxCount;
              
              return (
                <div 
                  key={plan.key}
                  className={`
                    relative p-4 rounded-xl border-2 transition-all duration-200
                    ${isCurrent 
                      ? 'border-gray-300 bg-gray-50' 
                      : isUpgrade 
                        ? 'border-purple-200 bg-purple-50 hover:border-purple-300 hover:shadow-md cursor-pointer' 
                        : 'border-gray-100 bg-gray-25'
                    }
                  `}
                  onClick={isUpgrade ? handleUpgrade : undefined}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-2 left-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                      인기
                    </Badge>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-gradient-to-r ${plan.color}`}>
                        <PlanIcon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{plan.name}</p>
                          {isCurrent && (
                            <Badge className={plan.badgeColor}>현재 플랜</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          캐릭터 {plan.characters}개 • 이미지 {plan.images}장/월
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-bold text-lg text-gray-900">{plan.price}</p>
                      <p className="text-xs text-gray-500">
                        {plan.price === '₩0' ? '영구무료' : '월 요금'}
                      </p>
                    </div>
                  </div>
                  
                  {isUpgrade && (
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl pointer-events-none" />
                  )}
                </div>
              );
            })}
          </div>

          {/* 혜택 안내 */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-3">
              <div className="p-1 rounded-full bg-blue-100">
                <Check className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-blue-900">업그레이드 혜택</p>
                <ul className="text-sm text-blue-700 mt-1 space-y-1">
                  <li>• 더 많은 캐릭터 생성 및 관리</li>
                  <li>• 월간 이미지 생성 한도 대폭 증가</li>
                  <li>• 우선 고객 지원</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <DialogFooter className="p-6 bg-gray-50 gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            나중에
          </Button>
          <Button
            onClick={handleUpgrade}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0"
          >
            <Crown className="h-4 w-4 mr-2" />
            업그레이드
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}