import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SecureLogger } from "@/lib/utils/secure-logger";

// 🚀 초고속 캐릭터 조회 API
export async function GET(request: NextRequest) {
  try {
    SecureLogger.lightningFast('⚡ [Lightning-Fast Characters] Loading from real database');
    
    // 실제 데이터베이스 사용 (개발/프로덕션 동일)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const startTime = Date.now();
    
    // 🚀 최적화된 단일 쿼리 - user 테이블 조회 없이 직접 character 조회
    const { data: characters, error } = await supabase
      .from('character')
      .select('id, name, thumbnailUrl, description, createdAt')
      .eq('userId', user.id)
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);

    const queryTime = Date.now() - startTime;
    SecureLogger.lightningFast(`⚡ [Lightning-Fast Characters] Query completed in ${queryTime}ms, returned ${characters?.length || 0} characters`);

    if (error) {
      SecureLogger.error('Character query error', error);
      return NextResponse.json(
        { success: false, error: "캐릭터 조회 중 오류가 발생했습니다" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      characters: characters || [],
      source: 'database',
      queryTime: queryTime
    });

  } catch (error) {
    SecureLogger.error('Lightning-fast characters error', error);
    return NextResponse.json(
      { success: false, error: "캐릭터 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}