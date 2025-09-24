import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CharacterWebPMigrator } from "@/scripts/migrate-characters-to-webp";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5분 타임아웃 (대용량 처리)

export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 체크 (임시로 개발 모드에서만 허용)
    if (process.env.NODE_ENV !== 'development') {
      // 프로덕션에서는 특정 API 키 또는 관리자 권한 필요
      const { headers } = request;
      const adminKey = headers.get('x-admin-key');
      
      if (adminKey !== process.env.ADMIN_API_KEY) {
        return NextResponse.json(
          { success: false, error: "관리자 권한이 필요합니다" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const { 
      mode = 'full', // 'full', 'test', 'specific'
      characterId = null,
      batchSize = 5 
    } = body;

    console.log(`🚀 WebP 마이그레이션 시작 (모드: ${mode})`);
    
    // Supabase 클라이언트 생성
    const supabase = await createClient();
    const migrator = new CharacterWebPMigrator(supabase);
    let result;

    switch (mode) {
      case 'test':
        // 테스트 모드: 1개만 처리
        console.log('🧪 테스트 모드: 첫 번째 캐릭터만 처리');
        result = await migrator.migrateAllCharacters(1);
        break;
        
      case 'specific':
        // 특정 캐릭터 처리
        if (!characterId) {
          return NextResponse.json(
            { success: false, error: "특정 모드에서는 characterId가 필요합니다" },
            { status: 400 }
          );
        }
        await migrator.migrateSpecificCharacter(characterId);
        result = { message: `캐릭터 ${characterId} 처리 완료` };
        break;
        
      case 'full':
      default:
        // 전체 마이그레이션
        console.log(`🔄 전체 마이그레이션 (배치 크기: ${batchSize})`);
        result = await migrator.migrateAllCharacters(batchSize);
        break;
    }

    return NextResponse.json({
      success: true,
      mode,
      result,
      message: "WebP 마이그레이션이 완료되었습니다"
    });

  } catch (error) {
    console.error("WebP 마이그레이션 오류:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "마이그레이션 중 오류가 발생했습니다",
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

// 마이그레이션 상태 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'status') {
      // 마이그레이션 상태 체크
      const { data: characters, error } = await supabase
        .from('character')
        .select(`
          id, 
          name,
          migrated_to_webp,
          LENGTH(referenceImages::text) as ref_size,
          LENGTH(ratioImages::text) as ratio_size,
          CASE 
            WHEN thumbnailUrl LIKE '%.webp' THEN 'webp'
            WHEN thumbnailUrl LIKE '%.jpg' OR thumbnailUrl LIKE '%.jpeg' THEN 'jpeg' 
            WHEN thumbnailUrl LIKE '%.png' THEN 'png'
            ELSE 'unknown'
          END as thumbnail_format
        `)
        .order('ref_size', { ascending: false })
        .limit(20);

      if (error) {
        throw error;
      }

      const stats = {
        totalCharacters: characters.length,
        migratedCount: characters.filter(c => c.migrated_to_webp).length,
        webpThumbnails: characters.filter(c => c.thumbnail_format === 'webp').length,
        totalDataSize: characters.reduce((sum, c) => sum + (c.ref_size || 0) + (c.ratio_size || 0), 0),
        topLargestCharacters: characters.slice(0, 10).map(c => ({
          id: c.id,
          name: c.name,
          size: `${((c.ref_size || 0) + (c.ratio_size || 0)) / 1024}KB`,
          migrated: c.migrated_to_webp || false,
          thumbnailFormat: c.thumbnail_format
        }))
      };

      return NextResponse.json({
        success: true,
        stats
      });
    }

    return NextResponse.json({
      success: true,
      message: "WebP 마이그레이션 API - POST로 실행, GET?action=status로 상태 확인"
    });

  } catch (error) {
    console.error("마이그레이션 상태 조회 오류:", error);
    return NextResponse.json(
      { success: false, error: "상태 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}