'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { Loader2, Users, Calendar, DollarSign, Percent } from 'lucide-react';

interface CouponUsage {
  id: string;
  userid: string;
  appliedat: string;
  isused: boolean;
  user?: {
    email: string;
    name?: string;
  };
}

interface CouponDetail {
  id: string;
  code: string;
  discount: number;
  discounttype: 'PERCENT' | 'FIXED';
  description: string;
  usagelimit: number;
  isactive: boolean;
  expiresat: string;
  createdat: string;
  usageCount: number;
  remainingUses: number;
  status: string;
  isExpired: boolean;
  usageHistory: CouponUsage[];
}

interface CouponDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  couponId: string | null;
}

export default function CouponDetailModal({ 
  isOpen, 
  onClose, 
  couponId 
}: CouponDetailModalProps) {
  const { showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [coupon, setCoupon] = useState<CouponDetail | null>(null);
  const [usageDetails, setUsageDetails] = useState<CouponUsage[]>([]);

  const fetchCouponDetail = async () => {
    if (!couponId) return;

    try {
      setLoading(true);
      
      const response = await fetch(`/api/admin-473947/coupons/${couponId}`);
      const data = await response.json();

      if (data.success) {
        setCoupon(data.coupon);
        setUsageDetails(data.coupon.usageHistory || []);
      } else {
        throw new Error(data.error || '쿠폰 상세 정보를 불러올 수 없습니다');
      }
    } catch (error) {
      console.error('쿠폰 상세 조회 오류:', error);
      showError('쿠폰 상세 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageDetails = async () => {
    if (!couponId) return;

    try {
      const response = await fetch(`/api/admin-473947/coupons/${couponId}/usage`);
      const data = await response.json();

      if (data.success) {
        setUsageDetails(data.usage);
      }
    } catch (error) {
      console.error('쿠폰 사용 내역 조회 오류:', error);
    }
  };

  useEffect(() => {
    if (isOpen && couponId) {
      fetchCouponDetail();
      fetchUsageDetails();
    }
  }, [isOpen, couponId]);

  const formatDiscount = (discount: number, type: string) => {
    return type === 'PERCENT' ? `${discount}%` : `₩${discount.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      inactive: 'secondary',
      expired: 'destructive',
      depleted: 'outline'
    };

    const labels = {
      active: '활성',
      inactive: '비활성',
      expired: '만료',
      depleted: '소진'
    };

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            쿠폰 상세 정보
            {coupon && <StatusBadge status={coupon.status} />}
          </DialogTitle>
          <DialogDescription>
            쿠폰의 상세 정보와 사용 내역을 확인하세요.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">로딩 중...</span>
          </div>
        ) : coupon ? (
          <div className="space-y-6">
            {/* 쿠폰 기본 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-2">기본 정보</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">쿠폰 코드:</span>
                      <span className="font-mono font-bold">{coupon.code}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">할인:</span>
                      <div className="flex items-center gap-1">
                        {coupon.discounttype === 'PERCENT' ? (
                          <Percent className="h-4 w-4 text-green-600" />
                        ) : (
                          <DollarSign className="h-4 w-4 text-blue-600" />
                        )}
                        <span>{formatDiscount(coupon.discount, coupon.discounttype)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">설명:</span>
                      <span>{coupon.description}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">상태:</span>
                      <StatusBadge status={coupon.status} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-2">사용 현황</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">사용량:</span>
                      <span>{coupon.usageCount} / {coupon.usagelimit > 0 ? coupon.usagelimit : '∞'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">남은 사용량:</span>
                      <span>{coupon.remainingUses > 0 ? coupon.remainingUses : (coupon.usagelimit > 0 ? 0 : '∞')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">생성일:</span>
                      <span>{formatDate(coupon.createdat)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">만료일:</span>
                      <span className={coupon.isExpired ? 'text-red-600' : ''}>
                        {formatDate(coupon.expiresat)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 사용 내역 */}
            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" />
                사용 내역 ({usageDetails.length}건)
              </h3>
              
              {usageDetails.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>사용자 ID</TableHead>
                        <TableHead>이메일</TableHead>
                        <TableHead>이름</TableHead>
                        <TableHead>적용일</TableHead>
                        <TableHead>상태</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usageDetails.map((usage) => (
                        <TableRow key={usage.id}>
                          <TableCell className="font-mono text-sm">{usage.userid}</TableCell>
                          <TableCell>{usage.user?.email || '-'}</TableCell>
                          <TableCell>{usage.user?.name || '-'}</TableCell>
                          <TableCell>{formatDate(usage.appliedat)}</TableCell>
                          <TableCell>
                            <Badge variant={usage.isused ? 'default' : 'secondary'}>
                              {usage.isused ? '사용됨' : '적용됨'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 border rounded-lg">
                  아직 사용 내역이 없습니다.
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={onClose}>닫기</Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            쿠폰 정보를 불러올 수 없습니다.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}