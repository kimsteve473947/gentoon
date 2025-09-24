import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export async function POST(request: NextRequest) {
  try {
    // 관리자 인증 검증
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // 토큰으로 사용자 정보 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({
        success: false,
        error: 'Admin access required'
      }, { status: 403 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const thumbnailFile = formData.get('thumbnail') as File | null;
    
    if (!files || files.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No files provided'
      }, { status: 400 });
    }

    // 파일 크기 및 타입 검증
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    // 웹툰 이미지 검증
    for (const file of files) {
      if (file.size > maxSize) {
        return NextResponse.json({
          success: false,
          error: `File ${file.name} is too large. Maximum size is 10MB.`
        }, { status: 400 });
      }

      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({
          success: false,
          error: `File ${file.name} has invalid type. Allowed types: JPEG, PNG, WebP, GIF.`
        }, { status: 400 });
      }
    }

    // 썸네일 파일 검증
    if (thumbnailFile) {
      if (thumbnailFile.size > maxSize) {
        return NextResponse.json({
          success: false,
          error: `Thumbnail ${thumbnailFile.name} is too large. Maximum size is 10MB.`
        }, { status: 400 });
      }

      if (!allowedTypes.includes(thumbnailFile.type)) {
        return NextResponse.json({
          success: false,
          error: `Thumbnail ${thumbnailFile.name} has invalid type. Allowed types: JPEG, PNG, WebP, GIF.`
        }, { status: 400 });
      }
    }

    // 파일들을 Supabase Storage에 업로드
    const uploadedUrls: string[] = [];
    let thumbnailUrl: string | undefined;
    
    // 웹툰 이미지들 업로드
    for (const file of files) {
      try {
        // 파일을 ArrayBuffer로 변환
        const fileBuffer = await file.arrayBuffer();
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `webtoon/${fileName}`;

        // Supabase Storage에 업로드
        const { data, error } = await supabase.storage
          .from('uploads')
          .upload(filePath, fileBuffer, {
            contentType: file.type,
            upsert: false
          });

        if (error) {
          console.error('Supabase storage error:', error);
          throw error;
        }

        // 공개 URL 생성
        const { data: { publicUrl } } = supabase.storage
          .from('uploads')
          .getPublicUrl(filePath);
        
        uploadedUrls.push(publicUrl);
      } catch (uploadError) {
        console.error('Upload error for file:', file.name, uploadError);
        return NextResponse.json({
          success: false,
          error: `Failed to upload file: ${file.name}`
        }, { status: 500 });
      }
    }

    // 썸네일 업로드 (있는 경우)
    if (thumbnailFile) {
      try {
        const fileBuffer = await thumbnailFile.arrayBuffer();
        const fileExt = thumbnailFile.name.split('.').pop();
        const fileName = `thumbnail-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `webtoon/${fileName}`;

        // Supabase Storage에 업로드
        const { data, error } = await supabase.storage
          .from('uploads')
          .upload(filePath, fileBuffer, {
            contentType: thumbnailFile.type,
            upsert: false
          });

        if (error) {
          console.error('Thumbnail upload error:', error);
          throw error;
        }

        // 공개 URL 생성
        const { data: { publicUrl } } = supabase.storage
          .from('uploads')
          .getPublicUrl(filePath);
        
        thumbnailUrl = publicUrl;
      } catch (uploadError) {
        console.error('Thumbnail upload error:', uploadError);
        return NextResponse.json({
          success: false,
          error: `Failed to upload thumbnail: ${thumbnailFile.name}`
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        urls: uploadedUrls,
        thumbnailUrl: thumbnailUrl,
        count: uploadedUrls.length
      },
      message: `Successfully uploaded ${uploadedUrls.length} files${thumbnailUrl ? ' and thumbnail' : ''}`
    });

  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// 파일 삭제 API
export async function DELETE(request: NextRequest) {
  try {
    // 관리자 인증 검증
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // 토큰으로 사용자 정보 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({
        success: false,
        error: 'Admin access required'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'File URL is required'
      }, { status: 400 });
    }

    // Supabase Storage에서 파일 삭제
    try {
      // URL에서 파일 경로 추출
      const urlParts = url.split('/uploads/');
      if (urlParts.length !== 2) {
        throw new Error('Invalid file URL format');
      }
      
      const filePath = urlParts[1];
      
      const { error: deleteError } = await supabase.storage
        .from('uploads')
        .remove([filePath]);
      
      if (deleteError) {
        console.error('File deletion error:', deleteError);
        throw deleteError;
      }
    } catch (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json({
        success: false,
        error: 'Failed to delete file'
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'File deletion requested'
    });

  } catch (error) {
    console.error('Delete API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}