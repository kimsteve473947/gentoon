"use client";

import dynamic from 'next/dynamic';
import { Sparkles } from 'lucide-react';

const LoadingStudio = () => (
  <div className="h-screen w-full flex items-center justify-center bg-slate-50">
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-white animate-pulse" />
        </div>
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl opacity-20 animate-pulse" />
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          GenToon 스튜디오
        </p>
        <p className="text-sm text-slate-500 mt-1">프로 에디터를 불러오는 중...</p>
      </div>
    </div>
  </div>
);

export const MiriCanvasStudioProDynamic = dynamic(
  () => import('./MiriCanvasStudioPro').then(mod => ({ default: mod.MiriCanvasStudioPro })),
  {
    loading: () => <LoadingStudio />,
    ssr: false,
  }
);