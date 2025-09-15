import { NextRequest, NextResponse } from "next/server";
import { reprocessExistingCharacterImages } from "@/lib/services/character-image-processor";
import { createClient } from "@/lib/supabase/server";

/**
 * Test endpoint to reprocess character images for ratio generation
 * Usage: POST /api/test/reprocess-character with { characterName: "그레이브즈" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { characterName, characterId } = body;
    
    if (!characterName && !characterId) {
      return NextResponse.json(
        { success: false, error: "characterName or characterId is required" },
        { status: 400 }
      );
    }
    
    console.log(`🚀 Starting ratio processing test for character: ${characterName || characterId}`);
    
    const supabase = await createClient();
    
    // 캐릭터 조회
    let query = supabase.from('character').select('*');
    
    if (characterId) {
      query = query.eq('id', characterId);
    } else {
      query = query.eq('name', characterName);
    }
    
    const { data: characters, error } = await query
      .order('createdAt', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('❌ Error finding character:', error);
      return NextResponse.json(
        { success: false, error: `Character lookup failed: ${error.message}` },
        { status: 404 }
      );
    }
    
    const character = characters?.[0];
    if (!character) {
      return NextResponse.json(
        { success: false, error: `Character "${characterName || characterId}" not found` },
        { status: 404 }
      );
    }
    
    console.log(`📋 Found character: ${character.name} (ID: ${character.id})`);
    console.log(`🖼️ Reference images:`, character.referenceImages);
    console.log(`📐 Current ratioImages:`, character.ratioImages);
    
    if (!character.referenceImages || character.referenceImages.length === 0) {
      return NextResponse.json(
        { success: false, error: "No reference images found for this character" },
        { status: 400 }
      );
    }
    
    // 비율 이미지 처리
    console.log('🎨 Processing ratio images...');
    const result = await reprocessExistingCharacterImages(
      character.id,
      character.referenceImages
    );
    
    if (!result.success) {
      console.error('❌ Image processing failed:', result.error);
      return NextResponse.json(
        { success: false, error: `Image processing failed: ${result.error}` },
        { status: 500 }
      );
    }
    
    console.log('✅ Image processing successful!');
    console.log('📊 Processing result:', {
      processedCount: result.processedCount,
      ratioImageCounts: {
        '1:1': result.ratioImages?.['1:1']?.length || 0,
        '4:5': result.ratioImages?.['4:5']?.length || 0,
        '16:9': result.ratioImages?.['16:9']?.length || 0,
      }
    });
    
    // 데이터베이스 업데이트
    console.log('💾 Updating database...');
    const { error: updateError } = await supabase
      .from('character')
      .update({ ratioImages: result.ratioImages })
      .eq('id', character.id);
    
    if (updateError) {
      console.error('❌ Database update failed:', updateError);
      return NextResponse.json(
        { success: false, error: `Database update failed: ${updateError.message}` },
        { status: 500 }
      );
    }
    
    console.log('✅ Database updated successfully!');
    
    // 결과 검증
    console.log('🔍 Verifying results...');
    const { data: updatedCharacter } = await supabase
      .from('character')
      .select('ratioImages')
      .eq('id', character.id)
      .single();
    
    const ratios = updatedCharacter?.ratioImages as any;
    const imageCounts = {
      '1:1': ratios?.['1:1']?.length || 0,
      '4:5': ratios?.['4:5']?.length || 0,
      '16:9': ratios?.['16:9']?.length || 0,
    };
    
    const totalRatioImages = imageCounts['1:1'] + imageCounts['4:5'] + imageCounts['16:9'];
    const originalImageCount = character.referenceImages.length;
    
    console.log('📈 Final results:');
    console.log(`  1:1 ratio: ${imageCounts['1:1']} images`);
    console.log(`  4:5 ratio: ${imageCounts['4:5']} images`);
    console.log(`  16:9 ratio: ${imageCounts['16:9']} images`);
    console.log(`📸 Total: ${originalImageCount} original + ${totalRatioImages} ratio = ${originalImageCount + totalRatioImages} total images`);
    
    return NextResponse.json({
      success: true,
      character: {
        id: character.id,
        name: character.name,
      },
      processing: {
        originalImageCount,
        processedCount: result.processedCount,
        imageCounts,
        totalRatioImages,
        totalImages: originalImageCount + totalRatioImages
      },
      ratioImages: result.ratioImages,
      message: `Successfully processed ${result.processedCount} images into ${totalRatioImages} ratio images`
    });
    
  } catch (error) {
    console.error('❌ Test endpoint failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check character ratio images status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const characterName = searchParams.get('name');
    const characterId = searchParams.get('id');
    
    if (!characterName && !characterId) {
      return NextResponse.json(
        { success: false, error: "name or id parameter is required" },
        { status: 400 }
      );
    }
    
    const supabase = await createClient();
    
    let query = supabase.from('character').select('id, name, referenceImages, ratioImages');
    
    if (characterId) {
      query = query.eq('id', characterId);
    } else {
      query = query.eq('name', characterName);
    }
    
    const { data: character, error } = await query.single();
    
    if (error || !character) {
      return NextResponse.json(
        { success: false, error: "Character not found" },
        { status: 404 }
      );
    }
    
    const ratios = character.ratioImages as any;
    const imageCounts = {
      '1:1': ratios?.['1:1']?.length || 0,
      '4:5': ratios?.['4:5']?.length || 0,
      '16:9': ratios?.['16:9']?.length || 0,
    };
    
    const hasRatioImages = ratios && (imageCounts['1:1'] > 0 || imageCounts['4:5'] > 0 || imageCounts['16:9'] > 0);
    
    return NextResponse.json({
      success: true,
      character: {
        id: character.id,
        name: character.name,
        originalImageCount: character.referenceImages?.length || 0,
        hasRatioImages,
        imageCounts,
        ratioImages: character.ratioImages
      }
    });
    
  } catch (error) {
    console.error('❌ GET endpoint failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}