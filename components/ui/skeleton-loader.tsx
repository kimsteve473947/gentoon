"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

// 🎨 기본 스켈레톤 컴포넌트
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]",
        "dark:from-gray-800 dark:via-gray-700 dark:to-gray-800",
        "animate-[shimmer_2s_infinite]",
        className
      )}
      {...props}
    />
  );
}

// 🚀 Canva 스타일 프로젝트 카드 스켈레톤
export function ProjectCardSkeleton() {
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-200">
      {/* 썸네일 영역 */}
      <div className="aspect-[4/3] relative">
        <Skeleton className="w-full h-full" />
        
        {/* 상태 표시 점 (오른쪽 상단) */}
        <div className="absolute top-2 right-2">
          <Skeleton className="w-2 h-2 rounded-full" />
        </div>
      </div>
      
      {/* 정보 영역 */}
      <div className="p-3 space-y-2">
        {/* 제목 */}
        <Skeleton className="h-4 w-3/4" />
        
        {/* 메타 정보 */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  );
}

// 🎨 프로젝트 그리드 스켈레톤 (12개)
export function ProjectGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProjectCardSkeleton key={i} />
      ))}
    </div>
  );
}

// 💾 스토리지 바 스켈레톤
export function StorageBarSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
      <div className="space-y-3">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        
        {/* 프로그레스 바 */}
        <div className="space-y-2">
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    </div>
  );
}

// 👤 사용자 정보 스켈레톤
export function UserInfoSkeleton() {
  return (
    <div className="flex items-center space-x-3">
      <Skeleton className="w-8 h-8 rounded-full" />
      <div className="space-y-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

// 🎯 Canva 스타일 전체 대시보드 스켈레톤
export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 헤더 영역 */}
      <div className="bg-white dark:bg-gray-800 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Skeleton className="w-32 h-6" /> {/* 로고/제목 */}
            </div>
            <UserInfoSkeleton />
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* 상단 액션 바 */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" /> {/* "내 프로젝트" 제목 */}
            <div className="flex space-x-3">
              <Skeleton className="w-24 h-9 rounded-md" /> {/* 정렬 버튼 */}
              <Skeleton className="w-32 h-9 rounded-md" /> {/* 새 프로젝트 버튼 */}
            </div>
          </div>

          {/* 스토리지 사용량 */}
          <StorageBarSkeleton />

          {/* 프로젝트 그리드 */}
          <ProjectGridSkeleton count={12} />
        </div>
      </div>
    </div>
  );
}

// ⚡ 로딩 스피너 with 메시지
export function LoadingSpinner({ 
  message = "로딩 중...",
  subMessage 
}: {
  message?: string;
  subMessage?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      {/* Canva 스타일 스피너 */}
      <div className="relative">
        <div className="w-12 h-12 border-4 border-gray-200 dark:border-gray-700 rounded-full animate-spin"></div>
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
      </div>
      
      {/* 메시지 */}
      <div className="text-center">
        <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
          {message}
        </p>
        {subMessage && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {subMessage}
          </p>
        )}
      </div>
    </div>
  );
}

// 🎊 성공 애니메이션
export function SuccessAnimation({ 
  message = "완료!",
  onComplete 
}: {
  message?: string;
  onComplete?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      {/* 체크 아이콘 애니메이션 */}
      <div className="relative">
        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center animate-[bounce_0.5s_ease-in-out]">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        {/* 원형 효과 */}
        <div className="absolute inset-0 w-16 h-16 border-4 border-green-200 rounded-full animate-ping"></div>
      </div>
      
      <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
        {message}
      </p>
    </div>
  );
}

/* 🎨 Tailwind CSS 커스텀 애니메이션 (tailwind.config.js에 추가 필요) */
/*
module.exports = {
  theme: {
    extend: {
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      },
      animation: {
        shimmer: 'shimmer 2s infinite',
      }
    }
  }
}
*/