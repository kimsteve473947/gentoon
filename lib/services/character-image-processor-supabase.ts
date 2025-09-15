/**
 * 캐릭터 이미지 다중 비율 처리 서비스 (Supabase 저장소 사용)
 * 
 * Vercel Blob 대신 Supabase Storage를 사용하는 임시 버전
 */

import Sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

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

// Supabase 클라이언트 설정
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * 캐릭터 이미지를 다중 비율로 처리하고 저장
 */
export async function processCharacterImages(
  originalImages: string[],
  characterId: string
): Promise<ImageProcessingResult> {
  try {
    console.log(`🔄 Reprocessing images for existing character ${characterId}`);
    console.log(`🎨 Processing ${originalImages.length} images for character ${characterId}`);
    
    let processedCount = 0;
    const ratioImages: RatioImages = {
      '1:1': [],
      '4:5': []
    };
    
    // 각 원본 이미지를 처리
    for (let i = 0; i < originalImages.length; i++) {
      const imageUrl = originalImages[i];
      console.log(`📸 Processing image ${i + 1}/${originalImages.length}: ${imageUrl.slice(0, 50)}...`);
      
      // 각 비율로 변환
      for (const ratio of ['1:1', '4:5'] as const) {
        try {
          const croppedImageBuffer = await centerCropToRatio(imageUrl, ratio);
          const filename = `character_${characterId}_${i}_${ratio}_${Date.now()}.png`;
          
          // Supabase Storage에 저장
          const { data, error } = await supabase.storage
            .from('character-images')
            .upload(`ratio-images/${filename}`, croppedImageBuffer, {
              contentType: 'image/png',
              upsert: false
            });
          
          if (error) throw error;
          
          // 공개 URL 생성
          const { data: { publicUrl } } = supabase.storage
            .from('character-images')
            .getPublicUrl(`ratio-images/${filename}`);
          
          ratioImages[ratio].push(publicUrl);
          console.log(`✅ Saved ${ratio} ratio image: ${publicUrl.slice(0, 50)}...`);
          
        } catch (ratioError) {
          console.error(`❌ Failed to process ${ratio} ratio for image ${i}:`, ratioError);
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
  console.log(`📏 Processing for ${targetRatio}: Original image processing...`);
  
  // 원본 이미지 다운로드
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  
  const imageBuffer = Buffer.from(await response.arrayBuffer());
  
  // 원본 이미지 메타데이터 가져오기
  const { width: originalWidth, height: originalHeight } = await Sharp(imageBuffer).metadata();
  
  if (!originalWidth || !originalHeight) {
    throw new Error('Failed to get image dimensions');
  }
  
  // 타겟 비율 계산
  const targetDimensions = RATIO_DIMENSIONS[targetRatio];
  const targetRatioNum = targetDimensions.width / targetDimensions.height;
  const originalRatio = originalWidth / originalHeight;
  
  console.log(`📏 Processing for ${targetRatio}: Original ${originalWidth}x${originalHeight} (${originalRatio.toFixed(2)}) → Target ${targetDimensions.width}x${targetDimensions.height} (${targetRatioNum.toFixed(2)})`);
  
  // Center crop 계산 (cover 방식 - 목표 비율로 무조건 크롭)
  // 항상 원본 이미지보다 약간 작게 크롭하여 하얀색 제거
  const cropMargin = Math.min(originalWidth, originalHeight) * 0.03; // 3% 마진으로 크롭
  const adjustedWidth = originalWidth - cropMargin * 2;
  const adjustedHeight = originalHeight - cropMargin * 2;
  const adjustedRatio = adjustedWidth / adjustedHeight;
  
  let cropWidth, cropHeight;
  let cropLeft = cropMargin, cropTop = cropMargin;
  
  if (adjustedRatio > targetRatioNum) {
    // 조정된 이미지가 더 넓음 - 높이에 맞추고 좌우 크롭
    cropHeight = Math.round(adjustedHeight);
    cropWidth = Math.round(adjustedHeight * targetRatioNum);
    cropLeft = Math.round(cropMargin + Math.floor((adjustedWidth - cropWidth) / 2));
    cropTop = Math.round(cropMargin);
  } else if (adjustedRatio < targetRatioNum) {
    // 조정된 이미지가 더 높음 - 너비에 맞추고 상하 크롭
    cropWidth = Math.round(adjustedWidth);
    cropHeight = Math.round(adjustedWidth / targetRatioNum);
    cropLeft = Math.round(cropMargin);
    cropTop = Math.round(cropMargin + Math.floor((adjustedHeight - cropHeight) / 2));
  } else {
    // 비율이 거의 같으면 조정된 전체 영역 사용
    cropWidth = Math.round(adjustedWidth);
    cropHeight = Math.round(adjustedHeight);
    cropLeft = Math.round(cropMargin);
    cropTop = Math.round(cropMargin);
  }
  
  console.log(`🔧 Center crop calculation: crop area ${cropWidth}x${cropHeight} at offset (${cropLeft}, ${cropTop})`);
  
  // Sharp를 사용하여 center crop 및 리사이즈
  const processedImage = await Sharp(imageBuffer)
    .extract({
      left: cropLeft,
      top: cropTop,
      width: cropWidth,
      height: cropHeight
    })
    .resize(targetDimensions.width, targetDimensions.height, {
      fit: 'fill'
    })
    .png()
    .toBuffer();
  
  console.log(`✅ Successfully processed image to ${targetRatio} ratio`);
  return processedImage;
}

/**
 * 기존 캐릭터의 이미지를 재처리 (Supabase 저장소 버전)
 */
export async function reprocessExistingCharacterImages(
  characterId: string,
  referenceImages: string[]
): Promise<ImageProcessingResult> {
  return processCharacterImages(referenceImages, characterId);
}