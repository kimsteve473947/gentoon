import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { usageMonitor } from "@/lib/storage/usage-monitor";
import { usageTriggers } from "@/lib/usage/cache-manager";

// 🚀 일괄 삭제 API (전체 선택 삭제용)
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
    const { projectIds, hardDelete = false } = body;

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "삭제할 프로젝트 ID 목록이 필요합니다" },
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

    // 프로젝트들 소유권 확인 
    const { data: projects } = await supabase
      .from('project')
      .select('id, title, userId')
      .in('id', projectIds)
      .eq('userId', userData.id);

    if (!projects || projects.length !== projectIds.length) {
      return NextResponse.json(
        { success: false, error: "일부 프로젝트를 찾을 수 없거나 권한이 없습니다" },
        { status: 404 }
      );
    }

    let successCount = 0;
    let errorCount = 0;
    let totalPanelCount = 0;

    if (hardDelete) {
      // 🗑️ 일괄 완전 삭제
      console.log(`🗑️ Bulk hard deleting ${projectIds.length} projects...`);

      // 통계 수집 (삭제 전 정보)
      const { count: panelCount } = await supabase
        .from('panel')
        .select('id', { count: 'exact' })
        .in('projectId', projectIds);

      totalPanelCount = panelCount || 0;

      // 프로젝트들 일괄 삭제 (CASCADE가 관련 데이터를 자동으로 처리)
      const { data: deletedProjects, error: deleteError } = await supabase
        .from('project')
        .delete()
        .in('id', projectIds)
        .select('id');

      if (deleteError) {
        console.error('❌ Bulk project delete error:', deleteError);
        throw deleteError;
      }

      successCount = deletedProjects?.length || 0;

      console.log(`✅ Bulk hard deleted ${successCount} projects with ${totalPanelCount} panels`);

    } else {
      // 🗂️ 일괄 Soft Delete (휴지통으로 이동)
      console.log(`🗂️ Bulk soft deleting ${projectIds.length} projects...`);

      const { data: updatedProjects, error: softDeleteError } = await supabase
        .from('project')
        .update({ 
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .in('id', projectIds)
        .select('id');

      if (softDeleteError) {
        throw softDeleteError;
      }

      successCount = updatedProjects?.length || 0;

      console.log(`✅ Bulk soft deleted ${successCount} projects`);
    }

    // 사용자 캐시 무효화
    usageMonitor.invalidateUserCache(userData.id);

    // 🚀 사용량 캐시 업데이트 - 프로젝트 삭제 (일괄)
    await usageTriggers.onProjectDeleted(userData.id);

    return NextResponse.json({
      success: true,
      message: hardDelete 
        ? `${successCount}개 프로젝트가 완전 삭제되었습니다`
        : `${successCount}개 프로젝트가 휴지통으로 이동되었습니다`,
      deletedCount: successCount,
      ...(hardDelete && { 
        deletedData: {
          projects: successCount,
          panels: totalPanelCount
        }
      }),
      ...(hardDelete === false && {
        restorable: true,
        restoreDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
    });

  } catch (error) {
    console.error("Bulk project delete error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "프로젝트 일괄 삭제 중 오류가 발생했습니다",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

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

    const body = await request.json();
    const { projectId, hardDelete = false } = body;

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

    // 프로젝트 소유권 확인
    const { data: project } = await supabase
      .from('project')
      .select('id, title, userId')
      .eq('id', projectId)
      .eq('userId', userData.id)
      .single();

    if (!project) {
      return NextResponse.json(
        { success: false, error: "프로젝트를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    if (hardDelete) {
      // 🗑️ 완전 삭제 (30일 후 또는 관리자 요청) - CASCADE 활용
      console.log(`🗑️ Hard deleting project ${projectId} (using CASCADE)...`);
      
      // 통계 수집 (삭제 전 정보)
      const [panelsResult] = await Promise.all([
        supabase
          .from('panel')
          .select('id', { count: 'exact' })
          .eq('projectId', projectId)
      ]);

      const panelCount = panelsResult.count || 0;

      // 프로젝트 삭제 (CASCADE가 관련 데이터를 자동으로 처리)
      const { error: deleteError } = await supabase
        .from('project')
        .delete()
        .eq('id', projectId);

      if (deleteError) {
        console.error('❌ Project delete error:', deleteError);
        throw deleteError;
      }

      // 사용자 캐시 무효화
      usageMonitor.invalidateUserCache(userData.id);

      // 🚀 사용량 캐시 업데이트 - 프로젝트 삭제 (완전 삭제)
      await usageTriggers.onProjectDeleted(userData.id);

      console.log(`✅ Hard deleted project ${projectId} with ${panelCount} panels (CASCADE)`);

      return NextResponse.json({
        success: true,
        message: "프로젝트가 완전 삭제되었습니다",
        deletedData: {
          project: 1,
          panels: panelCount
        }
      });

    } else {
      // 🗂️ Soft Delete (휴지통으로 이동)
      console.log(`🗂️ Soft deleting project ${projectId}...`);

      const { error: softDeleteError } = await supabase
        .from('project')
        .update({ 
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .eq('id', projectId);

      if (softDeleteError) {
        throw softDeleteError;
      }

      // 사용자 캐시 무효화
      usageMonitor.invalidateUserCache(userData.id);

      // 🚀 사용량 캐시 업데이트 - 프로젝트 삭제 (소프트 삭제)
      await usageTriggers.onProjectDeleted(userData.id);

      console.log(`✅ Soft deleted project ${projectId}`);

      return NextResponse.json({
        success: true,
        message: "프로젝트가 휴지통으로 이동되었습니다",
        restorable: true,
        restoreDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

  } catch (error) {
    console.error("Project delete error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "프로젝트 삭제 중 오류가 발생했습니다",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// 프로젝트 복원 API
export async function PUT(request: NextRequest) {
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
    const { projectId } = body;

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

    // 삭제된 프로젝트 확인
    const { data: deletedProject } = await supabase
      .from('project')
      .select('id, title, deletedAt')
      .eq('id', projectId)
      .eq('userId', userData.id)
      .not('deletedAt', 'is', null)
      .single();

    if (!deletedProject) {
      return NextResponse.json(
        { success: false, error: "삭제된 프로젝트를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 프로젝트 복원
    const { error: restoreError } = await supabase
      .from('project')
      .update({ 
        deletedAt: null,
        updatedAt: new Date().toISOString()
      })
      .eq('id', projectId);

    if (restoreError) {
      throw restoreError;
    }

    // 사용자 캐시 무효화
    usageMonitor.invalidateUserCache(userData.id);

    // 🚀 사용량 캐시 업데이트 - 프로젝트 복원
    await usageTriggers.onProjectCreated(userData.id);

    console.log(`✅ Restored project ${projectId}`);

    return NextResponse.json({
      success: true,
      message: "프로젝트가 복원되었습니다"
    });

  } catch (error) {
    console.error("Project restore error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "프로젝트 복원 중 오류가 발생했습니다",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}