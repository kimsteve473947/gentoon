import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const characterName = searchParams.get("name") || "테스트최종";
    
    console.log(`🔍 Testing character data load for: ${characterName}`);
    
    const supabase = await createClient();
    
    // 캐릭터 데이터 조회 - 정확한 이름 매칭
    const { data: characters, error } = await supabase
      .from('character')
      .select('*')
      .eq('name', characterName)
      .limit(1);
      
    // 만약 정확한 매칭이 없으면 LIKE 검색으로 재시도
    if (!error && (!characters || characters.length === 0)) {
      const { data: likeResults, error: likeError } = await supabase
        .from('character')
        .select('*')
        .ilike('name', `%${characterName}%`)
        .limit(5);
        
      if (!likeError && likeResults && likeResults.length > 0) {
        console.log(`Found similar characters: ${likeResults.map(c => c.name).join(', ')}`);
        // 첫 번째 유사한 결과 사용
        characters = [likeResults[0]];
      }
    }
    
    if (error) {
      throw error;
    }
    
    if (!characters || characters.length === 0) {
      return NextResponse.json({
        success: false,
        error: `캐릭터 '${characterName}'를 찾을 수 없습니다`
      }, { status: 404 });
    }
    
    const character = characters[0];
    
    // 비율별 이미지 정보 분석
    const ratioAnalysis = {
      hasRatioImages: !!character.ratioImages,
      ratioImageCount: character.ratioImages ? {
        '1:1': character.ratioImages['1:1']?.length || 0,
        '4:5': character.ratioImages['4:5']?.length || 0,
        '16:9': character.ratioImages['16:9']?.length || 0,
      } : null,
      originalImageCount: character.referenceImages ? character.referenceImages.length : 0
    };
    
    // 4:5 비율 테스트
    let recommendedImage = null;
    if (character.ratioImages && character.ratioImages['4:5']?.length > 0) {
      recommendedImage = character.ratioImages['4:5'][0];
      console.log(`✅ Using pre-processed 4:5 ratio image: ${recommendedImage.slice(0, 50)}...`);
    } else if (character.referenceImages?.length > 0) {
      recommendedImage = character.referenceImages[0];
      console.log(`⚠️ No 4:5 ratio image, using original: ${recommendedImage.slice(0, 50)}...`);
    }
    
    return NextResponse.json({
      success: true,
      character: {
        id: character.id,
        name: character.name,
        description: character.description,
        ratioAnalysis,
        recommendedImageFor4_5: recommendedImage,
        fullRatioImages: character.ratioImages,
        referenceImages: character.referenceImages
      }
    });
    
  } catch (error) {
    console.error("Character data test error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "캐릭터 데이터 테스트 실패",
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
}