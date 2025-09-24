'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, RefreshCw, MoreHorizontal, Edit, Trash2, Eye, EyeOff, DollarSign, Percent, Users, Calendar } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import CouponFormModal from '@/components/admin/CouponFormModal';
import CouponDetailModal from '@/components/admin/CouponDetailModal';

interface Coupon {
  id: string;
  code: string;
  discount: number;
  discounttype: 'PERCENT' | 'FIXED';
  description: string;
  usagelimit: number;
  isactive: boolean;
  expiresat: string;
  createdat: string;
  updatedat: string;
  createdby: string | null;
  usageCount: number;
  remainingUses: number;
  status: 'active' | 'inactive' | 'expired' | 'depleted';
  isExpired: boolean;
  first_payment_only: boolean;
  referral_tracking: boolean;
  referral_reward_tokens: number;
}

interface CouponListResponse {
  success: boolean;
  coupons: Coupon[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [discountTypeFilter, setDiscountTypeFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState('createdat');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);

  const { showError, showSuccess } = useToast();

  // 쿠폰 목록 조회
  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search: searchTerm,
        status: statusFilter,
        discountType: discountTypeFilter,
        sortBy,
        sortOrder
      });

      const response = await fetch(`/api/admin/coupons?${queryParams}`);
      const data: CouponListResponse = await response.json();

      if (data.success) {
        setCoupons(data.coupons);
        setTotalPages(data.pagination.totalPages);
      } else {
        throw new Error(data.error || '쿠폰 목록을 불러올 수 없습니다');
      }
    } catch (error) {
      console.error('쿠폰 목록 조회 오류:', error);
      showError('쿠폰 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, [page, searchTerm, statusFilter, discountTypeFilter, sortBy, sortOrder]);

  // 검색 핸들러
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  // 필터 변경 핸들러
  const handleFilterChange = (type: string, value: string) => {
    if (type === 'status') {
      setStatusFilter(value);
    } else if (type === 'discountType') {
      setDiscountTypeFilter(value);
    }
    setPage(1);
  };

  // 정렬 핸들러
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // 쿠폰 삭제
  const deleteCoupon = async (coupon: Coupon) => {
    const confirmMessage = `쿠폰 '${coupon.code}'를 삭제하시겠습니까?${
      coupon.usageCount > 0 
        ? '\n\n※ 사용 내역이 있어 비활성화만 됩니다.' 
        : '\n\n※ 완전히 삭제됩니다.'
    }`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(data.message);
        fetchCoupons();
      } else {
        throw new Error(data.error || '쿠폰 삭제에 실패했습니다');
      }
    } catch (error) {
      console.error('쿠폰 삭제 오류:', error);
      showError(error instanceof Error ? error.message : '쿠폰 삭제 중 오류가 발생했습니다.');
    }
  };

  // 쿠폰 상태 토글
  const toggleCouponStatus = async (coupon: Coupon) => {
    try {
      const response = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          isactive: !coupon.isactive
        })
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(`쿠폰이 ${coupon.isactive ? '비활성화' : '활성화'}되었습니다.`);
        fetchCoupons();
      } else {
        throw new Error(data.error || '쿠폰 상태 변경에 실패했습니다');
      }
    } catch (error) {
      console.error('쿠폰 상태 변경 오류:', error);
      showError('쿠폰 상태 변경 중 오류가 발생했습니다.');
    }
  };

  // 상태 배지 컴포넌트
  const StatusBadge = ({ status }: { status: string }) => {
    const variants = {
      active: 'default' as const,
      inactive: 'secondary' as const,
      expired: 'destructive' as const,
      depleted: 'outline' as const
    };

    const labels = {
      active: '활성',
      inactive: '비활성',
      expired: '만료',
      depleted: '소진'
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  // 할인 정보 표시
  const formatDiscount = (discount: number, type: string) => {
    return type === 'PERCENT' ? `${discount}%` : `₩${discount.toLocaleString()}`;
  };

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">쿠폰 관리</h1>
          <p className="text-gray-600">쿠폰 생성, 수정, 삭제 및 사용 현황을 관리하세요.</p>
        </div>

        {/* 액션 버튼 */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="쿠폰 코드 또는 설명 검색..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 w-80"
              />
            </div>
            <Button onClick={fetchCoupons} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              새로고침
            </Button>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              쿠폰 생성
            </Button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">전체 쿠폰</p>
                  <p className="text-2xl font-bold text-gray-900">{coupons.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-50 rounded-lg">
                  <Eye className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">활성 쿠폰</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {coupons.filter(c => c.isactive).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">총 사용량</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {coupons.reduce((sum, c) => sum + c.usageCount, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-red-50 rounded-lg">
                  <Calendar className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">만료된 쿠폰</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {coupons.filter(c => new Date(c.expiresat) < new Date()).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 필터 섹션 */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <Select value={statusFilter || "all"} onValueChange={(value) => handleFilterChange('status', value === 'all' ? '' : value)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="상태 필터" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 상태</SelectItem>
                  <SelectItem value="active">활성</SelectItem>
                  <SelectItem value="inactive">비활성</SelectItem>
                  <SelectItem value="expired">만료</SelectItem>
                  <SelectItem value="depleted">소진</SelectItem>
                </SelectContent>
              </Select>

              <Select value={discountTypeFilter || "all"} onValueChange={(value) => handleFilterChange('discountType', value === 'all' ? '' : value)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="할인 타입" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 타입</SelectItem>
                  <SelectItem value="PERCENT">퍼센트</SelectItem>
                  <SelectItem value="FIXED">고정 금액</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="text-sm text-gray-500">
                총 {coupons.length}개 쿠폰
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 쿠폰 목록 */}
        <Card>
          <CardHeader>
            <CardTitle>쿠폰 목록</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('code')}
                  >
                    쿠폰 코드
                    {sortBy === 'code' && (
                      <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </TableHead>
                  <TableHead>할인</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead>설명</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('usageCount')}
                  >
                    사용량
                    {sortBy === 'usageCount' && (
                      <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('expiresat')}
                  >
                    만료일
                    {sortBy === 'expiresat' && (
                      <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      로딩 중...
                    </TableCell>
                  </TableRow>
                ) : coupons.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell className="font-mono font-semibold">
                      {coupon.code}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {coupon.discounttype === 'PERCENT' ? (
                          <Percent className="h-4 w-4 text-green-600" />
                        ) : (
                          <DollarSign className="h-4 w-4 text-blue-600" />
                        )}
                        <span>
                          {formatDiscount(coupon.discount, coupon.discounttype)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {coupon.first_payment_only && (
                          <Badge variant="outline" className="text-xs">
                            첫 결제
                          </Badge>
                        )}
                        {coupon.referral_tracking && (
                          <Badge variant="secondary" className="text-xs">
                            추천 {coupon.referral_reward_tokens}🪙
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{coupon.description}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => {
                          setSelectedCoupon(coupon);
                          setShowDetailModal(true);
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        {coupon.usageCount} / {coupon.usagelimit > 0 ? coupon.usagelimit : '∞'}
                      </button>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm ${
                        coupon.isExpired
                          ? 'text-red-600' 
                          : 'text-gray-600'
                      }`}>
                        {formatDate(coupon.expiresat)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={coupon.status} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedCoupon(coupon);
                              setShowDetailModal(true);
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            상세보기
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedCoupon(coupon);
                              setShowEditModal(true);
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            수정
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => toggleCouponStatus(coupon)}
                          >
                            {coupon.isactive ? (
                              <><EyeOff className="mr-2 h-4 w-4" />비활성화</>
                            ) : (
                              <><Eye className="mr-2 h-4 w-4" />활성화</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deleteCoupon(coupon)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {coupons.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? '검색 결과가 없습니다.' : '생성된 쿠폰이 없습니다.'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              이전
            </Button>
            
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              다음
            </Button>
          </div>
        )}

        {/* 모달들 */}
        <CouponFormModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchCoupons}
        />
        
        <CouponFormModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={fetchCoupons}
          coupon={selectedCoupon}
          isEdit
        />
        
        <CouponDetailModal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          couponId={selectedCoupon?.id || null}
        />
      </div>
    </div>
  );
}