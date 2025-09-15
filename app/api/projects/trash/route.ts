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

    const offset = (page - 1) * limit;

    // 🗑️ 초간단 삭제된 프로젝트 조회 (필수 필드만)
    const { data: deletedProjects, error: projectsError } = await supabase
      .from('project')
      .select(`
        id, 
        title, 
        "deletedAt"
      `)
      .eq('userId', userData.id)
      .not('deletedAt', 'is', null)
      .order('deletedAt', { ascending: false })
      .limit(limit);

    if (projectsError) {
      console.error('Deleted projects query error:', projectsError);
      return NextResponse.json(
        { success: false, error: "삭제된 프로젝트 조회 중 오류가 발생했습니다" },
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

    // 🗑️ 초간단 삭제 상태 계산
    const processedProjects = deletedProjects.map((project) => {
      const deletedAt = new Date(project.deletedAt);
      const now = new Date();
      const daysLeft = 30 - Math.floor((now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: project.id,
        title: project.title || '무제 프로젝트',
        deletedAt: project.deletedAt,
        // 🗑️ 휴지통 필수 정보만
        daysLeft: Math.max(0, daysLeft),
        canRestore: daysLeft > 0,
        // 기본값들
        panelCount: 0,
        thumbnail: null,
        status: 'deleted',
        hasContent: false,
        contentSummary: '삭제된 프로젝트',
        createdAt: project.deletedAt,
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
    return NextResponse.json(
      { success: false, error: "삭제된 프로젝트 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}