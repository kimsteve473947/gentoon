import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiResponse } from "@/lib/auth/api-middleware";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 배치 작업 상세 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return ApiResponse.unauthorized();
    }
    
    const { jobId } = params;
    
    // 배치 작업 조회
    const { data: job, error: jobError } = await supabase
      .from('batch_generation_job')
      .select(`
        *,
        project:project(id, title, userId)
      `)
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();
      
    if (jobError || !job) {
      return ApiResponse.notFound("배치 작업을 찾을 수 없습니다");
    }
    
    // 패널 결과 조회
    const { data: panelResults, error: panelError } = await supabase
      .from('batch_panel_result')
      .select('*')
      .eq('batch_job_id', jobId)
      .order('panel_order');
      
    if (panelError) {
      console.error('패널 결과 조회 실패:', panelError);
      return ApiResponse.serverError("패널 결과 조회에 실패했습니다");
    }
    
    return NextResponse.json({
      success: true,
      job: {
        ...job,
        panelResults: panelResults || []
      }
    });
    
  } catch (error) {
    console.error("배치 작업 조회 오류:", error);
    return ApiResponse.serverError("배치 작업 조회 중 오류가 발생했습니다");
  }
}

/**
 * 배치 작업 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string } }
): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return ApiResponse.unauthorized();
    }
    
    const { jobId } = params;
    
    // 배치 작업 소유권 확인
    const { data: job, error: jobError } = await supabase
      .from('batch_generation_job')
      .select('id, status, user_id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();
      
    if (jobError || !job) {
      return ApiResponse.notFound("배치 작업을 찾을 수 없습니다");
    }
    
    // 진행 중인 작업은 삭제 불가
    if (job.status === 'in_progress') {
      return ApiResponse.badRequest("진행 중인 작업은 삭제할 수 없습니다. 먼저 취소해주세요.");
    }
    
    // 배치 작업 삭제 (CASCADE로 관련 데이터도 자동 삭제)
    const { error: deleteError } = await supabase
      .from('batch_generation_job')
      .delete()
      .eq('id', jobId);
      
    if (deleteError) {
      console.error('배치 작업 삭제 실패:', deleteError);
      return ApiResponse.serverError("배치 작업 삭제에 실패했습니다");
    }
    
    return NextResponse.json({
      success: true,
      message: "배치 작업이 삭제되었습니다"
    });
    
  } catch (error) {
    console.error("배치 작업 삭제 오류:", error);
    return ApiResponse.serverError("배치 작업 삭제 중 오류가 발생했습니다");
  }
}