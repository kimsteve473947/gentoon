import { NextRequest, NextResponse } from "next/server";
import { webpOptimizer } from "@/lib/image/webp-optimizer";

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();
    
    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: "이미지 URL이 필요합니다" },
        { status: 400 }
      );
    }

    console.log('🔄 WebP → PNG 변환 요청:', imageUrl.substring(0, 50) + '...');
    
    // WebP를 PNG로 변환 (최고 품질)
    const pngBuffer = await webpOptimizer.convertWebPToPNG(imageUrl);
    
    // PNG를 base64로 인코딩하여 즉시 사용 가능한 data URL 반환
    const pngDataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;
    
    console.log(`✅ WebP → PNG 변환 완료: ${(pngBuffer.length/1024).toFixed(1)}KB`);
    
    return NextResponse.json({
      success: true,
      pngUrl: pngDataUrl,
      originalSize: imageUrl.length,
      convertedSize: pngBuffer.length
    });

  } catch (error) {
    console.error("WebP → PNG 변환 실패:", error);
    return NextResponse.json(
      { success: false, error: "이미지 변환 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}