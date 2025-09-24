import { NextRequest, NextResponse } from "next/server";
import { reprocessExistingCharacterImages } from "@/lib/services/character-image-processor-supabase";
import { createClient } from '@supabase/supabase-js';

/**
 * Direct processing endpoint without authentication
 * For testing purposes only
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { characterId, referenceImages } = body;
    
    if (!characterId || !referenceImages) {
      return NextResponse.json(
        { success: false, error: "characterId and referenceImages are required" },
        { status: 400 }
      );
    }
    
    console.log(`🚀 Direct processing for character: ${characterId}`);
    console.log(`📷 Reference images: ${referenceImages.length} images`);
    
    // Process ratio images directly
    const result = await reprocessExistingCharacterImages(characterId, referenceImages);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: `Processing failed: ${result.error}` },
        { status: 500 }
      );
    }
    
    console.log('✅ Processing successful!');
    
    // 데이터베이스 업데이트
    if (result.success && result.ratioImages) {
      console.log('💾 Updating database with ratio images...');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const { error: updateError } = await supabase
        .from('character')
        .update({ ratioImages: result.ratioImages })
        .eq('id', characterId);
      
      if (updateError) {
        console.error('❌ Database update failed:', updateError);
      } else {
        console.log('✅ Database updated successfully with ratio images!');
      }
    }
    console.log('📊 Results:', {
      processedCount: result.processedCount,
      imageCounts: {
        '1:1': result.ratioImages?.['1:1']?.length || 0,
        '4:5': result.ratioImages?.['4:5']?.length || 0,
        '16:9': result.ratioImages?.['16:9']?.length || 0,
      }
    });
    
    return NextResponse.json({
      success: true,
      characterId,
      processing: {
        processedCount: result.processedCount,
        imageCounts: {
          '1:1': result.ratioImages?.['1:1']?.length || 0,
          '4:5': result.ratioImages?.['4:5']?.length || 0,
          '16:9': result.ratioImages?.['16:9']?.length || 0,
        },
        totalRatioImages: (result.ratioImages?.['1:1']?.length || 0) + 
                         (result.ratioImages?.['4:5']?.length || 0) + 
                         (result.ratioImages?.['16:9']?.length || 0)
      },
      ratioImages: result.ratioImages,
      message: `Successfully processed ${result.processedCount} images`
    });
    
  } catch (error) {
    console.error('❌ Direct processing failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}