export interface CanvasRatio {
  '1:1': { width: number, height: number }
  '4:5': { width: number, height: number }
}

export const CANVAS_DIMENSIONS: CanvasRatio = {
  '1:1': { width: 1024, height: 1024 },
  '4:5': { width: 896, height: 1115 }  // 4:5 비율 (896 × 1115)
}

export async function resizeImageToCanvas(
  imageUrl: string, 
  canvasRatio: keyof CanvasRatio
): Promise<string> {
  console.log('🔥 클라이언트 리사이징 함수 호출됨:', { imageUrl: imageUrl.slice(0, 50) + '...', canvasRatio });
  
  return new Promise((resolve, reject) => {
    const img = new Image()
    // base64 데이터 URL인 경우 crossOrigin 설정하지 않음
    if (!imageUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous'
    }
    
    img.onload = () => {
      try {
        const targetDimensions = CANVAS_DIMENSIONS[canvasRatio];
        if (!targetDimensions) {
          throw new Error(`지원하지 않는 캔버스 비율: ${canvasRatio}`);
        }
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Canvas context를 생성할 수 없습니다');
        }
        
        // 이미지 크기 검증
        if (img.width <= 0 || img.height <= 0) {
          throw new Error('유효하지 않은 이미지 크기');
        }
        
        canvas.width = targetDimensions.width
        canvas.height = targetDimensions.height
        
        console.log(`📏 원본 이미지 크기: ${img.width}x${img.height}`);
        console.log(`🎯 목표 캔버스 크기: ${targetDimensions.width}x${targetDimensions.height}`);
        
        // 이미지를 캔버스에 맞게 리사이징 (object-contain 방식 - 비율 유지하면서 전체 표시)
        const imgAspect = img.width / img.height
        const canvasAspect = targetDimensions.width / targetDimensions.height
        
        console.log(`📐 종횡비 비교 - 이미지: ${imgAspect.toFixed(3)}, 캔버스: ${canvasAspect.toFixed(3)}`);
        
        let drawWidth = targetDimensions.width
        let drawHeight = targetDimensions.height
        let offsetX = 0
        let offsetY = 0
        
        if (imgAspect > canvasAspect) {
          // 이미지가 더 넓음 - 너비에 맞추고 위아래 여백 추가
          drawHeight = targetDimensions.width / imgAspect
          offsetY = (targetDimensions.height - drawHeight) / 2
        } else {
          // 이미지가 더 높음 - 높이에 맞추고 좌우 여백 추가
          drawWidth = targetDimensions.height * imgAspect
          offsetX = (targetDimensions.width - drawWidth) / 2
        }
        
        console.log(`🔧 그리기 설정 - 크기: ${drawWidth.toFixed(1)}x${drawHeight.toFixed(1)}, 오프셋: (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`);
        
        // 흰색 배경으로 채우기 (여백 부분)
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, targetDimensions.width, targetDimensions.height)
        
        // 이미지 그리기 (object-contain 스타일 - 전체 이미지가 보이도록)
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
        
        // WebP 포맷으로 압축 출력
        const resizedDataUrl = canvas.toDataURL('image/webp', 0.9)
        console.log(`✅ 클라이언트 리사이징 완료: ${img.width}x${img.height} → ${targetDimensions.width}x${targetDimensions.height}`);
        resolve(resizedDataUrl)
      } catch (error) {
        reject(error)
      }
    }
    
    img.onerror = () => {
      reject(new Error('이미지 로딩 실패'))
    }
    
    img.src = imageUrl
  })
}