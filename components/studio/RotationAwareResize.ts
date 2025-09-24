// 🔄 회전을 고려한 완벽한 리사이즈 로직

export interface ResizeParams {
  clientX: number;
  clientY: number;
  startX: number;
  startY: number;
  element: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
  };
  handle: string;
  zoom: number;
  maintainAspectRatio?: boolean;
}

export const calculateRotatedResize = ({
  clientX,
  clientY,
  startX,
  startY,
  element,
  handle,
  zoom,
  maintainAspectRatio = false
}: ResizeParams) => {
  const deltaX = clientX - startX;
  const deltaY = clientY - startY;
  
  // 줌 레벨에 따른 스케일 보정
  const scale = zoom / 100;
  const scaledDeltaX = deltaX / scale;
  const scaledDeltaY = deltaY / scale;
  
  const rotation = element.rotation || 0;
  const originalWidth = element.width;
  const originalHeight = element.height;
  const originalX = element.x;
  const originalY = element.y;
  const originalAspectRatio = originalWidth / originalHeight;
  
  // 🔄 회전 각도를 라디안으로 변환
  const rotationRad = (rotation * Math.PI) / 180;
  const cos = Math.cos(-rotationRad); // 역회전
  const sin = Math.sin(-rotationRad);
  
  // 📍 요소의 중심점 계산
  const centerX = originalX + originalWidth / 2;
  const centerY = originalY + originalHeight / 2;
  
  // 🔄 회전된 요소의 로컬 좌표계로 변환
  const localDeltaX = scaledDeltaX * cos - scaledDeltaY * sin;
  const localDeltaY = scaledDeltaX * sin + scaledDeltaY * cos;
  
  let newWidth = originalWidth;
  let newHeight = originalHeight;
  let offsetX = 0;
  let offsetY = 0;
  
  // 핸들별 리사이즈 로직 (로컬 좌표계 기준)
  if (maintainAspectRatio && ['nw', 'ne', 'sw', 'se'].includes(handle)) {
    // 🔒 비율 유지 모드 - 대각선 핸들만 적용
    const deltaAmount = Math.abs(localDeltaX) > Math.abs(localDeltaY) ? localDeltaX : localDeltaY;
    
    switch (handle) {
      case 'nw': // 왼쪽 위
        newWidth = Math.max(10, originalWidth - deltaAmount);
        newHeight = Math.max(10, newWidth / originalAspectRatio);
        offsetX = deltaAmount / 2;
        offsetY = (originalHeight - newHeight) / 2;
        break;
        
      case 'ne': // 오른쪽 위  
        newWidth = Math.max(10, originalWidth + deltaAmount);
        newHeight = Math.max(10, newWidth / originalAspectRatio);
        offsetX = deltaAmount / 2;
        offsetY = (originalHeight - newHeight) / 2;
        break;
        
      case 'sw': // 왼쪽 아래
        newWidth = Math.max(10, originalWidth - deltaAmount);
        newHeight = Math.max(10, newWidth / originalAspectRatio);
        offsetX = deltaAmount / 2;
        offsetY = -(newHeight - originalHeight) / 2;
        break;
        
      case 'se': // 오른쪽 아래
        newWidth = Math.max(10, originalWidth + deltaAmount);
        newHeight = Math.max(10, newWidth / originalAspectRatio);
        offsetX = deltaAmount / 2;
        offsetY = -(newHeight - originalHeight) / 2;
        break;
    }
  } else {
    // 🔓 일반 리사이즈 모드
    switch (handle) {
      case 'nw': // 왼쪽 위
        newWidth = Math.max(10, originalWidth - localDeltaX);
        newHeight = Math.max(10, originalHeight - localDeltaY);
        offsetX = localDeltaX / 2;
        offsetY = localDeltaY / 2;
        break;
        
      case 'ne': // 오른쪽 위
        newWidth = Math.max(10, originalWidth + localDeltaX);
        newHeight = Math.max(10, originalHeight - localDeltaY);
        offsetX = localDeltaX / 2;
        offsetY = localDeltaY / 2;
        break;
        
      case 'sw': // 왼쪽 아래
        newWidth = Math.max(10, originalWidth - localDeltaX);
        newHeight = Math.max(10, originalHeight + localDeltaY);
        offsetX = localDeltaX / 2;
        offsetY = localDeltaY / 2;
        break;
        
      case 'se': // 오른쪽 아래
        newWidth = Math.max(10, originalWidth + localDeltaX);
        newHeight = Math.max(10, originalHeight + localDeltaY);
        offsetX = localDeltaX / 2;
        offsetY = localDeltaY / 2;
        break;
        
      case 'n': // 위쪽
        newHeight = Math.max(10, originalHeight - localDeltaY);
        offsetY = localDeltaY / 2;
        break;
        
      case 's': // 아래쪽
        newHeight = Math.max(10, originalHeight + localDeltaY);
        offsetY = localDeltaY / 2;
        break;
        
      case 'w': // 왼쪽
        newWidth = Math.max(10, originalWidth - localDeltaX);
        offsetX = localDeltaX / 2;
        break;
        
      case 'e': // 오른쪽
        newWidth = Math.max(10, originalWidth + localDeltaX);
        offsetX = localDeltaX / 2;
        break;
    }
  }
  
  // 🔄 중심점 기준으로 새로운 위치 계산 (회전 고려)
  const rotatedOffsetX = offsetX * cos + offsetY * sin;
  const rotatedOffsetY = -offsetX * sin + offsetY * cos;
  
  const newX = centerX - newWidth / 2 + rotatedOffsetX;
  const newY = centerY - newHeight / 2 + rotatedOffsetY;
  
  return {
    width: newWidth,
    height: newHeight,
    x: newX,
    y: newY,
    debug: {
      rotation: rotation.toFixed(1),
      localDelta: `${localDeltaX.toFixed(1)}, ${localDeltaY.toFixed(1)}`,
      newSize: `${newWidth.toFixed(1)} x ${newHeight.toFixed(1)}`,
      newPos: `${newX.toFixed(1)}, ${newY.toFixed(1)}`
    }
  };
};