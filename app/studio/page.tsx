'use client';

import { Suspense } from 'react';
import StudioContent from './components/StudioContent';

export const dynamic = 'force-dynamic';

export default function StudioPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Studio Layout Skeleton */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <div className="h-8 w-32 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-6 w-px bg-gray-300"></div>
            <div className="h-8 w-40 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>

        {/* Toolbar Skeleton */}
        <div className="h-12 bg-white border-b border-gray-200 flex items-center px-6 space-x-4">
          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-6 w-px bg-gray-300"></div>
          <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-6 w-px bg-gray-300"></div>
          <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
        </div>

        {/* Main Content Skeleton */}
        <div className="flex-1 flex">
          {/* Sidebar Skeleton */}
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-3"></div>
              <div className="space-y-2">
                <div className="h-8 w-full bg-gray-200 rounded animate-pulse"></div>
                <div className="h-8 w-3/4 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-8 w-2/3 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
            <div className="p-4 border-b border-gray-200">
              <div className="h-6 w-24 bg-gray-200 rounded animate-pulse mb-3"></div>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-gray-200 rounded animate-pulse"></div>
                ))}
              </div>
            </div>
            <div className="p-4">
              <div className="h-6 w-28 bg-gray-200 rounded animate-pulse mb-3"></div>
              <div className="space-y-2">
                <div className="h-16 w-full bg-gray-200 rounded animate-pulse"></div>
                <div className="h-16 w-full bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Canvas Area Skeleton */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 bg-gray-100 flex items-center justify-center p-8">
              <div className="w-full max-w-3xl aspect-[4/5] bg-white rounded-lg shadow-lg border border-gray-200 p-6">
                <div className="grid grid-cols-1 gap-4 h-full">
                  <div className="bg-gray-200 rounded animate-pulse"></div>
                  <div className="bg-gray-200 rounded animate-pulse"></div>
                  <div className="bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* Panel Controls Skeleton */}
            <div className="h-32 bg-white border-t border-gray-200 p-4">
              <div className="flex items-center justify-center space-x-4">
                <div className="h-20 w-20 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-20 w-20 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-20 w-20 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    }>
      <StudioContent />
    </Suspense>
  );
}