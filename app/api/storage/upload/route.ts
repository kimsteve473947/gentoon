import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { imageStorage } from "@/lib/storage/image-storage";

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
    const file = formData.get("file") as File;
    const bucket = formData.get("bucket") as string || "webtoonImages";
    const projectId = formData.get("projectId") as string | null;
    const characterId = formData.get("characterId") as string | null;
    const prompt = formData.get("prompt") as string | null;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: "파일이 제공되지 않았습니다" },
        { status: 400 }
      );
    }
    
    // 파일 크기 체크 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "파일 크기는 10MB를 초과할 수 없습니다" },
        { status: 400 }
      );
    }
    
    // 파일 타입 체크
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: "이미지 파일만 업로드 가능합니다" },
        { status: 400 }
      );
    }
    
    // 이미지 업로드
    const uploadResult = await imageStorage.uploadImage(
      file,
      bucket as any,
      user.id
    );
    
    // 썸네일 생성
    const thumbnailUrl = await imageStorage.createThumbnail(
      uploadResult.url,
      user.id
    );
    
    // 메타데이터 저장
    if (projectId || characterId || prompt) {
      await imageStorage.saveImageMetadata({
        url: uploadResult.url,
        path: uploadResult.path,
        userId: user.id,
        projectId: projectId || undefined,
        characterId: characterId || undefined,
        prompt: prompt || undefined,
      });
    }
    
    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      thumbnailUrl,
      path: uploadResult.path,
      size: uploadResult.size,
    });
  } catch (error) {
    console.error("Image upload API error:", error);
    return NextResponse.json(
      { success: false, error: "이미지 업로드 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 이미지 목록 조회
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
    
    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get("bucket") || "webtoonImages";
    const limit = parseInt(searchParams.get("limit") || "50");
    
    const images = await imageStorage.listUserImages(
      user.id,
      bucket as any,
      limit
    );
    
    return NextResponse.json({
      success: true,
      images,
      count: images.length,
    });
  } catch (error) {
    console.error("List images API error:", error);
    return NextResponse.json(
      { success: false, error: "이미지 목록 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}