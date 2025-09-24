'use client';

import React, { memo } from 'react';
import { cn } from '@/lib/utils';

export interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  className?: string;
  backdropClassName?: string;
  spinnerClassName?: string;
  variant?: 'default' | 'card' | 'fullscreen';
}

/**
 * 재사용 가능한 로딩 오버레이 컴포넌트
 * 다양한 로딩 상태를 표시합니다.
 */
export const LoadingOverlay = memo<LoadingOverlayProps>(({ 
  isVisible, 
  message = "로딩 중...",
  className,
  backdropClassName,
  spinnerClassName,
  variant = 'default'
}) => {
  if (!isVisible) return null;

  const variants = {
    default: {
      container: "absolute inset-0 bg-black/20 flex items-center justify-center z-20",
      content: "bg-white rounded-lg p-4 shadow-lg flex flex-col items-center gap-3",
      spinner: "w-6 h-6 border-2 border-purple-600 border-t-transparent",
      text: "text-sm font-medium text-gray-700"
    },
    card: {
      container: "absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-20",
      content: "bg-white/90 rounded-lg p-3 shadow-sm flex items-center gap-2",
      spinner: "w-5 h-5 border-2 border-purple-600 border-t-transparent",
      text: "text-sm font-medium text-gray-600"
    },
    fullscreen: {
      container: "fixed inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50",
      content: "bg-white rounded-xl p-6 shadow-lg flex flex-col items-center gap-4",
      spinner: "w-8 h-8 border-3 border-purple-600 border-t-transparent",
      text: "text-base font-medium text-gray-700"
    }
  };

  const variantConfig = variants[variant];

  return (
    <div className={cn(variantConfig.container, backdropClassName, className)}>
      <div className={cn(variantConfig.content)}>
        <div 
          className={cn(
            "animate-spin rounded-full",
            variantConfig.spinner,
            spinnerClassName
          )}
        />
        {message && (
          <span className={cn(variantConfig.text)}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
});

LoadingOverlay.displayName = 'LoadingOverlay';

/**
 * 간단한 스피너 컴포넌트
 */
export const Spinner = memo<{
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}>(({ size = 'md', className }) => {
  const sizes = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2", 
    lg: "w-8 h-8 border-3"
  };

  return (
    <div className={cn(
      "animate-spin rounded-full border-purple-600 border-t-transparent",
      sizes[size],
      className
    )} />
  );
});

Spinner.displayName = 'Spinner';

/**
 * 로딩 상태 관리를 위한 훅
 */
export function useLoading(initialState: boolean = false) {
  const [isLoading, setIsLoading] = React.useState(initialState);
  const [message, setMessage] = React.useState<string>();

  const startLoading = React.useCallback((loadingMessage?: string) => {
    setMessage(loadingMessage);
    setIsLoading(true);
  }, []);

  const stopLoading = React.useCallback(() => {
    setIsLoading(false);
    setMessage(undefined);
  }, []);

  const withLoading = React.useCallback(async <T,>(
    asyncOperation: () => Promise<T>,
    loadingMessage?: string
  ): Promise<T> => {
    startLoading(loadingMessage);
    try {
      const result = await asyncOperation();
      return result;
    } finally {
      stopLoading();
    }
  }, [startLoading, stopLoading]);

  return {
    isLoading,
    message,
    startLoading,
    stopLoading,
    withLoading,
  };
}