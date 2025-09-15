"use client";

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { type CanvasRatio } from '@/types/editor';

// Canvas 기반 에디터를 동적으로 로드 (SSR 비활성화)
const WebtoonEditor = dynamic(
  () => import('./WebtoonStudio').then(mod => mod.WebtoonStudio),
  { 
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-sm text-gray-600">웹툰 에디터를 불러오는 중...</p>
        </div>
      </div>
    )
  }
);

interface WebtoonEditorDynamicProps {
  panelId: string;
  backgroundImage?: string;
  canvasRatio: CanvasRatio;
  onSave?: (state: any) => void;
}

export function WebtoonEditorDynamic(props: WebtoonEditorDynamicProps) {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-sm text-gray-600">준비 중...</p>
        </div>
      </div>
    }>
      <WebtoonEditor {...props} />
    </Suspense>
  );
}