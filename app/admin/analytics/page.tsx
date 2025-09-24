'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users,
  CreditCard,
  TrendingUp,
  DollarSign,
  Activity,
  Target,
  Zap,
  Crown,
  Gift,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
  Calendar,
  Eye,
  PieChart,
  LineChart
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOptimizedSettings } from '@/hooks/useOptimizedSettings';

interface DashboardStats {
  // 핵심 KPI
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  mrrGrowthRate: number;
  totalUsers: number;
  activeUsers: number;
  churnRate: number;
  averageRevenuePerUser: number;
  
  // 성장 지표  
  userGrowthRate: number;
  revenueGrowthRate: number;
  conversionRate: number;
  
  // 서비스 사용률
  totalGenerations: number;
  dailyActiveUsers: number;
  monthlyActiveUsers: number;
  retentionRate: {
    day1: number;
    day7: number;
    day30: number;
  };
  
  // 구독 관련
  subscriptions: {
    FREE: number;
    PRO: number;
    PREMIUM: number;
  };
  
  // 추천 시스템
  referralStats: {
    totalReferrals: number;
    conversionRate: number;
    rewardsPaid: number;
  };
  
  // 쿠폰 사용률
  couponStats: {
    totalCoupons: number;
    activeCoupons: number;
    usageRate: number;
    discountGiven: number;
  };

  // 코호트 분석 데이터
  cohortData: {
    month: string;
    newUsers: number;
    retention: number[];
  }[];

  // 월별 매출 추이
  revenueHistory: {
    month: string;
    revenue: number;
    mrr: number;
  }[];
}

interface TrendIndicator {
  value: number;
  trend: 'up' | 'down' | 'neutral';
  percentage: number;
}

