import { useState, useEffect } from 'react';

// 디바운스 훅 - 빈번한 상태 업데이트를 배치 처리
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// 배치 업데이트를 위한 훅
export function useBatchUpdate<T>(initialValue: T, delay: number = 300) {
  const [value, setValue] = useState<T>(initialValue);
  const [pendingValue, setPendingValue] = useState<T>(initialValue);
  const debouncedValue = useDebounce(pendingValue, delay);

  useEffect(() => {
    if (debouncedValue !== value) {
      setValue(debouncedValue);
    }
  }, [debouncedValue, value]);

  return [value, setPendingValue] as const;
}