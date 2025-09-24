import React, { useCallback, useRef } from 'react';
import { CanvasElement, WebtoonCut } from '@/types/studio';

interface SimpleDragSystemProps {
  element: CanvasElement;
  cutId: string;
  cuts: WebtoonCut[];
  setCuts: (cuts: WebtoonCut[] | ((prev: WebtoonCut[]) => WebtoonCut[])) => void;
  pushHistory: (state: { cuts: WebtoonCut[] }) => void;
  setHasUnsavedChanges: (value: boolean) => void;
  canvasSize: { width: number; height: number };
  zoom: number;
  onSelect?: (elementId: string) => void;
  children: React.ReactNode;
}

/**
 * 간단하고 안정적인 드래그 시스템
 * - tempCuts 없이 즉시 상태 업데이트
 * - 복잡한 좌표 변환 없이 간단한 계산
 * - 명확한 이벤트 핸들링
 */
export const SimpleDragSystem: React.FC<SimpleDragSystemProps> = ({
  element,
  cutId,
  cuts,
  setCuts,
  pushHistory,
  setHasUnsavedChanges,
  canvasSize,
  zoom,
  onSelect,
  children
}) => {
  const dragState = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    originalX: number;
    originalY: number;
    hasMoved: boolean;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    originalX: 0,
    originalY: 0,
    hasMoved: false
  });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (element.type === 'image') return;
    
    e.preventDefault();
    e.stopPropagation();
    
    onSelect?.(element.id);
    
    dragState.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      originalX: element.x,
      originalY: element.y,
      hasMoved: false
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragState.current.isDragging) return;
      
      const deltaX = moveEvent.clientX - dragState.current.startX;
      const deltaY = moveEvent.clientY - dragState.current.startY;
      
      // 최소 이동 감지
      if (!dragState.current.hasMoved && Math.abs(deltaX) + Math.abs(deltaY) < 3) {
        return;
      }
      
      dragState.current.hasMoved = true;
      
      // 간단한 위치 계산 (화면 좌표를 캔버스 좌표로 변환)
      const scale = zoom / 100;
      const newX = Math.max(0, Math.min(
        dragState.current.originalX + deltaX / scale,
        canvasSize.width - element.width
      ));
      const newY = Math.max(0, Math.min(
        dragState.current.originalY + deltaY / scale,
        canvasSize.height - element.height
      ));
      
      // 즉시 상태 업데이트
      setCuts(prevCuts => prevCuts.map(cut => 
        cut.id === cutId ? {
          ...cut,
          elements: cut.elements.map(el => 
            el.id === element.id ? { ...el, x: newX, y: newY } : el
          )
        } : cut
      ));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      if (dragState.current.hasMoved) {
        // 히스토리에 저장
        pushHistory({ cuts });
        setHasUnsavedChanges(true);
      }
      
      dragState.current.isDragging = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [element, cutId, cuts, setCuts, pushHistory, setHasUnsavedChanges, canvasSize, zoom, onSelect]);

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        cursor: dragState.current.isDragging ? 'grabbing' : 'grab',
        userSelect: 'none'
      }}
    >
      {children}
    </div>
  );
};