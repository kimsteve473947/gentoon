'use client';

import { Suspense } from 'react';
import BillingSuccessContent from './components/BillingSuccessContent';

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">✅</div>
        <p className="text-gray-600">결제 성공 페이지를 로딩 중...</p>
      </div>
    </div>}>
      <BillingSuccessContent />
    </Suspense>
  );
}