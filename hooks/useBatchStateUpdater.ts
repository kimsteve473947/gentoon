import { useCallback, useRef, useState } from 'react';

interface BatchUpdate<T> {
  id: string;
  updates: Partial<T>;
  timestamp: number;
}

interface UseBatchStateUpdaterOptions {
  batchDelay?: number; // 배치 처리 지연시간 (ms)
  maxBatchSize?: number; // 최대 배치 크기
}

// 상태 업데이트를 배치 처리하여 성능 최적화
export function useBatchStateUpdater<T extends { id: string }>(
  items: T[],
  setItems: (items: T[]) => void,
  options: UseBatchStateUpdaterOptions = {}
) {
  const {
    batchDelay = 50,
    maxBatchSize = 100
  } = options;

  const pendingUpdatesRef = useRef<Map<string, BatchUpdate<T>>>(new Map());
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 배치 업데이트 실행
  const processBatch = useCallback(() => {
    if (pendingUpdatesRef.current.size === 0) return;

    setIsProcessing(true);
    
    const updates = Array.from(pendingUpdatesRef.current.values())
      .sort((a, b) => a.timestamp - b.timestamp) // 시간순 정렬
      .slice(0, maxBatchSize); // 최대 크기 제한

    // 일괄 업데이트 적용
    const updatedItems = items.map(item => {
      const update = pendingUpdatesRef.current.get(item.id);
      if (update) {
        pendingUpdatesRef.current.delete(item.id);
        return { ...item, ...update.updates };
      }
      return item;
    });

    setItems(updatedItems);
    setIsProcessing(false);

    // 남은 업데이트가 있으면 다시 스케줄링
    if (pendingUpdatesRef.current.size > 0) {
      batchTimeoutRef.current = setTimeout(processBatch, batchDelay);
    }
  }, [items, setItems, maxBatchSize, batchDelay]);

  // 단일 아이템 업데이트 스케줄링
  const scheduleUpdate = useCallback((id: string, updates: Partial<T>) => {
    // 기존 업데이트와 병합
    const existingUpdate = pendingUpdatesRef.current.get(id);
    const mergedUpdates = existingUpdate 
      ? { ...existingUpdate.updates, ...updates }
      : updates;

    pendingUpdatesRef.current.set(id, {
      id,
      updates: mergedUpdates,
      timestamp: Date.now()
    });

    // 배치 타이머 설정
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    
    batchTimeoutRef.current = setTimeout(processBatch, batchDelay);
  }, [processBatch, batchDelay]);

  // 배치 업데이트 스케줄링 (여러 아이템 동시)
  const scheduleBatchUpdate = useCallback((updates: Array<{ id: string; updates: Partial<T> }>) => {
    const timestamp = Date.now();
    
    updates.forEach(({ id, updates: itemUpdates }) => {
      const existingUpdate = pendingUpdatesRef.current.get(id);
      const mergedUpdates = existingUpdate 
        ? { ...existingUpdate.updates, ...itemUpdates }
        : itemUpdates;

      pendingUpdatesRef.current.set(id, {
        id,
        updates: mergedUpdates,
        timestamp
      });
    });

    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    
    batchTimeoutRef.current = setTimeout(processBatch, batchDelay);
  }, [processBatch, batchDelay]);

  // 즉시 업데이트 (배치 무시)
  const updateImmediately = useCallback((id: string, updates: Partial<T>) => {
    // 보류 중인 업데이트 제거
    pendingUpdatesRef.current.delete(id);
    
    const updatedItems = items.map(item => 
      item.id === id ? { ...item, ...updates } : item
    );
    
    setItems(updatedItems);
  }, [items, setItems]);

  // 보류 중인 업데이트 강제 플러시
  const flushUpdates = useCallback(() => {
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
    processBatch();
  }, [processBatch]);

  // 보류 중인 업데이트 취소
  const cancelPendingUpdates = useCallback(() => {
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
    pendingUpdatesRef.current.clear();
  }, []);

  // 정리
  const cleanup = useCallback(() => {
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
  }, []);

  return {
    scheduleUpdate,
    scheduleBatchUpdate,
    updateImmediately,
    flushUpdates,
    cancelPendingUpdates,
    cleanup,
    isProcessing,
    pendingCount: pendingUpdatesRef.current.size
  };
}