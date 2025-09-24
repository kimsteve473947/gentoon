'use client';

import React, { memo, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
  className?: string;
}

const toastConfig = {
  success: {
    icon: CheckCircle2,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800',
    iconColor: 'text-green-600',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
    iconColor: 'text-red-600',
  },
  warning: {
    icon: AlertCircle,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-800',
    iconColor: 'text-yellow-600',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    iconColor: 'text-blue-600',
  },
} as const;

/**
 * 재사용 가능한 토스트 컴포넌트
 * 성공, 에러, 경고, 정보 메시지를 표시합니다.
 */
export const Toast = memo<ToastProps>(({ 
  message, 
  type = 'success', 
  duration = 3000, 
  onClose, 
  className 
}) => {
  const config = toastConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [onClose, duration]);

  return (
    <div className={cn(
      "fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 min-w-[300px] max-w-[500px]",
      className
    )}>
      <div className={cn(
        "rounded-lg p-4 flex items-center gap-3 shadow-lg",
        config.bgColor,
        config.borderColor,
        "border"
      )}>
        <Icon className={cn("h-5 w-5 flex-shrink-0", config.iconColor)} />
        <span className={cn("text-sm font-medium flex-1", config.textColor)}>
          {message}
        </span>
        <button
          onClick={onClose}
          className={cn("flex-shrink-0 hover:opacity-70 transition-opacity", config.iconColor)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

Toast.displayName = 'Toast';

/**
 * 토스트 관리를 위한 훅
 */
export function useToast() {
  const [toasts, setToasts] = React.useState<Array<{
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
  }>>([]);

  const showToast = React.useCallback((message: string, type: ToastType = 'success', duration?: number) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const hideToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const ToastContainer = React.useMemo(() => {
    return () => (
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            style={{ transform: `translateY(${index * 60}px)` }}
            className="transition-transform duration-200"
          >
            <Toast
              message={toast.message}
              type={toast.type}
              duration={toast.duration}
              onClose={() => hideToast(toast.id)}
            />
          </div>
        ))}
      </div>
    );
  }, [toasts, hideToast]);

  return {
    showToast,
    showSuccess: (message: string, duration?: number) => showToast(message, 'success', duration),
    showError: (message: string, duration?: number) => showToast(message, 'error', duration),
    showWarning: (message: string, duration?: number) => showToast(message, 'warning', duration),
    showInfo: (message: string, duration?: number) => showToast(message, 'info', duration),
    ToastContainer,
  };
}