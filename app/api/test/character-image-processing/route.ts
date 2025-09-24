import { NextRequest, NextResponse } from "next/server";
import { processCharacterImages } from "@/lib/services/character-image-processor";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, characterId = "test" } = body;

    if (!imageUrl) {
      return NextResponse.json({
        success: false,
        error: "imageUrl is required"
      }, { status: 400 });
    }

    console.log(`🧪 Testing image processing for: ${imageUrl}`);
    
    // 환경변수 확인
    const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasSupabaseKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log(`🔑 Supabase credentials exist: URL=${hasSupabaseUrl}, Key=${hasSupabaseKey}`);

    // 이미지 처리 테스트
    const result = await processCharacterImages([imageUrl], characterId);
    
    return NextResponse.json({
      success: true,
      hasSupabaseCredentials: hasSupabaseUrl && hasSupabaseKey,
      processingResult: result,
      environment: process.env.NODE_ENV
    });

  } catch (error) {
    console.error("🚫 Test failed:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}