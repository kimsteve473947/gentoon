import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { webpOptimizer } from "@/lib/image/webp-optimizer";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1분 타임아웃

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { characterId } = body;

    if (!characterId) {
      return NextResponse.json(
        { success: false, error: "캐릭터 ID가 필요합니다" },
        { status: 400 }
      );
    }

    console.log(`🎯 특정 캐릭터 WebP 변환: ${characterId}`);
    
    const supabase = await createClient();

    // 특정 캐릭터 조회
    const { data: character, error: fetchError } = await supabase
      .from('character')
      .select('id, name, referenceImages, ratioImages')
      .eq('id', characterId)
      .single();

    if (fetchError || !character) {
      return NextResponse.json(
        { success: false, error: `캐릭터 조회 실패: ${fetchError?.message}` },
        { status: 404 }
      );
    }

    console.log(`📋 캐릭터 정보: ${character.name}`);
    console.log(`📊 참조 이미지: ${character.referenceImages?.length || 0}개`);

    let totalOriginalSize = 0;
    let totalOptimizedSize = 0;
    const optimizedRefImages: string[] = [];
    let hasChanges = false;

    // Reference Images 처리
    if (character.referenceImages && character.referenceImages.length > 0) {
      for (let i = 0; i < character.referenceImages.length; i++) {
        const imageData = character.referenceImages[i];
        
        if (typeof imageData === 'string' && imageData.length > 1000) {
          const originalSize = imageData.length;
          totalOriginalSize += originalSize;
          
          console.log(`🖼️ 이미지 ${i+1} 처리 중: ${(originalSize/1024).toFixed(1)}KB`);
          
          try {
            // WebP로 변환
            const result = await webpOptimizer.convertToWebP(imageData, 85);
            const webpBase64 = `data:image/webp;base64,${result.webpBuffer.toString('base64')}`;
            
            optimizedRefImages.push(webpBase64);
            totalOptimizedSize += webpBase64.length;
            hasChanges = true;
            
            console.log(`✅ 변환 완료: ${(originalSize/1024).toFixed(1)}KB → ${(webpBase64.length/1024).toFixed(1)}KB (${result.compressionRatio.toFixed(1)}% 절약)`);
          } catch (error) {
            console.warn(`⚠️ 변환 실패, 원본 유지:`, error);
            optimizedRefImages.push(imageData);
            totalOptimizedSize += originalSize;
          }
        } else {
          optimizedRefImages.push(imageData); // 작은 데이터는 그대로
          totalOptimizedSize += imageData?.length || 0;
        }
      }
    }

    // DB 업데이트
    if (hasChanges) {
      const { error: updateError } = await supabase
        .from('character')
        .update({
          referenceImages: optimizedRefImages,
          updatedAt: new Date().toISOString(),
          migrated_to_webp: true
        })
        .eq('id', characterId);

      if (updateError) {
        throw new Error(`DB 업데이트 실패: ${updateError.message}`);
      }

      const savedBytes = totalOriginalSize - totalOptimizedSize;
      const savedPercent = totalOriginalSize > 0 ? (savedBytes / totalOriginalSize) * 100 : 0;

      console.log(`🎉 '${character.name}' 최적화 완료!`);
      console.log(`💾 절약된 용량: ${(savedBytes/1024).toFixed(1)}KB (${savedPercent.toFixed(1)}%)`);

      return NextResponse.json({
        success: true,
        character: {
          id: character.id,
          name: character.name,
          originalSize: totalOriginalSize,
          optimizedSize: totalOptimizedSize,
          savedBytes: savedBytes,
          compressionRatio: savedPercent
        },
        message: `캐릭터 '${character.name}'이 WebP로 최적화되었습니다`
      });
    } else {
      return NextResponse.json({
        success: true,
        message: `캐릭터 '${character.name}'은 이미 최적화되어 있거나 최적화할 데이터가 없습니다`
      });
    }

  } catch (error) {
    console.error("수동 WebP 변환 오류:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "변환 중 오류가 발생했습니다"
      },
      { status: 500 }
    );
  }
}

// 대용량 캐릭터 목록 조회
export async function GET() {
  try {
    const supabase = await createClient();
    
    // 큰 데이터를 가진 캐릭터만 조회 (간단한 필드만)
    const { data: characters, error } = await supabase
      .from('character')
      .select('id, name')
      .limit(10);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      characters: characters || [],
      message: "수동 WebP 변환용 캐릭터 목록"
    });

  } catch (error) {
    console.error("캐릭터 목록 조회 오류:", error);
    return NextResponse.json(
      { success: false, error: "목록 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}