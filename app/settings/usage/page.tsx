'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ArrowLeft,
  BarChart3,
  Coins,
  FileImage,
  Users,
  Calendar,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { useOptimizedSettings } from '@/hooks/useOptimizedSettings';
import Link from 'next/link';

export default function UsagePage() {
  const [filterPeriod, setFilterPeriod] = useState('month');
  
  const {
    usage,
    loading,
    error,
    refreshSettings,
    hasData,
    recentActivities
  } = useOptimizedSettings();

  if (loading && !hasData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="px-6 py-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-64"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-lg border p-6 space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-32"></div>
                  <div className="h-8 bg-gray-200 rounded w-24"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 대시보드 통계 데이터
  const usageStats = [
    {
      title: '이번 달 사용량',
      value: usage?.summary?.totalTokens?.toLocaleString() || '0',
      unit: '토큰',
      icon: Coins,
      change: usage?.summary?.monthlyChange || 0,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: '생성된 이미지',
      value: usage?.summary?.totalImages?.toLocaleString() || '0',
      unit: '장',
      icon: FileImage,
      change: usage?.summary?.imageChange || 0,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: '캐릭터 수',
      value: usage?.summary?.totalCharacters?.toLocaleString() || '0',
      unit: '개',
      icon: Users,
      change: usage?.summary?.characterChange || 0,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: '활성 일수',
      value: usage?.summary?.activeDays?.toString() || '0',
      unit: '일',
      icon: Calendar,
      change: usage?.summary?.activeDaysChange || 0,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/settings">
              <Button variant="outline" size="sm" className="text-gray-600">
                <ArrowLeft className="h-4 w-4 mr-2" />
                돌아가기
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">사용량</h1>
              <p className="text-gray-600 mt-1">토큰 및 생성량 확인</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">
        {/* 기간 필터 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-600" />
            <span className="text-lg font-semibold text-gray-900">사용량 통계</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              {[
                { key: 'week', label: '주간' },
                { key: 'month', label: '월간' },
                { key: 'year', label: '연간' }
              ].map((period) => (
                <button
                  key={period.key}
                  onClick={() => setFilterPeriod(period.key)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    filterPeriod === period.key
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
            
            <Button variant="outline" size="sm" onClick={refreshSettings}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 통계 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {usageStats.map((stat, index) => {
            const Icon = stat.icon;
            const isPositiveChange = stat.change >= 0;
            
            return (
              <Card key={index} className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                      <Icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                    {stat.change !== 0 && (
                      <Badge variant={isPositiveChange ? "default" : "secondary"} className="text-xs">
                        <TrendingUp className={`h-3 w-3 mr-1 ${isPositiveChange ? '' : 'rotate-180'}`} />
                        {Math.abs(stat.change)}%
                      </Badge>
                    )}
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-gray-900">{stat.value}</span>
                      <span className="text-sm text-gray-500">{stat.unit}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 최근 사용 내역 */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              최근 사용 내역
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities && recentActivities.length > 0 ? (
                recentActivities.map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border">
                        <FileImage className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{item.title || '이미지 생성'}</p>
                        <p className="text-sm text-gray-600">{item.timestamp}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{item.amount || '0 토큰'}</p>
                      <p className="text-sm text-gray-600">{item.status}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm">사용 내역이 없습니다</p>
                  <p className="text-gray-400 text-xs mt-1">웹툰 생성을 시작해보세요!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}