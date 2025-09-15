/**
 * 이미지를 지정된 비율에 맞게 조정하고 배경을 추가하는 유틸리티
 */

export interface ResizeOptions {
  targetRatio: number; // 예: 4/5 = 0.8
  backgroundColor?: string; // 기본값: 'white'
  maxWidth?: number; // 최대 너비 (기본값: 1080)
  quality?: number; // 이미지 품질 (기본값: 0.9)
}

/**
 * 이미지 파일을 캔버스 비율에 맞게 조정
 */
export async function resizeImageToRatio(
  imageFile: File, 
  options: ResizeOptions
): Promise<File> {
  const {
    targetRatio,
    backgroundColor = 'white',
    maxWidth = 1080,
    quality = 0.9
  } = options;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    img.onload = () => {
      const { width: imgWidth, height: imgHeight } = img;
      const imgRatio = imgWidth / imgHeight;

      // 타겟 비율에 맞는 캔버스 크기 계산
      let canvasWidth: number;
      let canvasHeight: number;
      
      if (targetRatio > imgRatio) {
        // 이미지가 타겟보다 세로로 길면, 양옆에 여백 추가
        canvasHeight = Math.min(imgHeight, maxWidth / targetRatio);
        canvasWidth = canvasHeight * targetRatio;
      } else {
        // 이미지가 타겟보다 가로로 길면, 위아래에 여백 추가
        canvasWidth = Math.min(imgWidth, maxWidth);
        canvasHeight = canvasWidth / targetRatio;
      }

      // 캔버스 설정
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // 배경색 설정
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // 이미지를 중앙에 배치하되 비율 유지
      let drawWidth: number;
      let drawHeight: number;
      let offsetX: number;
      let offsetY: number;

      if (targetRatio > imgRatio) {
        // 세로 기준으로 맞춤
        drawHeight = canvasHeight;
        drawWidth = drawHeight * imgRatio;
        offsetX = (canvasWidth - drawWidth) / 2;
        offsetY = 0;
      } else {
        // 가로 기준으로 맞춤  
        drawWidth = canvasWidth;
        drawHeight = drawWidth / imgRatio;
        offsetX = 0;
        offsetY = (canvasHeight - drawHeight) / 2;
      }

      // 이미지 그리기
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

      // Canvas를 Blob으로 변환
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }

          // 새로운 파일 생성
          const resizedFile = new File(
            [blob], 
            `resized_${imageFile.name}`, 
            {
              type: imageFile.type,
              lastModified: Date.now()
            }
          );
          
          resolve(resizedFile);
        },
        imageFile.type,
        quality
      );
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // 이미지 로드
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(imageFile);
  });
}

/**
 * 여러 이미지를 동시에 리사이즈
 */
export async function resizeMultipleImages(
  imageFiles: File[],
  options: ResizeOptions
): Promise<File[]> {
  const promises = imageFiles.map(file => resizeImageToRatio(file, options));
  return Promise.all(promises);
}

/**
 * 캔버스 비율 상수
 */
export const CANVAS_RATIOS = {
  PORTRAIT: 4 / 5,  // 4:5 세로형
  SQUARE: 1,        // 1:1 정사각형
  LANDSCAPE: 16 / 9 // 16:9 가로형
} as const;

/**
 * 이미지 URL을 캔버스 비율에 맞게 조정 (URL 기반)
 */
export async function resizeImageUrlToRatio(
  imageUrl: string,
  options: ResizeOptions
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    // CORS 설정
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const { targetRatio, backgroundColor = 'white', maxWidth = 1080, quality = 0.9 } = options;
      const { width: imgWidth, height: imgHeight } = img;
      const imgRatio = imgWidth / imgHeight;

      // 동일한 리사이즈 로직
      let canvasWidth: number;
      let canvasHeight: number;
      
      if (targetRatio > imgRatio) {
        canvasHeight = Math.min(imgHeight, maxWidth / targetRatio);
        canvasWidth = canvasHeight * targetRatio;
      } else {
        canvasWidth = Math.min(imgWidth, maxWidth);
        canvasHeight = canvasWidth / targetRatio;
      }

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      let drawWidth: number;
      let drawHeight: number;
      let offsetX: number;
      let offsetY: number;

      if (targetRatio > imgRatio) {
        drawHeight = canvasHeight;
        drawWidth = drawHeight * imgRatio;
        offsetX = (canvasWidth - drawWidth) / 2;
        offsetY = 0;
      } else {
        drawWidth = canvasWidth;
        drawHeight = drawWidth / imgRatio;
        offsetX = 0;
        offsetY = (canvasHeight - drawHeight) / 2;
      }

      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      reject(new Error('Failed to load image from URL'));
    };

    img.src = imageUrl;
  });
}