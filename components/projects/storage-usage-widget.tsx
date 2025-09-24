'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  HardDrive, 
  AlertTriangle, 
  Crown, 
  Users, 
  FolderOpen,
  TrendingUp,
  Zap
} from 'lucide-react';

interface StorageBreakdown {
  projects: {
    count: number;
    images: number;
    bytes: number;
    details: {
      thumbnails: number;
      panels: number;
      generatedImages: number;
    };
  };
  characters: {
    count: number;
    images: number;
    bytes: number;
    details: {
      referenceImages: number;
      ratioImages: number;
    };
  };
}

interface StorageUsageData {
  usedBytes: number;
  maxBytes: number;
  usagePercentage: number;
  remainingBytes: number;
  formatted: {
    used: string;
    max: string;
    remaining: string;
  };
  breakdown?: StorageBreakdown;
  warningLevel?: 'normal' | 'medium' | 'high' | 'warning' | 'critical';
  categories?: {
    projects: {
      count: number;
      used: string;
      usedBytes: number;
      description: string;
    };
    characters: {
      count: number;
      used: string;
      usedBytes: number;
      description: string;
    };
  };
}

interface StorageUsageWidgetProps {
  className?: string;
}

export function StorageUsageWidget({ className = '' }: StorageUsageWidgetProps) {
  const [storageData, setStorageData] = useState<StorageUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStorageData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/storage/check');
      if (!response.ok) {
        throw new Error('스토리지 정보를 가져올 수 없습니다');
      }
      
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      setStorageData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
      console.error('Storage data loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStorageData();
    
    // 5분마다 자동 새로고침
    const interval = setInterval(loadStorageData, 300000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
          <span className="text-sm text-gray-500">스토리지 확인 중...</span>
        </div>
      </div>
    );
  }

  if (error || !storageData) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Button 
          variant="outline" 
          size="sm"
          onClick={loadStorageData}
          className="text-red-600 border-red-200 hover:bg-red-50"
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          스토리지 오류
        </Button>
      </div>
    );
  }

  const getWarningColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'high': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'medium': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 95) return 'bg-red-500';
    if (percentage >= 80) return 'bg-orange-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getWarningIcon = (level: string) => {
    switch (level) {
      case 'critical':
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'high':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <HardDrive className="h-4 w-4" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className={`${getWarningColor(storageData.warningLevel || 'normal')} hover:opacity-80 transition-opacity`}
        >
          {getWarningIcon(storageData.warningLevel || 'normal')}
          <span className="ml-2 font-medium">
            {storageData.formatted.used} / {storageData.formatted.max}
          </span>
          <span className="ml-1 text-xs opacity-75">
            ({Math.round(storageData.usagePercentage)}%)
          </span>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80 p-4">
        <div className="space-y-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center">
              <HardDrive className="h-4 w-4 mr-2" />
              스토리지 사용량
            </h3>
            {storageData.warningLevel === 'critical' && (
              <div className="flex items-center text-red-600 text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                용량 부족
              </div>
            )}
          </div>

          {/* 전체 사용량 */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">사용량</span>
              <span className="font-medium">{storageData.formatted.used} / {storageData.formatted.max}</span>
            </div>
            
            <Progress 
              value={storageData.usagePercentage} 
              className="h-2"
            />
            
            <div className="flex justify-between text-xs text-gray-500">
              <span>{Math.round(storageData.usagePercentage)}% 사용됨</span>
              <span>{storageData.formatted.remaining} 남음</span>
            </div>
          </div>

          {/* 카테고리별 분석 */}
          {storageData.categories && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <h4 className="text-sm font-medium text-gray-700">상세 분석</h4>
              
              {/* 프로젝트 */}
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <FolderOpen className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">프로젝트</div>
                    <div className="text-xs text-gray-500">{storageData.categories.projects.description}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{storageData.categories.projects.used}</div>
                  <div className="text-xs text-gray-500">{storageData.categories.projects.count}개</div>
                </div>
              </div>

              {/* 캐릭터 */}
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">캐릭터</div>
                    <div className="text-xs text-gray-500">{storageData.categories.characters.description}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{storageData.categories.characters.used}</div>
                  <div className="text-xs text-gray-500">{storageData.categories.characters.count}개</div>
                </div>
              </div>
            </div>
          )}

          {/* 경고 메시지 */}
          {storageData.warningLevel && ['warning', 'critical'].includes(storageData.warningLevel) && (
            <div className={`p-3 rounded-lg border ${
              storageData.warningLevel === 'critical' 
                ? 'bg-red-50 border-red-200 text-red-800' 
                : 'bg-orange-50 border-orange-200 text-orange-800'
            }`}>
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  {storageData.warningLevel === 'critical' 
                    ? '스토리지 용량이 거의 가득 찼습니다. 파일을 삭제하거나 플랜을 업그레이드하세요.'
                    : '스토리지 용량이 부족해지고 있습니다. 용량 관리를 고려하세요.'
                  }
                </div>
              </div>
            </div>
          )}

          {/* 업그레이드 버튼 */}
          {storageData.warningLevel === 'critical' && (
            <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
              <Crown className="h-4 w-4 mr-2" />
              플랜 업그레이드
            </Button>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}