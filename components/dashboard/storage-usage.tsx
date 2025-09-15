'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { 
  HardDrive, 
  Upload, 
  AlertCircle, 
  CheckCircle,
  Sparkles,
  TrendingUp
} from 'lucide-react'
import { formatBytes, bytesToGB } from '@/lib/storage/storage-manager'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface StorageData {
  usedBytes: number
  maxBytes: number
  remainingBytes: number
  usagePercentage: number
  fileCount: number
  formatted: {
    used: string
    max: string
    remaining: string
  }
  breakdown?: any
  categories?: {
    projects: {
      count: number
      used: string
      usedBytes: number
      description: string
    }
    characters: {
      count: number
      used: string
      usedBytes: number
      description: string
    }
  }
  stats?: {
    totalProjects: number
    totalCharacters: number
    totalImages: number
    lastUpdated: string
  }
  warningLevel?: string
}

export function StorageUsage() {
  const [storage, setStorage] = useState<StorageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStorageData()
  }, [])

  const fetchStorageData = async () => {
    try {
      const response = await fetch('/api/storage/check')
      const data = await response.json()
      
      // 🛡️ API 응답 검증
      if (!response.ok || !data || !data.formatted) {
        console.error('Invalid storage API response:', data)
        return
      }
      
      // 🛡️ Clean the data to prevent React rendering errors
      const cleanedData = {
        usedBytes: data.usedBytes,
        maxBytes: data.maxBytes,
        remainingBytes: data.remainingBytes,
        usagePercentage: data.usagePercentage,
        fileCount: data.fileCount,
        formatted: data.formatted,
        // Only include safe string/number properties
        warningLevel: data.warningLevel
      }
      
      setStorage(cleanedData)
    } catch (error) {
      console.error('Failed to fetch storage data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-32"></div>
        </CardHeader>
        <CardContent>
          <div className="h-2 bg-gray-200 rounded mb-4"></div>
          <div className="h-3 bg-gray-200 rounded w-48"></div>
        </CardContent>
      </Card>
    )
  }

  // 🛡️ 데이터가 없거나 인증 실패 시 처리
  if (!storage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            스토리지 정보 로딩 실패
          </CardTitle>
          <CardDescription>
            스토리지 정보를 불러올 수 없습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchStorageData} variant="outline" size="sm">
            다시 시도
          </Button>
        </CardContent>
      </Card>
    )
  }

  const isNearLimit = storage.usagePercentage > 80
  const isAtLimit = storage.usagePercentage >= 95
  const isFreeUser = storage.maxBytes === 1024 * 1024 * 1024 // 1GB

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300",
      isAtLimit && "border-red-500 shadow-red-100",
      isNearLimit && !isAtLimit && "border-orange-500 shadow-orange-100"
    )}>
      {/* 배경 그라데이션 */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 to-pink-50/50 pointer-events-none" />
      
      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HardDrive className="h-5 w-5 text-purple-600" />
              저장 공간
            </CardTitle>
            <CardDescription className="mt-1">
              {storage.fileCount}개 파일 저장 중
            </CardDescription>
          </div>
          {isAtLimit && (
            <div className="flex items-center gap-1 text-red-600 text-sm font-medium animate-pulse">
              <AlertCircle className="h-4 w-4" />
              용량 초과
            </div>
          )}
          {isNearLimit && !isAtLimit && (
            <div className="flex items-center gap-1 text-orange-600 text-sm font-medium">
              <AlertCircle className="h-4 w-4" />
              용량 주의
            </div>
          )}
          {!isNearLimit && (
            <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
              <CheckCircle className="h-4 w-4" />
              정상
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="relative space-y-4">
        {/* 프로그레스 바 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{storage.formatted.used}</span>
            <span className="text-muted-foreground">/ {storage.formatted.max}</span>
          </div>
          <Progress 
            value={storage.usagePercentage} 
            className={cn(
              "h-3 transition-all",
              isAtLimit && "[&>div]:bg-red-500",
              isNearLimit && !isAtLimit && "[&>div]:bg-orange-500",
              !isNearLimit && "[&>div]:bg-gradient-to-r [&>div]:from-purple-500 [&>div]:to-pink-500"
            )}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{storage.usagePercentage.toFixed(1)}% 사용중</span>
            <span>{storage.formatted.remaining} 남음</span>
          </div>
        </div>

        {/* 무료 사용자 업그레이드 유도 */}
        {isFreeUser && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-3 border border-purple-200">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-purple-600 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-purple-900">
                  무료 플랜 (1GB)
                </p>
                <p className="text-xs text-purple-700">
                  멤버십 업그레이드로 10GB 이상 사용하세요!
                </p>
              </div>
            </div>
            <Link href="/pricing">
              <Button 
                size="sm" 
                variant="outline"
                className="w-full mt-2 border-purple-300 hover:bg-purple-50"
              >
                <TrendingUp className="h-3 w-3 mr-1" />
                멤버십 업그레이드
              </Button>
            </Link>
          </div>
        )}

        {/* 용량 경고 메시지 */}
        {isNearLimit && (
          <div className={cn(
            "rounded-lg p-3 text-sm",
            isAtLimit 
              ? "bg-red-50 border border-red-200 text-red-800"
              : "bg-orange-50 border border-orange-200 text-orange-800"
          )}>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <div>
                <p className="font-medium">
                  {isAtLimit ? "저장 공간이 가득 찼습니다!" : "저장 공간이 얼마 남지 않았습니다."}
                </p>
                <p className="text-xs mt-1 opacity-90">
                  {isAtLimit 
                    ? "새 파일을 업로드하려면 기존 파일을 삭제하거나 멤버십을 업그레이드하세요."
                    : "곧 용량이 부족해질 수 있습니다. 미리 정리하거나 업그레이드를 고려해보세요."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 액션 버튼들 */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => window.location.href = '/trash'}
          >
            휴지통 관리
          </Button>
          {(isNearLimit || isFreeUser) && (
            <Link href="/pricing" className="flex-1">
              <Button 
                size="sm" 
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Upload className="h-3 w-3 mr-1" />
                용량 늘리기
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}