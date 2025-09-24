import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // 사용자 인증 확인
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: '로그인이 필요합니다'
      }, { status: 401 });
    }

    // FormData에서 파일 가져오기
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({
        success: false,
        error: '파일이 제공되지 않았습니다'
      }, { status: 400 });
    }

    // 파일 크기 검사 (5MB 제한)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({
        success: false,
        error: '파일 크기는 5MB 이하여야 합니다'
      }, { status: 400 });
    }

    // 파일 타입 검사
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({
        success: false,
        error: '이미지 파일만 업로드 가능합니다'
      }, { status: 400 });
    }

    // 파일명 생성 (사용자 ID + 타임스탬프)
    const fileName = `avatars/${user.id}-${Date.now()}-${file.name}`;

    // Supabase Storage에 파일 업로드
    const fileBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        cacheControl: '31536000', // 1년 캐시
        upsert: false
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      throw new Error('파일 업로드에 실패했습니다');
    }

    // 공개 URL 생성
    const { data: { publicUrl } } = supabase.storage
      .from('uploads')
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      message: '프로필 사진이 성공적으로 업로드되었습니다'
    });

  } catch (error) {
    console.error('Avatar upload error:', error);
    return NextResponse.json({
      success: false,
      error: '업로드 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}