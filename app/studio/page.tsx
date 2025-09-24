'use client';

import { Suspense } from 'react';
import StudioContent from './components/StudioContent';

export const dynamic = 'force-dynamic';

export default function StudioPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white">
        {/* 🚀 간소화된 스튜디오 로딩 스켈레톤 */}
        {/* 헤더 영역 */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-purple-500 rounded-lg"></div>
              <div className="h-6 bg-gray-200 rounded animate-pulse w-20"></div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-8 bg-gray-200 rounded animate-pulse w-16"></div>
              <div className="h-8 bg-gray-200 rounded animate-pulse w-20"></div>
              <div className="h-8 bg-purple-200 rounded animate-pulse w-24"></div>
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* 툴바 영역 */}
        <div className="border-b border-gray-200 px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="h-8 bg-purple-200 rounded animate-pulse w-24"></div>
            <div className="w-px h-6 bg-gray-300"></div>
            <div className="h-8 bg-gray-200 rounded animate-pulse w-20"></div>
            <div className="w-px h-6 bg-gray-300"></div>
            <div className="h-8 bg-gray-200 rounded animate-pulse w-28"></div>
            <div className="flex-1"></div>
            <div className="h-8 bg-gray-200 rounded animate-pulse w-20"></div>
            <div className="h-8 bg-purple-200 rounded animate-pulse w-32"></div>
          </div>
        </div>

        {/* 메인 컨텐츠 영역 */}
        <div className="flex h-screen">
          {/* 사이드바 */}
          <div className="w-80 border-r border-gray-200 p-4">
            <div className="space-y-4">
              <div className="h-6 bg-gray-200 rounded animate-pulse w-24"></div>
              <div className="space-y-2">
                <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* 캔버스 영역 */}
          <div className="flex-1 bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-6"></div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">스튜디오 로딩 중...</h3>
              <p className="text-gray-500">잠시만 기다려주세요</p>
            </div>
          </div>

          {/* 우측 패널 */}
          <div className="w-96 border-l border-gray-200 p-4">
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-6 h-6 bg-orange-200 rounded animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-16"></div>
                  </div>
                  <div className="w-full h-40 bg-purple-100 rounded-lg animate-pulse mb-3"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-full"></div>
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    }>
      <StudioContent />
    </Suspense>
  );
}