import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "파일이 필요합니다" },
        { status: 400 }
      );
    }

    // 파일 형식 검증
    const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "지원하지 않는 파일 형식입니다. JPG, PNG, SVG, WebP만 가능합니다." },
        { status: 400 }
      );
    }

    // 파일 크기 검증 (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: "파일 크기는 10MB를 초과할 수 없습니다" },
        { status: 400 }
      );
    }

    // 사용자 스토리지 사용량 확인
    const { data: storageData } = await supabase
      .from('user_storage')
      .select('used_bytes, max_bytes')
      .eq('userId', user.id)
      .single();

    if (storageData && storageData.used_bytes + file.size > storageData.max_bytes) {
      return NextResponse.json(
        { success: false, error: "스토리지 용량이 부족합니다" },
        { status: 400 }
      );
    }

    // 파일명 생성 (중복 방지) - 안전한 파일명으로 변환
    const timestamp = Date.now();
    // 파일명에서 확장자 분리
    const fileExtension = file.name.split('.').pop() || '';
    // 파일명을 안전하게 변환 (한글, 공백, 특수문자 제거)
    const safeName = file.name
      .replace(/\.[^/.]+$/, '') // 확장자 제거
      .replace(/[^a-zA-Z0-9-_]/g, '_') // 영문, 숫자, 하이픈, 언더스코어만 허용
      .replace(/_+/g, '_') // 연속된 언더스코어를 하나로
      .replace(/^_|_$/g, '') // 시작과 끝의 언더스코어 제거
      .slice(0, 50); // 최대 50자로 제한
    
    const fileName = `${user.id}/${timestamp}_${safeName || 'file'}.${fileExtension}`;

    // Supabase Storage에 업로드
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      console.error('Upload details:', {
        fileName,
        fileSize: file.size,
        fileType: file.type,
        userId: user.id
      });
      return NextResponse.json(
        { success: false, error: `파일 업로드에 실패했습니다: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // 공개 URL 생성
    const { data: { publicUrl } } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(fileName);

    // file_metadata 테이블에 저장
    const { data: fileMetadata, error: metadataError } = await supabase
      .from('file_metadata')
      .insert({
        userId: user.id,
        project_id: projectId || null,
        file_name: file.name,
        file_path: fileName,
        file_size: file.size,
        file_type: file.type.split('/')[0], // 'image'
        mime_type: file.type
      })
      .select()
      .single();

    if (metadataError) {
      console.error('Metadata insert error:', metadataError);
      // 메타데이터 저장 실패 시 업로드된 파일 삭제
      await supabase.storage.from('user-uploads').remove([fileName]);
      return NextResponse.json(
        { success: false, error: "파일 정보 저장에 실패했습니다" },
        { status: 500 }
      );
    }

    // user_storage 업데이트
    if (storageData) {
      await supabase
        .from('user_storage')
        .update({ 
          used_bytes: storageData.used_bytes + file.size,
          file_count: (storageData as any).file_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('userId', user.id);
    } else {
      // 첫 번째 파일인 경우 user_storage 생성
      await supabase
        .from('user_storage')
        .insert({
          userId: user.id,
          used_bytes: file.size,
          file_count: 1,
          max_bytes: 1073741824 // 1GB 기본값
        });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: fileMetadata.id,
        name: file.name,
        url: publicUrl,
        type: file.type,
        size: file.size,
        created_at: fileMetadata.created_at
      }
    });

  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 업로드된 파일 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId');

    let query = supabase
      .from('file_metadata')
      .select('*')
      .eq('userId', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    } else {
      query = query.is('project_id', null); // 글로벌 업로드만
    }

    const { data: files, error } = await query;

    if (error) {
      console.error('Files fetch error:', error);
      return NextResponse.json(
        { success: false, error: "파일 목록 조회에 실패했습니다" },
        { status: 500 }
      );
    }

    // 공개 URL 생성
    const filesWithUrls = files.map(file => {
      const { data: { publicUrl } } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(file.file_path);

      return {
        id: file.id,
        name: file.file_name,
        url: publicUrl,
        type: file.mime_type,
        size: file.file_size,
        created_at: file.created_at
      };
    });

    return NextResponse.json({
      success: true,
      data: filesWithUrls
    });

  } catch (error) {
    console.error('Get files API error:', error);
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 파일 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const { fileId } = await request.json();

    if (!fileId) {
      return NextResponse.json(
        { success: false, error: "파일 ID가 필요합니다" },
        { status: 400 }
      );
    }

    // 파일 정보 조회
    const { data: fileData, error: fetchError } = await supabase
      .from('file_metadata')
      .select('*')
      .eq('id', fileId)
      .eq('userId', user.id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !fileData) {
      return NextResponse.json(
        { success: false, error: "파일을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // Storage에서 파일 삭제
    const { error: deleteError } = await supabase.storage
      .from('user-uploads')
      .remove([fileData.file_path]);

    if (deleteError) {
      console.error('Storage delete error:', deleteError);
      return NextResponse.json(
        { success: false, error: "파일 삭제에 실패했습니다" },
        { status: 500 }
      );
    }

    // 메타데이터 soft delete
    await supabase
      .from('file_metadata')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', fileId);

    // user_storage 업데이트
    const { data: storageData } = await supabase
      .from('user_storage')
      .select('used_bytes, file_count')
      .eq('userId', user.id)
      .single();

    if (storageData) {
      await supabase
        .from('user_storage')
        .update({ 
          used_bytes: Math.max(0, storageData.used_bytes - fileData.file_size),
          file_count: Math.max(0, storageData.file_count - 1),
          updated_at: new Date().toISOString()
        })
        .eq('userId', user.id);
    }

    return NextResponse.json({
      success: true,
      message: "파일이 삭제되었습니다"
    });

  } catch (error) {
    console.error('Delete file API error:', error);
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}