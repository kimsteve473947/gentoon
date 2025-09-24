import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 🗑️ 최적화된 휴지통 프로젝트 조회 API
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // 쿼리 파라미터
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const offset = (page - 1) * limit;

    // 🗑️ 삭제된 프로젝트 조회 (썸네일 포함)
    const { data: deletedProjects, error: projectsError } = await supabase
      .from('project')
      .select(`
        id, 
        title, 
        "deletedAt",
        "thumbnailUrl",
        "createdAt",
        "panelCount",
        "hasContent"
      `)
      .eq('userId', user.id)
      .not('deletedAt', 'is', null)
      .order('deletedAt', { ascending: false })
      .limit(limit);

    if (projectsError) {
      console.error('Deleted projects query error:', projectsError);
      console.error('Query details:', {
        userId: user.id,
        offset,
        limit,
        page
      });
      return NextResponse.json(
        { 
          success: false, 
          error: "삭제된 프로젝트 조회 중 오류가 발생했습니다",
          details: process.env.NODE_ENV === 'development' ? projectsError.message : undefined
        },
        { status: 500 }
      );
    }

    if (!deletedProjects || deletedProjects.length === 0) {
      return NextResponse.json({
        success: true,
        projects: [],
        pagination: {
          page,
          limit,
          hasMore: false,
          total: 0
        }
      });
    }

    // 🗑️ 삭제 상태 계산 (실제 데이터 포함)
    const processedProjects = deletedProjects.map((project) => {
      const deletedAt = new Date(project.deletedAt);
      const now = new Date();
      const daysLeft = 30 - Math.floor((now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24));

      // 패널 수 가져오기 (DB에서 이미 계산된 값)
      const panelCount = project.panelCount || 0;

      return {
        id: project.id,
        title: project.title || '무제 프로젝트',
        deletedAt: project.deletedAt,
        createdAt: project.createdAt,
        // 🗑️ 휴지통 필수 정보
        daysLeft: Math.max(0, daysLeft),
        canRestore: daysLeft > 0,
        // 실제 프로젝트 데이터
        panelCount: panelCount,
        thumbnail: project.thumbnailUrl,
        status: 'deleted',
        hasContent: project.hasContent || panelCount > 0,
        contentSummary: panelCount > 0 ? `${panelCount}개 패널` : '빈 프로젝트',
        updatedAt: project.deletedAt,
        lastEditedAt: project.deletedAt
      };
    });

    // hasMore 계산 (다음 페이지가 있는지)
    const hasMore = deletedProjects.length === limit;

    return NextResponse.json({
      success: true,
      projects: processedProjects,
      pagination: {
        page,
        limit,
        hasMore,
        total: null // 성능을 위해 총 개수는 제공하지 않음
      }
    });

  } catch (error) {
    console.error('Trash projects API error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error
    });
    return NextResponse.json(
      { 
        success: false, 
        error: "삭제된 프로젝트 조회 중 오류가 발생했습니다",
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500 }
    );
  }
}