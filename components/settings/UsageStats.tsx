'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart3,
  TrendingUp,
  Image,
  Users,
  HardDrive,
  Calendar,
  Download
} from 'lucide-react';
// Simple chart component without external dependencies

interface UsageStatsProps {
  usage: any;
  subscription: any;
  onPeriodChange?: (period: string) => void;
  loading?: boolean;
}

export function UsageStats({ usage, subscription, onPeriodChange, loading = false }: UsageStatsProps) {
  const [period, setPeriod] = useState('month');
  
  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    if (onPeriodChange) {
      onPeriodChange(newPeriod);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStoragePercentage = () => {
    if (!usage?.summary) return 0;
    return (usage.summary.storageUsed / usage.summary.storageLimit) * 100;
  };


  return (
    <div className="p-6 space-y-6">
      {/* 기간 선택 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">사용량 분석</h2>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { value: 'day', label: '하루' },
            { value: 'week', label: '일주일' },
            { value: 'month', label: '한 달' }
          ].map((option) => (
            <button
              key={option.value}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === option.value 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => handlePeriodChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">사용 토큰</p>
              <p className="text-xl font-semibold text-gray-900">
                {usage?.summary?.totalTokens?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Image className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">생성 이미지</p>
              <p className="text-xl font-semibold text-gray-900">
                {usage?.summary?.totalImages || 0}장
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">등록 캐릭터</p>
              <p className="text-xl font-semibold text-gray-900">
                {usage?.summary?.totalCharacters || 0}개
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <HardDrive className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">스토리지</p>
              <p className="text-xl font-semibold text-gray-900">
                {formatBytes(usage?.summary?.storageUsed || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 사용량 차트 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">일별 사용량 추이</h3>
        
        {usage?.dailyStats && usage.dailyStats.length > 0 ? (
          <div className="h-64">
            <div className="h-48 flex items-end justify-between gap-2 px-2">
              {usage.dailyStats.map((stat: any, index: number) => {
                const maxTokens = Math.max(...usage.dailyStats.map((s: any) => s.tokens));
                const maxImages = Math.max(...usage.dailyStats.map((s: any) => s.images));
                const tokenHeight = maxTokens > 0 ? Math.max((stat.tokens / maxTokens) * 160, 2) : 0;
                const imageHeight = maxImages > 0 ? Math.max((stat.images / maxImages) * 160, 2) : 0;
                
                return (
                  <div key={index} className="flex flex-col items-center gap-2 flex-1">
                    <div className="flex items-end gap-1 h-40">
                      <div 
                        className="bg-blue-500 rounded-t min-w-[6px] relative group cursor-pointer"
                        style={{ height: `${tokenHeight}px` }}
                      >
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 whitespace-nowrap">
                          토큰: {stat.tokens}
                        </div>
                      </div>
                      <div 
                        className="bg-green-500 rounded-t min-w-[6px] relative group cursor-pointer"
                        style={{ height: `${imageHeight}px` }}
                      >
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 whitespace-nowrap">
                          이미지: {stat.images}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(stat.date).getDate()}일
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span className="text-sm text-gray-600">토큰 사용량</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-sm text-gray-600">이미지 생성</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">사용량 데이터가 없습니다</p>
            </div>
          </div>
        )}
      </div>

      {/* 스토리지 사용량 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <HardDrive className="h-5 w-5 text-gray-600" />
          <h3 className="text-base font-semibold text-gray-900">스토리지 사용량</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">사용량</span>
            <span className="text-gray-600">
              {formatBytes(usage?.summary?.storageUsed || 0)} / {formatBytes(usage?.summary?.storageLimit || 0)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                getStoragePercentage() > 80 ? 'bg-red-500' : 
                getStoragePercentage() > 60 ? 'bg-orange-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(getStoragePercentage(), 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{getStoragePercentage().toFixed(1)}% 사용 중</span>
            {getStoragePercentage() > 80 && (
              <span className="text-red-600 font-medium">
                저장공간이 부족합니다
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 플랜별 한도 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">플랜별 사용 한도</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-gray-900">토큰 한도</span>
              <span className="text-sm text-gray-600">
                {((subscription?.tokensTotal || 0) - (subscription?.tokensUsed || 0)).toLocaleString()} 남음
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
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-gray-900">캐릭터</span>
              <span className="text-sm text-gray-600">
                {usage?.summary?.totalCharacters || 0} / {subscription?.maxCharacters || 0}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.min(((usage?.summary?.totalCharacters || 0) / (subscription?.maxCharacters || 1)) * 100, 100)}%` 
                }}
              />
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-gray-900">스토리지</span>
              <span className="text-sm text-gray-600">
                {getStoragePercentage().toFixed(1)}% 사용
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  getStoragePercentage() > 80 ? 'bg-red-600' : 
                  getStoragePercentage() > 60 ? 'bg-orange-600' : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(getStoragePercentage(), 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}