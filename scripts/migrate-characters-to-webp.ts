import { webpOptimizer } from '@/lib/image/webp-optimizer';

interface CharacterData {
  id: string;
  name: string;
  referenceImages: string[];
  ratioImages: Record<string, string[]> | null;
  thumbnailUrl: string | null;
}

interface MigrationStats {
  totalCharacters: number;
  processedCharacters: number;
  totalSizeBefore: number;
  totalSizeAfter: number;
  errors: string[];
}

export class CharacterWebPMigrator {
  private supabase: any;
  private stats: MigrationStats = {
    totalCharacters: 0,
    processedCharacters: 0,
    totalSizeBefore: 0,
    totalSizeAfter: 0,
    errors: []
  };

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  /**
   * 모든 캐릭터를 WebP로 마이그레이션
   */
  async migrateAllCharacters(batchSize: number = 5): Promise<MigrationStats> {
    console.log('🚀 캐릭터 WebP 마이그레이션 시작...');
    
    try {
      // 전체 캐릭터 조회 (큰 데이터부터 처리)
      const { data: characters, error } = await this.supabase
        .from('character')
        .select('id, name, referenceImages, ratioImages, thumbnailUrl')
        .order('id');

      if (error) {
        throw new Error(`캐릭터 조회 실패: ${error.message}`);
      }

      this.stats.totalCharacters = characters.length;
      console.log(`📊 총 ${characters.length}개 캐릭터 발견`);

      // 배치 단위로 처리
      for (let i = 0; i < characters.length; i += batchSize) {
        const batch = characters.slice(i, i + batchSize);
        console.log(`\n🔄 배치 ${Math.floor(i/batchSize) + 1}/${Math.ceil(characters.length/batchSize)} 처리 중...`);
        
        await this.processBatch(batch);
        
        // 배치 간 잠시 대기 (DB 부하 방지)
        if (i + batchSize < characters.length) {
          console.log('⏳ 1초 대기 중...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log('\n🎉 마이그레이션 완료!');
      this.printStats();
      
      return this.stats;

    } catch (error) {
      console.error('❌ 마이그레이션 실패:', error);
      this.stats.errors.push(`전체 마이그레이션 실패: ${error}`);
      return this.stats;
    }
  }

  /**
   * 배치 단위로 캐릭터 처리
   */
  private async processBatch(characters: CharacterData[]): Promise<void> {
    const promises = characters.map(character => this.migrateCharacter(character));
    await Promise.allSettled(promises);
  }

  /**
   * 개별 캐릭터 마이그레이션
   */
  private async migrateCharacter(character: CharacterData): Promise<void> {
    try {
      console.log(`\n🔧 캐릭터 '${character.name}' 처리 중...`);
      
      let hasChanges = false;
      const updates: any = {};
      let sizeBefore = 0;
      let sizeAfter = 0;

      // Reference Images 처리
      if (character.referenceImages && character.referenceImages.length > 0) {
        const optimizedRefImages: string[] = [];
        
        for (const imageData of character.referenceImages) {
          if (typeof imageData === 'string' && imageData.length > 200) { // Base64 데이터 확인
            sizeBefore += imageData.length;
            
            try {
              const optimizedImage = await webpOptimizer.convertToBase64WebP(imageData, 85);
              sizeAfter += optimizedImage.length;
              optimizedRefImages.push(optimizedImage);
              hasChanges = true;
              
              console.log(`  📷 참조 이미지 최적화: ${(imageData.length/1024).toFixed(1)}KB → ${(optimizedImage.length/1024).toFixed(1)}KB`);
            } catch (error) {
              console.warn(`  ⚠️ 참조 이미지 변환 실패, 원본 유지:`, error);
              optimizedRefImages.push(imageData);
              sizeAfter += imageData.length;
            }
          } else {
            optimizedRefImages.push(imageData);
          }
        }
        
        if (hasChanges) {
          updates.referenceImages = optimizedRefImages;
        }
      }

      // Ratio Images 처리
      if (character.ratioImages && typeof character.ratioImages === 'object') {
        const optimizedRatioImages: Record<string, string[]> = {};
        let ratioHasChanges = false;
        
        for (const [ratio, images] of Object.entries(character.ratioImages)) {
          if (Array.isArray(images)) {
            const optimizedImages: string[] = [];
            
            for (const imageData of images) {
              if (typeof imageData === 'string' && imageData.length > 200) {
                sizeBefore += imageData.length;
                
                try {
                  const optimizedImage = await webpOptimizer.convertToBase64WebP(imageData, 80);
                  sizeAfter += optimizedImage.length;
                  optimizedImages.push(optimizedImage);
                  ratioHasChanges = true;
                  
                  console.log(`  🎭 비율 이미지 (${ratio}) 최적화: ${(imageData.length/1024).toFixed(1)}KB → ${(optimizedImage.length/1024).toFixed(1)}KB`);
                } catch (error) {
                  console.warn(`  ⚠️ 비율 이미지 변환 실패, 원본 유지:`, error);
                  optimizedImages.push(imageData);
                  sizeAfter += imageData.length;
                }
              } else {
                optimizedImages.push(imageData);
              }
            }
            
            optimizedRatioImages[ratio] = optimizedImages;
          } else {
            optimizedRatioImages[ratio] = images;
          }
        }
        
        if (ratioHasChanges) {
          updates.ratioImages = optimizedRatioImages;
          hasChanges = true;
        }
      }

      // 변경사항이 있으면 DB 업데이트
      if (hasChanges) {
        updates.updatedAt = new Date().toISOString();
        updates.migrated_to_webp = true;
        
        const { error: updateError } = await this.supabase
          .from('character')
          .update(updates)
          .eq('id', character.id);

        if (updateError) {
          throw new Error(`DB 업데이트 실패: ${updateError.message}`);
        }

        this.stats.totalSizeBefore += sizeBefore;
        this.stats.totalSizeAfter += sizeAfter;
        this.stats.processedCharacters++;
        
        const savedBytes = sizeBefore - sizeAfter;
        const savedPercent = sizeBefore > 0 ? ((savedBytes / sizeBefore) * 100) : 0;
        
        console.log(`  ✅ '${character.name}' 최적화 완료: ${(savedBytes/1024).toFixed(1)}KB 절약 (${savedPercent.toFixed(1)}%)`);
      } else {
        console.log(`  ⏭️ '${character.name}': 최적화 불필요`);
      }

    } catch (error) {
      const errorMsg = `캐릭터 '${character.name}' (${character.id}) 처리 실패: ${error}`;
      console.error(`  ❌ ${errorMsg}`);
      this.stats.errors.push(errorMsg);
    }
  }

  /**
   * 마이그레이션 통계 출력
   */
  private printStats(): void {
    const totalSavedBytes = this.stats.totalSizeBefore - this.stats.totalSizeAfter;
    const totalSavedPercent = this.stats.totalSizeBefore > 0 
      ? ((totalSavedBytes / this.stats.totalSizeBefore) * 100) 
      : 0;

    console.log('\n📊 마이그레이션 결과:');
    console.log(`  📁 처리된 캐릭터: ${this.stats.processedCharacters}/${this.stats.totalCharacters}`);
    console.log(`  💾 데이터 절약: ${(totalSavedBytes/1024/1024).toFixed(2)}MB (${totalSavedPercent.toFixed(1)}%)`);
    console.log(`  📉 처리 전: ${(this.stats.totalSizeBefore/1024/1024).toFixed(2)}MB`);
    console.log(`  📈 처리 후: ${(this.stats.totalSizeAfter/1024/1024).toFixed(2)}MB`);
    
    if (this.stats.errors.length > 0) {
      console.log(`  ⚠️ 오류 발생: ${this.stats.errors.length}건`);
      this.stats.errors.forEach((error, index) => {
        console.log(`    ${index + 1}. ${error}`);
      });
    }
  }

  /**
   * 특정 캐릭터만 마이그레이션 (테스트용)
   */
  async migrateSpecificCharacter(characterId: string): Promise<void> {
    console.log(`🎯 특정 캐릭터 마이그레이션: ${characterId}`);
    
    const { data: character, error } = await this.supabase
      .from('character')
      .select('id, name, referenceImages, ratioImages, thumbnailUrl')
      .eq('id', characterId)
      .single();

    if (error || !character) {
      throw new Error(`캐릭터 조회 실패: ${error?.message}`);
    }

    await this.migrateCharacter(character);
    this.printStats();
  }
}

// CLI에서 실행할 수 있도록 내보내기 함수
export async function createMigrator() {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  return new CharacterWebPMigrator(supabase);
}