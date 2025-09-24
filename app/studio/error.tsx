"use client";

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 에러 로깅 (프로덕션에서는 Sentry 등으로 전송)
    console.error('Studio Error:', error);
  }, [error]);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              스튜디오 로딩 오류
            </h2>
          </div>
          
          <p className="text-sm text-gray-600 mb-6">
            스튜디오를 불러오는 중 문제가 발생했습니다. 
            잠시 후 다시 시도해주세요.
          </p>

          <div className="flex gap-3">
            <Button 
              onClick={reset}
              className="flex-1"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              다시 시도
            </Button>
            <Button 
              variant="outline"
              onClick={() => window.location.href = '/dashboard'}
              className="flex-1"
            >
              대시보드로 이동
            </Button>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4 p-3 bg-gray-50 rounded text-xs">
              <summary className="cursor-pointer text-gray-600">
                개발자 정보
              </summary>
              <pre className="mt-2 whitespace-pre-wrap text-gray-500">
                {error.message}
                {error.digest && `\nDigest: ${error.digest}`}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}