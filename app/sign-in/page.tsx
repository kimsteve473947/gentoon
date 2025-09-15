'use client'

import { Suspense } from 'react'
import SignInContent from './components/SignInContent';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🔐</div>
        <p className="text-gray-600">로그인 페이지를 로딩 중...</p>
      </div>
    </div>}>
      <SignInContent />
    </Suspense>
  );
}