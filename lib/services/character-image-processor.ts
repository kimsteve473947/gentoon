/**
 * 캐릭터 이미지 다중 비율 처리 서비스
 * 
 * 캐릭터 등록 시점에 원본 이미지를 1:1, 4:5 비율로 변환하여
 * 가운데 기준 크롭(center crop) 방식으로 이미지를 생성하고 저장하는 서비스
 */

import { put } from '@vercel/blob';
import Sharp from 'sharp';

export interface RatioImages {
  '1:1': string[];
  '4:5': string[];
}

export interface ImageProcessingResult {
  success: boolean;
  ratioImages?: RatioImages;
  error?: string;
  processedCount?: number;
}

// 비율별 권장 크기 정의 (center crop 방식)
const RATIO_DIMENSIONS = {
  '1:1': { width: 1024, height: 1024 },
  '4:5': { width: 896, height: 1115 }  // 4:5 비율 (896 × 1115)
} as const;

/**
 * 캐릭터 이미지들을 3가지 비율로 변환하여 저장
 */
export async function processCharacterImages(
  originalImages: string[],
  characterId: string
): Promise<ImageProcessingResult> {
  try {
    console.log(`🎨 Processing ${originalImages.length} images for character ${characterId}`);
    
    const ratioImages: RatioImages = {
      '1:1': [],
      '4:5': []
    };

    let processedCount = 0;
    
    for (let i = 0; i < originalImages.length; i++) {
      const imageUrl = originalImages[i];
      console.log(`📸 Processing image ${i + 1}/${originalImages.length}: ${imageUrl.slice(0, 50)}...`);
      
      // 각 비율로 변환 (1:1, 4:5 만 지원)
      for (const ratio of ['1:1', '4:5'] as const) {
        try {
          const croppedImageBuffer = await centerCropToRatio(imageUrl, ratio);
          const filename = `character_${characterId}_${i}_${ratio}_${Date.now()}.png`;
          
          // Vercel Blob에 저장
          const blob = await put(filename, croppedImageBuffer, {
            access: 'public',
            contentType: 'image/png'
          });
          
          ratioImages[ratio].push(blob.url);
          console.log(`✅ Saved ${ratio} ratio image: ${blob.url.slice(0, 50)}...`);
          
        } catch (ratioError) {
          console.error(`❌ Failed to process ${ratio} ratio for image ${i}:`, ratioError);
          console.error(`❌ Error stack:`, ratioError?.stack);
          console.error(`❌ Error details:`, {
            name: ratioError?.name,
            message: ratioError?.message,
            cause: ratioError?.cause
          });
          // 개별 비율 실패해도 계속 진행
        }
      }
      
      processedCount++;
    }
    
    console.log(`✅ Character image processing completed: ${processedCount}/${originalImages.length} images processed`);
    
    return {
      success: true,
      ratioImages,
      processedCount
    };
    
  } catch (error) {
    console.error('❌ Character image processing failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 이미지를 가운데 기준으로 크롭하여 특정 비율로 변환
 */
async function centerCropToRatio(
  imageUrl: string,
  targetRatio: keyof typeof RATIO_DIMENSIONS
): Promise<Buffer> {
  try {
    // 1. 원본 이미지 다운로드
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    
    // 2. 원본 이미지 메타데이터
    const { width: originalWidth, height: originalHeight } = await Sharp(imageBuffer).metadata();
    
    if (!originalWidth || !originalHeight) {
      throw new Error('Failed to get image dimensions');
    }
    
    // 3. 목표 비율 및 크기
    const targetDimensions = RATIO_DIMENSIONS[targetRatio];
    const targetRatio_num = targetDimensions.width / targetDimensions.height;
    const originalRatio = originalWidth / originalHeight;
    
    console.log(`📏 Center cropping for ${targetRatio}: Original ${originalWidth}x${originalHeight} (${originalRatio.toFixed(2)}) → Target ${targetDimensions.width}x${targetDimensions.height} (${targetRatio_num.toFixed(2)})`);
    
    // 4. Center crop 계산 (cover 방식 - 이미지를 목표 비율에 맞게 크롭)
    let cropWidth, cropHeight;
    let cropLeft = 0, cropTop = 0;
    
    if (originalRatio > targetRatio_num) {
      // 원본이 더 넓음 - 높이에 맞추고 좌우 크롭
      cropHeight = originalHeight;
      cropWidth = Math.round(originalHeight * targetRatio_num);
      cropLeft = Math.floor((originalWidth - cropWidth) / 2);
    } else {
      // 원본이 더 높거나 같음 - 너비에 맞추고 상하 크롭
      cropWidth = originalWidth;
      cropHeight = Math.round(originalWidth / targetRatio_num);
      cropTop = Math.floor((originalHeight - cropHeight) / 2);
    }
    
    console.log(`🔧 Center crop calculation: crop area ${cropWidth}x${cropHeight} at offset (${cropLeft}, ${cropTop})`);
    
    // 5. Sharp를 사용하여 center crop 및 리사이즈
    const processedImage = await Sharp(imageBuffer)
      .extract({
        left: cropLeft,
        top: cropTop,
        width: cropWidth,
        height: cropHeight
      })
      .resize(targetDimensions.width, targetDimensions.height, {
        fit: 'fill' // 정확한 크기로 리사이즈
      })
      .png() // PNG 포맷으로 출력
      .toBuffer();
    
    console.log(`✅ Successfully processed image to ${targetRatio} ratio`);
    return processedImage;
    
  } catch (error) {
    console.error(`❌ Error processing image for ${targetRatio} ratio:`, error);
    throw error;
  }
}

/**
 * 단일 이미지를 특정 비율로 변환 (테스트용)
 */
export async function processImageToRatio(
  imageUrl: string,
  targetRatio: keyof typeof RATIO_DIMENSIONS
): Promise<Buffer> {
  return centerCropToRatio(imageUrl, targetRatio);
}

/**
 * 기존 캐릭터의 이미지를 비율별로 재처리 (마이그레이션용)
 */
export async function reprocessExistingCharacterImages(
  characterId: string,
  originalImages: string[]
): Promise<ImageProcessingResult> {
  console.log(`🔄 Reprocessing images for existing character ${characterId}`);
  return processCharacterImages(originalImages, characterId);
}