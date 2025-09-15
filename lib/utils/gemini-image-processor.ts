/**
 * 제미나이 이미지 후처리 유틸리티
 * 
 * 제미나이가 생성한 896×1152px 4:5 비율 이미지를 
 * 우리 캔버스에 맞는 896×1115px로 center crop 처리
 */

import Sharp from 'sharp';

/**
 * 제미나이 4:5 이미지를 캔버스 크기로 후처리
 * @param imageBuffer 제미나이에서 받은 896×1152px 이미지 버퍼
 * @returns 896×1115px로 center crop된 이미지 버퍼
 */
export async function processGemini4to5Image(imageBuffer: Buffer): Promise<Buffer> {
  console.log('🔧 Processing Gemini 4:5 image: 896×1152 → 896×1115');
  
  try {
    // 이미지 메타데이터 확인
    const { width, height } = await Sharp(imageBuffer).metadata();
    console.log(`📏 Original dimensions: ${width}×${height}`);
    
    // 896×1152가 아닌 경우 일반적인 4:5 처리
    if (width !== 896 || height !== 1152) {
      console.log('⚠️ Unexpected dimensions, applying standard 4:5 crop');
      return await Sharp(imageBuffer)
        .resize(896, 1115, { fit: 'cover', position: 'center' })
        .png()
        .toBuffer();
    }
    
    // Center crop: 위 18px + 아래 19px = 37px 제거
    const cropTop = 18;
    const cropHeight = 1115; // 1152 - 37 = 1115
    
    console.log(`✂️ Center cropping: y=${cropTop}, height=${cropHeight}`);
    
    const processedImage = await Sharp(imageBuffer)
      .extract({
        left: 0,
        top: cropTop,
        width: 896,
        height: cropHeight
      })
      .png()
      .toBuffer();
    
    console.log('✅ Gemini 4:5 image processed successfully');
    return processedImage;
    
  } catch (error) {
    console.error('❌ Failed to process Gemini 4:5 image:', error);
    
    // 실패 시 기본 리사이즈로 폴백
    return await Sharp(imageBuffer)
      .resize(896, 1115, { fit: 'cover', position: 'center' })
      .png()
      .toBuffer();
  }
}

/**
 * 이미지 URL에서 버퍼를 다운로드하고 후처리
 * @param imageUrl 제미나이에서 받은 이미지 URL
 * @returns 후처리된 896×1115px 이미지 버퍼
 */
export async function processGemini4to5ImageFromUrl(imageUrl: string): Promise<Buffer> {
  console.log('🔄 Downloading and processing Gemini 4:5 image from URL');
  
  try {
    // 이미지 다운로드
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    
    // 후처리
    return await processGemini4to5Image(imageBuffer);
    
  } catch (error) {
    console.error('❌ Failed to download and process Gemini image:', error);
    throw error;
  }
}

/**
 * 이미지가 4:5 비율인지 확인
 * @param aspectRatio 비율 문자열
 * @returns 4:5 비율 여부
 */
export function isGemini4to5Ratio(aspectRatio?: string): boolean {
  return aspectRatio === '4:5';
}

/**
 * 제미나이 이미지 크기 정보
 */
export const GEMINI_SIZES = {
  '4:5': {
    generated: { width: 896, height: 1152 }, // 제미나이 생성 크기
    target: { width: 896, height: 1115 },    // 우리 캔버스 크기
    cropMargin: { top: 18, bottom: 19 }      // 크롭 마진
  }
} as const;