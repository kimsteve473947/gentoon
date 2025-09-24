/**
 * 직접 WebP 마이그레이션 스크립트
 * MCP를 통해 개별 캐릭터를 처리합니다.
 */

import { webpOptimizer } from '@/lib/image/webp-optimizer';

interface CharacterResult {
  id: string;
  name: string;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  success: boolean;
  error?: string;
}

export class DirectWebPMigrator {
  
  /**
   * Base64 이미지 데이터를 WebP로 변환하고 압축률 계산
   */
  async processImageData(imageData: string): Promise<{
    optimizedData: string;
    originalSize: number;
    optimizedSize: number;
    compressionRatio: number;
  }> {
    const originalSize = imageData.length;
    
    try {
      // WebP로 변환
      const optimizedImage = await webpOptimizer.convertToBase64WebP(imageData, 85);
      const optimizedSize = optimizedImage.length;
      const compressionRatio = ((originalSize - optimizedSize) / originalSize) * 100;
      
      return {
        optimizedData: optimizedImage,
        originalSize,
        optimizedSize,
        compressionRatio
      };
    } catch (error) {
      throw new Error(`이미지 최적화 실패: ${error}`);
    }
  }

  /**
   * 개별 캐릭터 처리 및 결과 반환
   */
  async processCharacterImages(
    characterId: string,
    characterName: string, 
    referenceImages: string[],
    ratioImages: Record<string, string[]> | null
  ): Promise<CharacterResult> {
    console.log(`\n🔧 캐릭터 '${characterName}' (${characterId}) 처리 시작...`);
    
    try {
      let totalOriginalSize = 0;
      let totalOptimizedSize = 0;
      const optimizedRefImages: string[] = [];
      const optimizedRatioImages: Record<string, string[]> = {};

      // Reference Images 처리
      if (referenceImages && referenceImages.length > 0) {
        console.log(`  📷 참조 이미지 ${referenceImages.length}개 처리 중...`);
        
        for (let i = 0; i < referenceImages.length; i++) {
          const imageData = referenceImages[i];
          
          if (typeof imageData === 'string' && imageData.length > 500) {
            console.log(`    🖼️  이미지 ${i+1}/${referenceImages.length}: ${(imageData.length/1024).toFixed(1)}KB`);
            
            const result = await this.processImageData(imageData);
            
            optimizedRefImages.push(result.optimizedData);
            totalOriginalSize += result.originalSize;
            totalOptimizedSize += result.optimizedSize;
            
            console.log(`    ✅ 압축 완료: ${(result.originalSize/1024).toFixed(1)}KB → ${(result.optimizedSize/1024).toFixed(1)}KB (${result.compressionRatio.toFixed(1)}% 절약)`);
          } else {
            optimizedRefImages.push(imageData); // 작은 데이터는 그대로 유지
          }
        }
      }

      // Ratio Images 처리
      if (ratioImages && typeof ratioImages === 'object') {
        console.log(`  🎭 비율 이미지 처리 중...`);
        
        for (const [ratio, images] of Object.entries(ratioImages)) {
          if (Array.isArray(images)) {
            const optimizedImages: string[] = [];
            
            for (let i = 0; i < images.length; i++) {
              const imageData = images[i];
              
              if (typeof imageData === 'string' && imageData.length > 500) {
                console.log(`    🎨 비율 ${ratio} 이미지 ${i+1}/${images.length}: ${(imageData.length/1024).toFixed(1)}KB`);
                
                const result = await this.processImageData(imageData);
                
                optimizedImages.push(result.optimizedData);
                totalOriginalSize += result.originalSize;
                totalOptimizedSize += result.optimizedSize;
                
                console.log(`    ✅ 압축 완료: ${(result.originalSize/1024).toFixed(1)}KB → ${(result.optimizedSize/1024).toFixed(1)}KB (${result.compressionRatio.toFixed(1)}% 절약)`);
              } else {
                optimizedImages.push(imageData);
              }
            }
            
            optimizedRatioImages[ratio] = optimizedImages;
          }
        }
      }

      const overallCompressionRatio = totalOriginalSize > 0 
        ? ((totalOriginalSize - totalOptimizedSize) / totalOriginalSize) * 100 
        : 0;

      console.log(`\n📊 '${characterName}' 처리 완료:`);
      console.log(`  📉 전체 압축률: ${overallCompressionRatio.toFixed(1)}%`);
      console.log(`  💾 절약된 용량: ${((totalOriginalSize - totalOptimizedSize)/1024).toFixed(1)}KB`);
      console.log(`  📁 처리 전: ${(totalOriginalSize/1024).toFixed(1)}KB`);
      console.log(`  📁 처리 후: ${(totalOptimizedSize/1024).toFixed(1)}KB`);

      // MCP로 업데이트할 데이터 반환
      return {
        id: characterId,
        name: characterName,
        originalSize: totalOriginalSize,
        optimizedSize: totalOptimizedSize,
        compressionRatio: overallCompressionRatio,
        success: true,
        // 실제 업데이트용 데이터
        optimizedRefImages,
        optimizedRatioImages
      } as CharacterResult & {
        optimizedRefImages: string[];
        optimizedRatioImages: Record<string, string[]>;
      };

    } catch (error) {
      console.error(`❌ 캐릭터 '${characterName}' 처리 실패:`, error);
      
      return {
        id: characterId,
        name: characterName,
        originalSize: 0,
        optimizedSize: 0,
        compressionRatio: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 결과 요약 출력
   */
  printSummary(results: CharacterResult[]): void {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    const totalOriginal = successful.reduce((sum, r) => sum + r.originalSize, 0);
    const totalOptimized = successful.reduce((sum, r) => sum + r.optimizedSize, 0);
    const totalSaved = totalOriginal - totalOptimized;
    const averageCompression = successful.length > 0 
      ? successful.reduce((sum, r) => sum + r.compressionRatio, 0) / successful.length 
      : 0;

    console.log('\n🎉 마이그레이션 요약:');
    console.log(`  ✅ 성공: ${successful.length}개`);
    console.log(`  ❌ 실패: ${failed.length}개`);
    console.log(`  💾 총 절약: ${(totalSaved/1024/1024).toFixed(2)}MB`);
    console.log(`  📊 평균 압축률: ${averageCompression.toFixed(1)}%`);
    console.log(`  📉 ${(totalOriginal/1024/1024).toFixed(2)}MB → ${(totalOptimized/1024/1024).toFixed(2)}MB`);

    if (failed.length > 0) {
      console.log('\n❌ 실패한 캐릭터:');
      failed.forEach((r, i) => {
        console.log(`  ${i+1}. ${r.name}: ${r.error}`);
      });
    }
  }
}

export const directMigrator = new DirectWebPMigrator();