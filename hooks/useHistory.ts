import { useState, useCallback, useRef, useEffect } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UseHistoryOptions {
  limit?: number; // 최대 히스토리 개수 (기본값: 50)
}

export function useHistory<T>(
  initialState: T,
  options: UseHistoryOptions = {}
) {
  const { limit = 50 } = options;
  
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: []
  });

  // 현재 상태 참조 (최적화를 위해)
  const historyRef = useRef(history);
  historyRef.current = history;

  // 상태 업데이트 (새로운 액션 추가)
  const push = useCallback((newState: T | ((prev: T) => T)) => {
    setHistory(prev => {
      const nextState = typeof newState === 'function' 
        ? (newState as (prev: T) => T)(prev.present)
        : newState;

      // 동일한 상태면 무시
      if (JSON.stringify(nextState) === JSON.stringify(prev.present)) {
        return prev;
      }

      // 새로운 히스토리 생성
      const newPast = [...prev.past, prev.present];
      
      // limit 적용 (과거 히스토리 제한)
      const limitedPast = newPast.length > limit 
        ? newPast.slice(newPast.length - limit)
        : newPast;

      return {
        past: limitedPast,
        present: nextState,
        future: [] // 새로운 액션 시 미래 히스토리 초기화
      };
    });
  }, [limit]);

  // 실행 취소 (Undo)
  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.past.length === 0) {
        return prev; // 과거가 없으면 무시
      }

      const previous = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, prev.past.length - 1);

      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future]
      };
    });
  }, []);

  // 다시 실행 (Redo)
  const redo = useCallback(() => {
    setHistory(prev => {
      if (prev.future.length === 0) {
        return prev; // 미래가 없으면 무시
      }

      const next = prev.future[0];
      const newFuture = prev.future.slice(1);

      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture
      };
    });
  }, []);

  // 히스토리 초기화
  const reset = useCallback((newState?: T) => {
    setHistory({
      past: [],
      present: newState || initialState,
      future: []
    });
  }, [initialState]);

  // 특정 지점으로 이동
  const jumpTo = useCallback((index: number) => {
    setHistory(prev => {
      const allStates = [...prev.past, prev.present, ...prev.future];
      
      if (index < 0 || index >= allStates.length) {
        return prev; // 유효하지 않은 인덱스
      }

      return {
        past: allStates.slice(0, index),
        present: allStates[index],
        future: allStates.slice(index + 1)
      };
    });
  }, []);

  // 현재 상태를 직접 설정 (히스토리에 추가하지 않음)
  const set = useCallback((newState: T | ((prev: T) => T)) => {
    setHistory(prev => ({
      ...prev,
      present: typeof newState === 'function' 
        ? (newState as (prev: T) => T)(prev.present)
        : newState
    }));
  }, []);

  // 키보드 단축키 지원
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z (Undo)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl+Y or Cmd+Shift+Z (Redo)
      else if ((e.ctrlKey && e.key === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    // 현재 상태
    state: history.present,
    setState: push,
    
    // 히스토리 조작
    undo,
    redo,
    reset,
    jumpTo,
    set,
    
    // 히스토리 정보
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    historyLength: history.past.length,
    futureLength: history.future.length,
    
    // 전체 히스토리 (디버깅용)
    history: process.env.NODE_ENV === 'development' ? history : undefined
  };
}

// 배치 업데이트를 위한 래퍼
export function useBatchHistory<T>(
  initialState: T,
  options: UseHistoryOptions = {}
) {
  const historyHook = useHistory(initialState, options);
  const batchRef = useRef<T | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 배치 시작
  const startBatch = useCallback(() => {
    batchRef.current = historyHook.state;
  }, [historyHook.state]);

  // 배치 종료 및 커밋
  const commitBatch = useCallback(() => {
    if (batchRef.current !== null) {
      historyHook.setState(batchRef.current);
      batchRef.current = null;
    }
  }, [historyHook.setState]);

  // 자동 배치 (디바운스)
  const setStateDebounced = useCallback((newState: T | ((prev: T) => T)) => {
    // 즉시 상태 업데이트 (UI 반영)
    historyHook.set(newState);
    
    // 디바운스 타이머 리셋
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // 300ms 후 히스토리에 추가
    timeoutRef.current = setTimeout(() => {
      historyHook.setState(
        typeof newState === 'function' 
          ? (newState as (prev: T) => T)(historyHook.state)
          : newState
      );
    }, 300);
  }, [historyHook]);

  // 클린업
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    ...historyHook,
    startBatch,
    commitBatch,
    setStateDebounced
  };
}