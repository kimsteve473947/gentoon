import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "프로젝트 ID가 필요합니다" },
        { status: 400 }
      );
    }

    // 사용자 정보 조회
    const { data: userData } = await supabase
      .from('user')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json(
        { success: false, error: "사용자 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 프로젝트 정보 조회
    const { data: project, error: projectError } = await supabase
      .from('project')
      .select('*')
      .eq('id', projectId)
      .eq('userId', userData.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: "프로젝트를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 패널 정보 조회 (generation 테이블과 JOIN하여 imageUrl 가져오기)
    const { data: panels } = await supabase
      .from('panel')
      .select(`
        *,
        generation:generationId (
          id,
          imageUrl,
          thumbnailUrl
        )
      `)
      .eq('projectId', projectId)
      .order('order', { ascending: true });

    // 스튜디오 스토어 형식으로 변환
    const studioData = {
      currentProject: {
        id: project.id,
        name: project.title,
        description: project.description || '',
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        isAutoSaving: false,
      },
      panels: (panels || []).map(panel => ({
        id: panel.id,
        prompt: panel.prompt || '',
        imageUrl: panel.generation?.imageUrl || panel.imageUrl, // generation 테이블에서 URL 가져오기
        generationId: panel.generationId,
        isGenerating: false,
        generatedAt: panel.updatedAt,
        content: panel.editData?.content || '',
        settings: panel.editData?.settings || {},
        metadata: panel.editData?.metadata || {},
      }))
    };

    return NextResponse.json({
      success: true,
      ...studioData
    });

  } catch (error) {
    console.error("Project load error:", error);
    return NextResponse.json(
      { success: false, error: "프로젝트 로드 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}