export default function AnalyticsDashboard() {
  const router = useRouter();
  const { subscription, loading } = useOptimizedSettings();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30');

  useEffect(() => {
    // 관리자 권한 확인
    if (!loading && subscription?.plan !== 'ADMIN') {
      router.push('/');
      return;
    }

    fetchDashboardStats();
  }, [loading, subscription, router, selectedPeriod]);

  const fetchDashboardStats = async () => {
    try {
      setLoadingStats(true);
      const response = await fetch(`/api/admin/analytics?period=${selectedPeriod}`);
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      } else {
        // Mock data for development
        setStats({
          totalRevenue: 25420000,
          monthlyRecurringRevenue: 8750000,
          mrrGrowthRate: 15.3,
          totalUsers: 2847,
          activeUsers: 1923,
          churnRate: 4.2,
          averageRevenuePerUser: 4550,
          userGrowthRate: 23.7,
          revenueGrowthRate: 18.9,
          conversionRate: 8.4,
          totalGenerations: 89432,
          dailyActiveUsers: 654,
          monthlyActiveUsers: 1923,
          retentionRate: {
            day1: 85.2,
            day7: 67.3,
            day30: 52.1
          },
          subscriptions: {
            FREE: 1847,
            PRO: 623,
            PREMIUM: 289
          },
          referralStats: {
            totalReferrals: 423,
            conversionRate: 12.3,
            rewardsPaid: 89450
          },
          couponStats: {
            totalCoupons: 45,
            activeCoupons: 28,
            usageRate: 67.8,
            discountGiven: 3420000
          },
          cohortData: [
            { month: '2024-09', newUsers: 245, retention: [100, 78, 65, 52, 48] },
            { month: '2024-10', newUsers: 312, retention: [100, 82, 69, 56] },
            { month: '2024-11', newUsers: 387, retention: [100, 85, 71] },
            { month: '2024-12', newUsers: 456, retention: [100, 87] },
            { month: '2025-01', newUsers: 523, retention: [100] }
          ],
          revenueHistory: [
            { month: '2024-09', revenue: 5840000, mrr: 6250000 },
            { month: '2024-10', revenue: 6720000, mrr: 7100000 },
            { month: '2024-11', revenue: 7830000, mrr: 7890000 },
            { month: '2024-12', revenue: 8940000, mrr: 8350000 },
            { month: '2025-01', revenue: 9650000, mrr: 8750000 }
          ]
        });
      }
    } catch (error) {
      console.error('Analytics stats fetch failed:', error);
      // Use mock data on error
      setStats({
        totalRevenue: 0,
        monthlyRecurringRevenue: 0,
        mrrGrowthRate: 0,
        totalUsers: 0,
        activeUsers: 0,
        churnRate: 0,
        averageRevenuePerUser: 0,
        userGrowthRate: 0,
        revenueGrowthRate: 0,
        conversionRate: 0,
        totalGenerations: 0,
        dailyActiveUsers: 0,
        monthlyActiveUsers: 0,
        retentionRate: { day1: 0, day7: 0, day30: 0 },
        subscriptions: { FREE: 0, PRO: 0, PREMIUM: 0 },
        referralStats: { totalReferrals: 0, conversionRate: 0, rewardsPaid: 0 },
        couponStats: { totalCoupons: 0, activeCoupons: 0, usageRate: 0, discountGiven: 0 },
        cohortData: [],
        revenueHistory: []
      });
    } finally {
      setLoadingStats(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      notation: amount >= 1000000 ? 'compact' : 'standard'
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  const formatPercentage = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return <ArrowUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <ArrowDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getHealthScore = (stats: DashboardStats) => {
    let score = 0;
    let maxScore = 0;

    // MRR 성장률 (0-40점)
    if (stats.mrrGrowthRate > 20) score += 40;
    else if (stats.mrrGrowthRate > 10) score += 30;
    else if (stats.mrrGrowthRate > 5) score += 20;
    else if (stats.mrrGrowthRate > 0) score += 10;
    maxScore += 40;

    // 이탈률 (0-20점, 낮을수록 좋음)
    if (stats.churnRate < 3) score += 20;
    else if (stats.churnRate < 5) score += 15;
    else if (stats.churnRate < 8) score += 10;
    else if (stats.churnRate < 12) score += 5;
    maxScore += 20;

    // 전환율 (0-20점)
    if (stats.conversionRate > 15) score += 20;
    else if (stats.conversionRate > 10) score += 15;
    else if (stats.conversionRate > 7) score += 10;
    else if (stats.conversionRate > 5) score += 5;
    maxScore += 20;

    // 리텐션 (0-20점)
    if (stats.retentionRate.day30 > 50) score += 20;
    else if (stats.retentionRate.day30 > 40) score += 15;
    else if (stats.retentionRate.day30 > 30) score += 10;
    else if (stats.retentionRate.day30 > 20) score += 5;
    maxScore += 20;

    return Math.round((score / maxScore) * 100);
  };

  if (loading || loadingStats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>투자 지표 분석 중...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p>데이터를 불러올 수 없습니다.</p>
          <Button onClick={fetchDashboardStats} className="mt-4">
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  const healthScore = getHealthScore(stats);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-6 py-8">
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/admin" className="text-gray-500 hover:text-gray-700">
                ← 관리자 대시보드
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">투자 지표 분석</h1>
            <p className="text-gray-600 mt-1">GenToon 비즈니스 KPI 및 성장 메트릭</p>
          </div>
          
          <div className="flex items-center gap-4">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
            >
              <option value="7">최근 7일</option>
              <option value="30">최근 30일</option>
              <option value="90">최근 90일</option>
              <option value="365">최근 1년</option>
            </select>
            
            <Button onClick={fetchDashboardStats}>
              <Activity className="h-4 w-4 mr-2" />
              새로고침
            </Button>
          </div>
        </div>

        {/* 비즈니스 헬스 스코어 */}
        <div className="mb-8">
          <Card className="border-l-4 border-l-indigo-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">비즈니스 헬스 스코어</h3>
                  <p className="text-sm text-gray-600">MRR 성장률, 이탈률, 전환율, 리텐션을 종합한 지표</p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-indigo-600">{healthScore}</div>
                  <div className="text-sm text-gray-600">/ 100점</div>
                </div>
              </div>
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      healthScore >= 80 ? 'bg-green-500' :
                      healthScore >= 60 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${healthScore}%` }}
                  ></div>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  {healthScore >= 80 && "우수한 비즈니스 성과입니다"}
                  {healthScore >= 60 && healthScore < 80 && "양호한 수준입니다"}
                  {healthScore < 60 && "개선이 필요한 영역이 있습니다"}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 핵심 KPI 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* 월간 반복 매출 (MRR) */}
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">월간 반복 매출 (MRR)</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.monthlyRecurringRevenue)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {getTrendIcon(stats.mrrGrowthRate > 0 ? 'up' : 'down')}
                <span className={getTrendColor(stats.mrrGrowthRate > 0 ? 'up' : 'down')}>
                  {stats.mrrGrowthRate > 0 ? '+' : ''}{formatPercentage(stats.mrrGrowthRate)} MoM
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 총 사용자 수 */}
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 사용자</CardTitle>
              <Users className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.totalUsers)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {getTrendIcon(stats.userGrowthRate > 0 ? 'up' : 'down')}
                <span className={getTrendColor(stats.userGrowthRate > 0 ? 'up' : 'down')}>
                  +{formatPercentage(stats.userGrowthRate)} 성장률
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 이탈률 (Churn Rate) */}
          <Card className="border-l-4 border-l-yellow-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">월간 이탈률</CardTitle>
              <TrendingUp className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPercentage(stats.churnRate)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {getTrendIcon(stats.churnRate < 5 ? 'up' : 'down')}
                <span className={getTrendColor(stats.churnRate < 5 ? 'up' : 'down')}>
                  {stats.churnRate < 5 ? '양호' : '개선필요'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 사용자당 평균 매출 (ARPU) */}
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">사용자당 평균 매출 (ARPU)</CardTitle>
              <Target className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.averageRevenuePerUser)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {getTrendIcon('up')}
                <span className={getTrendColor('up')}>월별 평균</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 투자 지표 섹션 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 핵심 성장 지표 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                핵심 성장 지표
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">전환율 (Free → Paid)</span>
                <div className="text-right">
                  <div className="font-bold text-lg">{formatPercentage(stats.conversionRate)}</div>
                  <div className={`text-sm ${stats.conversionRate > 8 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {stats.conversionRate > 8 ? '우수' : '평균'}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">매출 성장률 (YoY)</span>
                <div className="text-right">
                  <div className="font-bold text-lg text-green-600">
                    +{formatPercentage(stats.revenueGrowthRate)}
                  </div>
                  <div className="text-sm text-gray-600">연간 성장률</div>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">일간 활성 사용자 (DAU)</span>
                <div className="text-right">
                  <div className="font-bold text-lg">{formatNumber(stats.dailyActiveUsers)}</div>
                  <div className="text-sm text-gray-600">
                    전체 사용자의 {formatPercentage((stats.dailyActiveUsers / stats.totalUsers) * 100)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 리텐션 분석 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                사용자 리텐션
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="font-medium">1일 리텐션</span>
                <div className="text-right">
                  <div className="font-bold text-lg">{formatPercentage(stats.retentionRate.day1)}</div>
                  <div className="text-sm text-blue-600">가입 후 재방문률</div>
                </div>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="font-medium">7일 리텐션</span>
                <div className="text-right">
                  <div className="font-bold text-lg">{formatPercentage(stats.retentionRate.day7)}</div>
                  <div className="text-sm text-green-600">주간 지속 사용률</div>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <span className="font-medium">30일 리텐션</span>
                <div className="text-right">
                  <div className="font-bold text-lg">{formatPercentage(stats.retentionRate.day30)}</div>
                  <div className={`text-sm ${stats.retentionRate.day30 > 50 ? 'text-purple-600' : 'text-yellow-600'}`}>
                    {stats.retentionRate.day30 > 50 ? '우수한 리텐션' : '개선 필요'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 구독 및 서비스 사용률 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* 구독 플랜 분포 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                구독 플랜 분포
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(stats.subscriptions).map(([plan, count]) => {
                  const total = Object.values(stats.subscriptions).reduce((a, b) => a + b, 0);
                  const percentage = (count / total) * 100;
                  const planPrices = { FREE: 0, PRO: 30000, PREMIUM: 100000 };
                  
                  return (
                    <div key={plan} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={plan === 'FREE' ? 'secondary' : 'default'}>
                          {plan}
                        </Badge>
                        <span className="font-medium">{formatNumber(count)}명</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">{formatPercentage(percentage)}</div>
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-3 border-t">
                <div className="text-sm text-gray-600">
                  유료 사용자: {formatNumber(stats.totalUsers - stats.subscriptions.FREE)}명 
                  ({formatPercentage(((stats.totalUsers - stats.subscriptions.FREE) / stats.totalUsers) * 100)})
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI 생성 통계 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                AI 서비스 사용량
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">
                {formatNumber(stats.totalGenerations)}
              </div>
              <p className="text-sm text-gray-600 mb-4">총 생성된 이미지 수</p>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">사용자당 평균 생성량</span>
                  <span className="font-semibold">
                    {Math.round(stats.totalGenerations / stats.activeUsers)}개
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">일평균 생성량</span>
                  <span className="font-semibold">
                    {formatNumber(Math.round(stats.totalGenerations / 30))}개
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 추천 및 쿠폰 시스템 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                마케팅 효과
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">추천 시스템</span>
                    <Badge className="bg-blue-100 text-blue-700 text-xs">활성</Badge>
                  </div>
                  <div className="text-lg font-bold">{formatNumber(stats.referralStats.totalReferrals)}건</div>
                  <div className="text-sm text-gray-600">
                    전환율: {formatPercentage(stats.referralStats.conversionRate)}
                  </div>
                </div>
                
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">쿠폰 사용률</span>
                  </div>
                  <div className="text-lg font-bold">{formatPercentage(stats.couponStats.usageRate)}</div>
                  <div className="text-sm text-gray-600">
                    총 할인액: {formatCurrency(stats.couponStats.discountGiven)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 코호트 분석 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5" />
              코호트 분석 (월별 사용자 리텐션)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">가입월</th>
                    <th className="text-left p-2">신규 사용자</th>
                    <th className="text-left p-2">0개월</th>
                    <th className="text-left p-2">1개월</th>
                    <th className="text-left p-2">2개월</th>
                    <th className="text-left p-2">3개월</th>
                    <th className="text-left p-2">4개월</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.cohortData.map((cohort, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-2 font-medium">{cohort.month}</td>
                      <td className="p-2">{formatNumber(cohort.newUsers)}</td>
                      {cohort.retention.map((retention, retIndex) => (
                        <td key={retIndex} className="p-2">
                          <div className={`inline-block px-2 py-1 rounded text-xs ${
                            retention >= 80 ? 'bg-green-100 text-green-800' :
                            retention >= 60 ? 'bg-yellow-100 text-yellow-800' :
                            retention >= 40 ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {retention}%
                          </div>
                        </td>
                      ))}
                      {Array(5 - cohort.retention.length).fill(null).map((_, emptyIndex) => (
                        <td key={`empty-${emptyIndex}`} className="p-2 text-gray-400">-</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-sm text-gray-600">
              * 코호트 분석은 각 월에 가입한 사용자들의 시간별 리텐션 비율을 보여줍니다.
            </div>
          </CardContent>
        </Card>

        {/* 매출 추이 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              매출 추이 분석
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {stats.revenueHistory.map((item, index) => (
                <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">{item.month}</div>
                  <div className="text-lg font-bold text-blue-600">
                    {formatCurrency(item.revenue)}
                  </div>
                  <div className="text-xs text-gray-500">
                    MRR: {formatCurrency(item.mrr)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-sm text-gray-600">평균 월 성장률</div>
                  <div className="text-xl font-bold text-blue-600">
                    +{formatPercentage(stats.mrrGrowthRate)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">연간 예상 매출</div>
                  <div className="text-xl font-bold text-green-600">
                    {formatCurrency(stats.monthlyRecurringRevenue * 12)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">총 누적 매출</div>
                  <div className="text-xl font-bold text-purple-600">
                    {formatCurrency(stats.totalRevenue)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}