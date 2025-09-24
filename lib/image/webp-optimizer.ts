import sharp from 'sharp';

export interface OptimizationResult {
  webpBuffer: Buffer;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
}

export interface ResponsiveSizes {
  thumbnail: Buffer;    // 150x150
  medium: Buffer;       // 400x400  
  large: Buffer;        // 원본 크기
}

export class WebPOptimizer {
  private readonly sharpCache = new Map<string, any>();
  private readonly cacheMaxSize = 20;
  private cacheCleanupTimer?: NodeJS.Timeout;

  constructor() {
    // 메모리 정리를 위한 주기적 캐시 정리
    this.cacheCleanupTimer = setInterval(() => {
      this.cleanupCache();
    }, 5 * 60 * 1000); // 5분마다 정리
  }

  private cleanupCache() {
    if (this.sharpCache.size > this.cacheMaxSize) {
      const keysToDelete = Array.from(this.sharpCache.keys()).slice(0, this.sharpCache.size - this.cacheMaxSize);
      keysToDelete.forEach(key => this.sharpCache.delete(key));
      console.log(`🧹 WebP 캐시 정리: ${keysToDelete.length}개 항목 삭제`);
    }
  }

  private getCacheKey(buffer: Buffer): string {
    // 버퍼의 첫 32바이트로 해시 생성 (성능 최적화)
    return buffer.slice(0, 32).toString('hex');
  }
  /**
   * WebP를 PNG로 변환 (다운로드용)
   */
  async convertWebPToPNG(input: Buffer | string): Promise<Buffer> {
    try {
      let imageBuffer: Buffer;
      
      // Base64 문자열인 경우 Buffer로 변환
      if (typeof input === 'string') {
        // data:image/webp;base64, 접두사 제거
        const base64Data = input.replace(/^data:image\/[a-z]+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        imageBuffer = input;
      }

      const pngBuffer = await sharp(imageBuffer)
        .png({
          quality: 100, // PNG는 무손실이므로 최고 품질
          compressionLevel: 6, // 압축 레벨 (0-9)
        })
        .toBuffer();

      console.log(`🔄 WebP → PNG 변환: ${(imageBuffer.length/1024).toFixed(1)}KB → ${(pngBuffer.length/1024).toFixed(1)}KB`);
      
      return pngBuffer;
      
    } catch (error) {
      console.error('WebP → PNG 변환 실패:', error);
      throw new Error('이미지 형식 변환에 실패했습니다');
    }
  }

  /**
   * 이미지를 WebP 포맷으로 변환 (캐싱 및 성능 최적화)
   */
  async convertToWebP(
    input: Buffer | string, 
    quality: number = 80
  ): Promise<OptimizationResult> {
    try {
      let imageBuffer: Buffer;
      
      // Base64 문자열인 경우 Buffer로 변환
      if (typeof input === 'string') {
        // data:image/... 접두사 제거
        const base64Data = input.replace(/^data:image\/[a-z]+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        imageBuffer = input;
      }

      const originalSize = imageBuffer.length;
      const cacheKey = `${this.getCacheKey(imageBuffer)}-${quality}`;

      // 캐시된 결과 확인
      if (this.sharpCache.has(cacheKey)) {
        const cached = this.sharpCache.get(cacheKey);
        console.log(`💾 WebP 캐시 히트: ${(originalSize/1024).toFixed(1)}KB`);
        return cached;
      }

      // Sharp 처리 최적화
      const webpBuffer = await sharp(imageBuffer, {
        sequentialRead: true, // 순차 읽기로 메모리 사용량 감소
        limitInputPixels: false // 큰 이미지 처리 허용 (성능상 필요시만)
      })
        .webp({ 
          quality,
          effort: 3, // 압축 레벨을 4→3으로 조정 (속도 우선)
          lossless: false,
          nearLossless: quality > 90, // 고품질일 때만 near-lossless 사용
          smartSubsample: true // 스마트 서브샘플링으로 더 나은 압축
        })
        .toBuffer();

      const optimizedSize = webpBuffer.length;
      const compressionRatio = (1 - optimizedSize / originalSize) * 100;

      const result = {
        webpBuffer,
        originalSize,
        optimizedSize,
        compressionRatio
      };

      // 캐시에 저장 (메모리 제한 고려)
      if (originalSize < 5 * 1024 * 1024) { // 5MB 이하만 캐시
        this.sharpCache.set(cacheKey, result);
      }

      console.log(`🗜️ WebP 변환: ${(originalSize/1024).toFixed(1)}KB → ${(optimizedSize/1024).toFixed(1)}KB (${compressionRatio.toFixed(1)}% 절약)`);

      return result;
    } catch (error) {
      console.error('WebP 변환 실패:', error);
      throw new Error(`이미지 변환 실패: ${error}`);
    }
  }

  /**
   * 다중 사이즈 생성 (반응형 이미지용) - 성능 최적화
   */
  async generateResponsiveSizes(
    input: Buffer | string,
    quality: number = 80
  ): Promise<ResponsiveSizes> {
    try {
      let imageBuffer: Buffer;
      
      if (typeof input === 'string') {
        const base64Data = input.replace(/^data:image\/[a-z]+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        imageBuffer = input;
      }

      const cacheKey = `resp-${this.getCacheKey(imageBuffer)}-${quality}`;

      // 캐시된 결과 확인
      if (this.sharpCache.has(cacheKey)) {
        console.log('💾 반응형 사이즈 캐시 히트');
        return this.sharpCache.get(cacheKey);
      }

      // Sharp 인스턴스 재사용으로 메모리 최적화
      const sharpInstance = sharp(imageBuffer, {
        sequentialRead: true,
        limitInputPixels: false
      });

      const [thumbnail, medium, large] = await Promise.all([
        // 썸네일: 150x150
        sharpInstance
          .clone() // 인스턴스 복제로 재사용
          .resize(150, 150, { fit: 'cover', position: 'center' })
          .webp({ quality: Math.max(quality - 15, 50), effort: 2 }) // 품질 더 낮춤, 처리 속도 우선
          .toBuffer(),
        
        // 중간 크기: 400x400
        sharpInstance
          .clone()
          .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: quality - 5, effort: 3 })
          .toBuffer(),
        
        // 대형: 원본 크기 유지하면서 WebP 변환
        sharpInstance
          .clone()
          .webp({ 
            quality: Math.min(quality + 5, 95), 
            effort: 3,
            smartSubsample: true
          })
          .toBuffer()
      ]);

      const result = { thumbnail, medium, large };

      // 캐시에 저장 (5MB 이하만)
      if (imageBuffer.length < 5 * 1024 * 1024) {
        this.sharpCache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      console.error('반응형 사이즈 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 프로그레시브 로딩용 placeholder 생성
   */
  async generatePlaceholder(input: Buffer | string): Promise<string> {
    try {
      let imageBuffer: Buffer;
      
      if (typeof input === 'string') {
        const base64Data = input.replace(/^data:image\/[a-z]+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        imageBuffer = input;
      }

      // 10x10 매우 작은 WebP 생성
      const placeholderBuffer = await sharp(imageBuffer)
        .resize(10, 10, { fit: 'cover' })
        .webp({ quality: 20 })
        .toBuffer();

      return `data:image/webp;base64,${placeholderBuffer.toString('base64')}`;
    } catch (error) {
      console.error('Placeholder 생성 실패:', error);
      return 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA='; // 기본 placeholder
    }
  }

  /**
   * Base64 WebP 변환 (DB 저장용)
   */
  async convertToBase64WebP(
    input: Buffer | string, 
    quality: number = 80
  ): Promise<string> {
    const result = await this.convertToWebP(input, quality);
    return `data:image/webp;base64,${result.webpBuffer.toString('base64')}`;
  }

  /**
   * URL에서 이미지 다운로드 후 WebP 변환
   */
  async convertUrlToWebP(
    imageUrl: string, 
    quality: number = 80
  ): Promise<OptimizationResult> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const imageBuffer = await response.arrayBuffer();
      return this.convertToWebP(Buffer.from(imageBuffer), quality);
    } catch (error) {
      console.error(`URL 이미지 변환 실패 (${imageUrl}):`, error);
      throw error;
    }
  }

  /**
   * 캐시 정리 및 메모리 해제
   */
  dispose() {
    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
      this.cacheCleanupTimer = undefined;
    }
    this.sharpCache.clear();
    console.log('🧹 WebPOptimizer 메모리 정리 완료');
  }

  /**
   * 캐시 상태 조회
   */
  getCacheStats() {
    return {
      size: this.sharpCache.size,
      maxSize: this.cacheMaxSize,
      keys: Array.from(this.sharpCache.keys())
    };
  }
}

export const webpOptimizer = new WebPOptimizer();