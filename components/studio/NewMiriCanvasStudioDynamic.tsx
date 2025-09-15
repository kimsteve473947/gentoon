"use client";

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// 로딩 컴포넌트
const LoadingStudio = () => (
  <div className="h-screen w-full flex items-center justify-center bg-gray-50">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <p className="text-sm text-gray-600">스튜디오를 불러오는 중...</p>
    </div>
  </div>
);

// 동적 임포트 - SSR 비활성화로 hydration 문제 방지
export const NewMiriCanvasStudioDynamic = dynamic(
  () => import('./NewMiriCanvasStudio').then(mod => ({ default: mod.NewMiriCanvasStudio })),
  {
    loading: () => <LoadingStudio />,
    ssr: false,
  }
);