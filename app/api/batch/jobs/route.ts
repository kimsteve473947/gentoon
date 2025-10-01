import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiResponse } from "@/lib/auth/api-middleware";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CreateBatchJobRequest {
  userId: string;
  projectId: string;
  scriptData: Array<{
    order: number;
    prompt: string;
    characters: string[];
    elements: string[];
  }>;
  canvasRatio: '1:1' | '4:5';
  totalPanels: number;
}

/**
 * 새 배치 생성 작업 생성
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return ApiResponse.unauthorized();
    }
    
    const body: CreateBatchJobRequest = await request.json();
    const { projectId, scriptData, canvasRatio, totalPanels } = body;
    
    // 프로젝트 소유권 확인
    const { data: project, error: projectError } = await supabase
      .from('project')
      .select('id, userId')
      .eq('id', projectId)
      .eq('userId', user.id)
      .single();
      
    if (projectError || !project) {
      return ApiResponse.badRequest("프로젝트를 찾을 수 없습니다");
    }
    
    // 기존 진행 중인 배치 작업 확인
    const { data: existingJob } = await supabase
      .from('batch_generation_job')
      .select('id, status')
      .eq('project_id', projectId)
      .in('status', ['pending', 'in_progress'])
      .single();
      
    if (existingJob) {
      return ApiResponse.badRequest("이미 진행 중인 배치 작업이 있습니다");
    }
    
    // 트랜잭션 시작 - 배치 작업과 패널 결과 동시 생성
    const { data: batchJob, error: jobError } = await supabase
      .from('batch_generation_job')
      .insert({
        user_id: user.id,
        project_id: projectId,
        total_panels: totalPanels,
        canvas_ratio: canvasRatio,
        script_data: scriptData,
        status: 'pending'
      })
      .select('id')
      .single();
      
    if (jobError || !batchJob) {
      console.error('배치 작업 생성 실패:', jobError);
      return ApiResponse.serverError("배치 작업 생성에 실패했습니다");
    }
    
    // 각 패널에 대한 결과 레코드 생성
    const panelResults = scriptData.map(panel => ({
      batch_job_id: batchJob.id,
      panel_order: panel.order,
      prompt: panel.prompt,
      characters: panel.characters,
      elements: panel.elements,
      status: 'pending' as const
    }));
    
    const { error: panelError } = await supabase
      .from('batch_panel_result')
      .insert(panelResults);
      
    if (panelError) {
      console.error('패널 결과 생성 실패:', panelError);
      // 롤백을 위해 배치 작업 삭제
      await supabase
        .from('batch_generation_job')
        .delete()
        .eq('id', batchJob.id);
        
      return ApiResponse.serverError("배치 작업 초기화에 실패했습니다");
    }
    
    return NextResponse.json({
      success: true,
      jobId: batchJob.id,
      message: "배치 작업이 생성되었습니다"
    });
    
  } catch (error) {
    console.error("배치 작업 생성 오류:", error);
    return ApiResponse.serverError("배치 작업 생성 중 오류가 발생했습니다");
  }
}

/**
 * 사용자의 배치 작업 목록 조회
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return ApiResponse.unauthorized();
    }
    
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');
    
    let query = supabase
      .from('batch_generation_job')
      .select(`
        id,
        project_id,
        status,
        total_panels,
        completed_panels,
        current_panel_index,
        canvas_ratio,
        total_tokens_used,
        error_message,
        started_at,
        completed_at,
        created_at,
        updated_at,
        project:project(id, title)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: jobs, error } = await query;
    
    if (error) {
      console.error('배치 작업 조회 실패:', error);
      return ApiResponse.serverError("배치 작업 조회에 실패했습니다");
    }
    
    return NextResponse.json({
      success: true,
      jobs: jobs || []
    });
    
  } catch (error) {
    console.error("배치 작업 조회 오류:", error);
    return ApiResponse.serverError("배치 작업 조회 중 오류가 발생했습니다");
  }
}