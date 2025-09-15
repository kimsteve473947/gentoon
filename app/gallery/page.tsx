"use client";

import { Suspense } from 'react';
import GalleryContent from './components/GalleryContent';

export default function GalleryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🎨</div>
        <p className="text-gray-600">갤러리를 로딩 중...</p>
      </div>
    </div>}>
      <GalleryContent />
    </Suspense>
  );
}