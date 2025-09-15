import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { imageStorage } from "@/lib/storage/image-storage";

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
    
    const body = await request.json();
    const { path, bucket = "webtoonImages", paths } = body;
    
    if (!path && !paths) {
      return NextResponse.json(
        { success: false, error: "삭제할 파일 경로가 제공되지 않았습니다" },
        { status: 400 }
      );
    }
    
    // 경로가 사용자 폴더 내에 있는지 확인
    const checkPath = (p: string) => p.startsWith(`${user.id}/`);
    
    if (path && !checkPath(path)) {
      return NextResponse.json(
        { success: false, error: "권한이 없는 파일입니다" },
        { status: 403 }
      );
    }
    
    if (paths && !paths.every(checkPath)) {
      return NextResponse.json(
        { success: false, error: "권한이 없는 파일이 포함되어 있습니다" },
        { status: 403 }
      );
    }
    
    // 삭제 실행
    let success: boolean;
    if (paths && Array.isArray(paths)) {
      success = await imageStorage.deleteImages(paths, bucket as any);
    } else if (path) {
      success = await imageStorage.deleteImage(path, bucket as any);
    } else {
      success = false;
    }
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: "파일 삭제에 실패했습니다" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: "파일이 성공적으로 삭제되었습니다",
    });
  } catch (error) {
    console.error("Image delete API error:", error);
    return NextResponse.json(
      { success: false, error: "이미지 삭제 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}