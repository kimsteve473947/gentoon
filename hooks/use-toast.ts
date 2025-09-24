import { useState, useCallback } from 'react';

type ToastType = 'default' | 'destructive' | 'success';

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastType;
  duration?: number;
}

interface ToastProps {
  title?: string;
  description?: string;
  variant?: ToastType;
  duration?: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(({ title, description, variant = 'default', duration = 5000 }: ToastProps) => {
    const id = Math.random().toString(36).substr(2, 9);
    const toast: Toast = { id, title, description, variant, duration };
    
    setToasts((prev) => [...prev, toast]);

    // Auto remove toast after duration
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((props: ToastProps) => {
    return addToast(props);
  }, [addToast]);

  return {
    toast,
    toasts,
    removeToast,
  };
}