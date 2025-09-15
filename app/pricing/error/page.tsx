'use client';

import { Suspense } from 'react';
import BillingErrorContent from './components/BillingErrorContent';

export default function BillingErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">💳</div>
        <p className="text-gray-600">결제 오류 페이지를 로딩 중...</p>
      </div>
    </div>}>
      <BillingErrorContent />
    </Suspense>
  );
}