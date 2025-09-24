// 이미지 최적화 및 압축 유틸리티

interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 - 1.0
  format?: 'webp' | 'jpeg' | 'png';
}

export class ImageOptimizer {
  // 이미지 크기 조정 및 압축
  static async optimizeImage(
    file: File, 
    options: ImageOptimizationOptions = {}
  ): Promise<Blob> {
    const {
      maxWidth = 1080,
      maxHeight = 1350,
      quality = 0.8,
      format = 'webp'
    } = options;

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // 최적 크기 계산
        const { width, height } = this.calculateOptimalSize(
          img.width, 
          img.height, 
          maxWidth, 
          maxHeight
        );

        canvas.width = width;
        canvas.height = height;

        // 고품질 렌더링 설정
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
        }

        // WebP 포맷 지원 확인
        const mimeType = this.getSupportedMimeType(format);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('이미지 압축 실패'));
            }
          },
          mimeType,
          quality
        );
      };

      img.onerror = () => reject(new Error('이미지 로드 실패'));
      img.src = URL.createObjectURL(file);
    });
  }

  // 프로그레시브 이미지 로딩을 위한 썸네일 생성
  static async generateThumbnail(
    file: File,
    size: number = 150
  ): Promise<Blob> {
    return this.optimizeImage(file, {
      maxWidth: size,
      maxHeight: size,
      quality: 0.7,
      format: 'webp'
    });
  }

  // 최적 크기 계산 (종횡비 유지)
  private static calculateOptimalSize(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;
    
    let width = Math.min(originalWidth, maxWidth);
    let height = width / aspectRatio;
    
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
    
    return {
      width: Math.round(width),
      height: Math.round(height)
    };
  }

  // 브라우저 지원 포맷 확인
  private static getSupportedMimeType(format: string): string {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    
    const formats = {
      webp: 'image/webp',
      jpeg: 'image/jpeg',
      png: 'image/png'
    };

    const mimeType = formats[format as keyof typeof formats] || 'image/jpeg';
    
    // WebP 지원 확인
    if (format === 'webp' && !canvas.toDataURL('image/webp').includes('data:image/webp')) {
      return 'image/jpeg';
    }
    
    return mimeType;
  }

  // 이미지 메타데이터 읽기
  static async getImageMetadata(file: File): Promise<{
    width: number;
    height: number;
    size: number;
    type: string;
  }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          size: file.size,
          type: file.type
        });
      };
      
      img.onerror = () => reject(new Error('이미지 메타데이터 읽기 실패'));
      img.src = URL.createObjectURL(file);
    });
  }

  // 배치 이미지 최적화
  static async optimizeImages(
    files: File[],
    options: ImageOptimizationOptions = {},
    onProgress?: (current: number, total: number) => void
  ): Promise<Blob[]> {
    const results: Blob[] = [];
    
    for (let i = 0; i < files.length; i++) {
      try {
        const optimized = await this.optimizeImage(files[i], options);
        results.push(optimized);
        onProgress?.(i + 1, files.length);
      } catch (error) {
        console.error(`이미지 ${i + 1} 최적화 실패:`, error);
        throw error;
      }
    }
    
    return results;
  }
}