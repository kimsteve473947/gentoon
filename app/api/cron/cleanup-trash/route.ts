import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// API endpoint to clean up trash items older than 30 days
// This can be called by Vercel Cron, external cron service, or manually
export async function GET(req: NextRequest) {
  try {
    // Optional: Add authentication to prevent unauthorized access
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    
    // Get projects that have been in trash for more than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: oldProjects, error: fetchError } = await supabase
      .from('project')
      .select('id, title')
      .not('deletedAt', 'is', null)
      .lt('deletedAt', thirtyDaysAgo.toISOString());

    if (fetchError) {
      throw fetchError;
    }

    if (!oldProjects || oldProjects.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No projects to delete",
        deletedCount: 0
      });
    }

    const projectIds = oldProjects.map(p => p.id);
    
    // 🔄 연관 데이터 처리 전에 통계 수집
    const [panelsResult, generationsResult] = await Promise.all([
      supabase
        .from('panel')
        .select('id', { count: 'exact' })
        .in('projectId', projectIds),
      supabase
        .from('generation')
        .select('id', { count: 'exact' })
        .in('projectId', projectIds)
    ]);

    const totalPanels = panelsResult.count || 0;
    const totalGenerations = generationsResult.count || 0;

    // 📝 프로젝트 관련 Generation 완전 삭제 (깔끔한 정리)
    if (totalGenerations > 0) {
      const { error: generationDeleteError } = await supabase
        .from('generation')
        .delete()
        .in('projectId', projectIds);
      
      if (generationDeleteError) {
        console.error('Generation delete error:', generationDeleteError);
      } else {
        console.log(`✅ Deleted ${totalGenerations} generation records`);
      }
    }

    // 🗑️ 프로젝트 삭제 (CASCADE로 Panel과 ProjectCharacter 자동 삭제)
    const { error: projectDeleteError } = await supabase
      .from('project')
      .delete()
      .in('id', projectIds);

    if (projectDeleteError) {
      throw projectDeleteError;
    }

    console.log(`✅ Cleaned up ${oldProjects.length} old projects from trash`);
    console.log(`📊 Deleted data: ${totalPanels} panels, updated ${totalGenerations} generation records`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${oldProjects.length} old projects`,
      deletedCount: oldProjects.length,
      deletedProjects: oldProjects.map(p => ({ id: p.id, title: p.title })),
      statistics: {
        projectsDeleted: oldProjects.length,
        panelsDeleted: totalPanels,
        generationsUpdated: totalGenerations
      }
    });
  } catch (error) {
    console.error('Trash cleanup error:', error);
    return NextResponse.json(
      { 
        error: "Failed to clean up trash",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility
export async function POST(req: NextRequest) {
  return GET(req);
}