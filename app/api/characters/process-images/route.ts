import { NextRequest, NextResponse } from 'next/server';
import { processCharacterImages } from '@/lib/services/character-image-processor-supabase';
import { createBrowserClient } from '@supabase/ssr';

/**
 * 캐릭터 이미지를 다양한 비율로 처리하는 API
 * Sharp 라이브러리를 서버 사이드에서만 사용
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { referenceImages, userId } = body;

    if (!referenceImages || !Array.isArray(referenceImages) || referenceImages.length === 0) {
      return NextResponse.json(
        { success: false, error: '레퍼런스 이미지가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('📸 캐릭터 이미지 처리 시작:', referenceImages.length, '개 이미지');

    // 이미지 처리 실행
    const result = await processCharacterImages(referenceImages, userId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    console.log('✅ 캐릭터 이미지 처리 완료:', result.ratioImages);

    return NextResponse.json({
      success: true,
      ratioImages: result.ratioImages,
      message: '이미지 처리가 완료되었습니다.'
    });

  } catch (error) {
    console.error('캐릭터 이미지 처리 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '이미지 처리 중 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET 요청으로 처리된 이미지 조회 (테스트용)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json(
      { success: false, error: '사용자 ID가 필요합니다.' },
      { status: 400 }
    );
  }

  try {
    // Supabase에서 사용자의 캐릭터 조회
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: characters, error } = await supabase
      .from('character')
      .select('id, name, ratioImages')
      .eq('userId', userId)
      .not('ratioImages', 'is', null);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      characters: characters || []
    });

  } catch (error) {
    console.error('캐릭터 조회 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '캐릭터 조회 중 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
}