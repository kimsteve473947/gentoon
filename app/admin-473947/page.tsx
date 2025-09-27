'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users,
  CreditCard,
  TrendingUp,
  DollarSign,
  Activity,
  Eye,
  Shield,
  Settings,
  BarChart3,
  Gift,
  Crown,
  Lock,
  AlertTriangle,
  Receipt,
  MessageCircle,
  Mail,
  Server,
  FileText,
  Webhook,
  BookOpen,
  Bell,
  Clock,
  Zap,
  RefreshCw,
  Database,
  HardDrive
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOptimizedSettings } from '@/hooks/useOptimizedSettings';


// 결제 내역 섹션 컴포넌트
function BillingHistorySection() {
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 실제 환경에서는 관리자 결제 내역 API 필요
    const loadPaymentHistory = async () => {
      try {
        setLoading(false);
        // 임시 데이터
        setPaymentHistory([]);
      } catch (error) {
        console.error('결제 내역 로드 실패:', error);
        setLoading(false);
      }
    };

    loadPaymentHistory();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Activity className="h-3 w-3 text-green-600" />;
      case 'failed':
        return <AlertTriangle className="h-3 w-3 text-red-600" />;
      case 'pending':
        return <Activity className="h-3 w-3 text-yellow-600 animate-spin" />;
      default:
        return <Activity className="h-3 w-3 text-gray-600" />;
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
        return '완료';
      case 'failed':
        return '실패';
      case 'pending':
        return '대기';
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

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded"></div>
              <div className="space-y-1">
                <div className="h-4 bg-gray-200 rounded w-32"></div>
                <div className="h-3 bg-gray-200 rounded w-20"></div>
              </div>
            </div>
            <div className="h-4 bg-gray-200 rounded w-16"></div>
          </div>
        ))}
      </div>
    );
  }

  const recentPayments = paymentHistory?.slice(0, 5) || [];

  return (
    <div className="space-y-3">
      {recentPayments.length > 0 ? (
        <>
          {recentPayments.map((payment: any, index: number) => (
            <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-50 rounded flex items-center justify-center border border-purple-200">
                  <CreditCard className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{payment.description || 'GenToon 구독'}</p>
                    <Badge className={`text-xs border ${getStatusColor(payment.status)}`}>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(payment.status)}
                        {getStatusLabel(payment.status)}
                      </div>
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(payment.createdAt).toLocaleDateString('ko-KR')} • {payment.plan}
                  </p>
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-900">{formatAmount(payment.amount)}</p>
            </div>
          ))}
          <div className="pt-2 border-t">
            <p className="text-xs text-gray-500 text-center">
              최근 5개의 결제 내역을 표시합니다
            </p>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Receipt className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">결제 내역이 없습니다</p>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const { subscription, loading } = useOptimizedSettings();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCoupons: 0,
    activeCoupons: 0,
    totalRevenue: 0
  });

  useEffect(() => {
    // 관리자 권한 확인
    if (!loading && subscription?.plan !== 'ADMIN') {
      router.push('/');
      return;
    }

    // 통계 데이터 로드
    loadStats();
  }, [loading, subscription, router]);

  const loadStats = async () => {
    try {
      // 실제 환경에서는 별도의 통계 API를 만들어야 합니다
      const response = await fetch('/api/admin-473947/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('통계 로드 실패:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-8 w-8 animate-pulse mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">관리자 권한 확인 중...</p>
        </div>
      </div>
    );
  }

  if (subscription?.plan !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">접근 거부</h1>
          <p className="text-gray-600 mb-4">관리자 권한이 필요합니다.</p>
          <Link href="/">
            <Button>홈으로 돌아가기</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Crown className="h-8 w-8 text-yellow-600" />
            <h1 className="text-3xl font-bold text-gray-900">관리자 대시보드</h1>
          </div>
          <p className="text-gray-600">GenToon 서비스 관리 및 통계를 확인하세요.</p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">총 사용자</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalUsers.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-50 rounded-lg">
                  <Gift className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">전체 쿠폰</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalCoupons}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-purple-50 rounded-lg">
                  <Activity className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">활성 쿠폰</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.activeCoupons}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <DollarSign className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">총 매출</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₩{stats.totalRevenue.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 관리 메뉴 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/admin-473947/coupons">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <Gift className="h-6 w-6 text-green-600" />
                  </div>
                  쿠폰 관리
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  쿠폰 생성, 수정, 삭제 및 사용 현황을 관리합니다.
                </p>
                <ul className="text-sm text-gray-500 space-y-1">
                  <li>• 할인 쿠폰 생성 및 관리</li>
                  <li>• 사용 내역 및 통계 조회</li>
                  <li>• 쿠폰 활성화/비활성화</li>
                  <li>• CSV 내보내기</li>
                </ul>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin-473947/users">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  사용자 관리
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  사용자 계정 관리 및 구독 현황을 확인합니다.
                </p>
                <ul className="text-sm text-gray-500 space-y-1">
                  <li>• 전체 사용자 목록 조회</li>
                  <li>• 구독 및 토큰 사용량 모니터링</li>
                  <li>• 사용자 계정 정보 수정</li>
                  <li>• 활동 내역 추적</li>
                </ul>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin-473947/security">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-orange-200 bg-gradient-to-br from-orange-50 to-red-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Shield className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    보안 모니터링
                    <Badge className="bg-red-100 text-red-700 text-xs">실시간</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4">
                  실시간 보안 위협 탐지 및 모니터링 시스템입니다.
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center gap-2">
                    <Eye className="h-3 w-3 text-blue-600" />
                    실시간 위협 모니터링
                  </li>
                  <li className="flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-yellow-600" />
                    자동 위험도 분석
                  </li>
                  <li className="flex items-center gap-2">
                    <Lock className="h-3 w-3 text-green-600" />
                    IP 차단 및 관리
                  </li>
                  <li className="flex items-center gap-2">
                    <Activity className="h-3 w-3 text-purple-600" />
                    보안 이벤트 로그
                  </li>
                </ul>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin-473947/analytics">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <BarChart3 className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    심화 분석
                    <Badge className="bg-purple-100 text-purple-700 text-xs">투자 지표</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4">
                  투자자를 위한 상세 KPI 및 비즈니스 메트릭을 확인합니다.
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center gap-2">
                    <Eye className="h-3 w-3 text-blue-600" />
                    MRR 및 성장률 지표
                  </li>
                  <li className="flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-yellow-600" />
                    이탈률 및 리텐션 분석
                  </li>
                  <li className="flex items-center gap-2">
                    <Lock className="h-3 w-3 text-green-600" />
                    ARPU 및 코호트 분석
                  </li>
                  <li className="flex items-center gap-2">
                    <Activity className="h-3 w-3 text-purple-600" />
                    사용자 행동 패턴
                  </li>
                </ul>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin-473947/inquiries">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-100 rounded-lg">
                    <MessageCircle className="h-6 w-6 text-cyan-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    문의사항 관리
                    <Badge className="bg-cyan-100 text-cyan-700 text-xs">고객지원</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4">
                  사용자 문의사항을 확인하고 답변을 관리합니다.
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center gap-2">
                    <Mail className="h-3 w-3 text-blue-600" />
                    신규 문의사항 확인
                  </li>
                  <li className="flex items-center gap-2">
                    <MessageCircle className="h-3 w-3 text-green-600" />
                    답변 작성 및 관리
                  </li>
                  <li className="flex items-center gap-2">
                    <Eye className="h-3 w-3 text-purple-600" />
                    첨부파일 확인
                  </li>
                  <li className="flex items-center gap-2">
                    <Activity className="h-3 w-3 text-orange-600" />
                    처리 상태 추적
                  </li>
                </ul>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin-473947/system">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Settings className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    시스템 설정
                    <Badge className="bg-yellow-100 text-yellow-700 text-xs">고급</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4">
                  서비스 전반적인 설정 및 환경 관리를 수행합니다.
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center gap-2">
                    <Settings className="h-3 w-3 text-blue-600" />
                    서비스 환경 설정
                  </li>
                  <li className="flex items-center gap-2">
                    <Lock className="h-3 w-3 text-green-600" />
                    API 키 및 토큰 관리
                  </li>
                  <li className="flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-orange-600" />
                    캐시 및 성능 최적화
                  </li>
                  <li className="flex items-center gap-2">
                    <Activity className="h-3 w-3 text-purple-600" />
                    백업 및 복구 관리
                  </li>
                </ul>
              </CardContent>
            </Card>
          </Link>


          <Link href="/admin-473947/notifications">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Bell className="h-6 w-6 text-amber-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    알림 & 이메일
                    <Badge className="bg-amber-100 text-amber-700 text-xs">마케팅</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4">
                  사용자 알림, 마케팅 이메일 및 시스템 알림을 관리합니다.
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center gap-2">
                    <Bell className="h-3 w-3 text-blue-600" />
                    푸시 알림 발송
                  </li>
                  <li className="flex items-center gap-2">
                    <Mail className="h-3 w-3 text-green-600" />
                    마케팅 이메일 캠페인
                  </li>
                  <li className="flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-orange-600" />
                    시스템 장애 알림
                  </li>
                  <li className="flex items-center gap-2">
                    <Eye className="h-3 w-3 text-purple-600" />
                    발송 통계 및 성과
                  </li>
                </ul>
              </CardContent>
            </Card>
          </Link>


          <Link href="/admin-473947/audit">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-slate-200 bg-gradient-to-br from-slate-50 to-gray-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Clock className="h-6 w-6 text-slate-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    감사 로그
                    <Badge className="bg-slate-100 text-slate-700 text-xs">보안</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4">
                  모든 관리자 활동 및 시스템 변경사항을 추적합니다.
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center gap-2">
                    <Eye className="h-3 w-3 text-blue-600" />
                    관리자 활동 추적
                  </li>
                  <li className="flex items-center gap-2">
                    <Shield className="h-3 w-3 text-green-600" />
                    권한 변경 이력
                  </li>
                  <li className="flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-orange-600" />
                    의심 활동 탐지
                  </li>
                  <li className="flex items-center gap-2">
                    <FileText className="h-3 w-3 text-purple-600" />
                    컴플라이언스 보고서
                  </li>
                </ul>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin-473947/backup">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-teal-100 rounded-lg">
                    <RefreshCw className="h-6 w-6 text-teal-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    백업 & 복구
                    <Badge className="bg-teal-100 text-teal-700 text-xs">중요</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4">
                  데이터 백업, 복구 및 재해 복구 계획을 관리합니다.
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center gap-2">
                    <Database className="h-3 w-3 text-blue-600" />
                    자동 데이터베이스 백업
                  </li>
                  <li className="flex items-center gap-2">
                    <RefreshCw className="h-3 w-3 text-green-600" />
                    복구 포인트 관리
                  </li>
                  <li className="flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-orange-600" />
                    재해 복구 시뮬레이션
                  </li>
                  <li className="flex items-center gap-2">
                    <HardDrive className="h-3 w-3 text-purple-600" />
                    스토리지 사용량 관리
                  </li>
                </ul>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* 결제 내역 섹션 */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                최근 결제 내역
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BillingHistorySection />
            </CardContent>
          </Card>
        </div>

        {/* 최근 활동 */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                최근 활동
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="p-2 bg-green-50 rounded">
                    <Gift className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">쿠폰 시스템이 활성화되었습니다</p>
                    <p className="text-xs text-gray-500">관리자 페이지에서 쿠폰을 생성하고 관리할 수 있습니다</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="p-2 bg-blue-50 rounded">
                    <Shield className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">관리자 권한이 설정되었습니다</p>
                    <p className="text-xs text-gray-500">ADMIN 플랜 사용자만 이 페이지에 접근할 수 있습니다</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}