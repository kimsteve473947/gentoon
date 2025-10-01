import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiResponse } from "@/lib/auth/api-middleware";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 실패한 패널들 재시도
 */
export async function POST(
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
    
    // 배치 작업 조회 및 권한 확인
    const { data: job, error: jobError } = await supabase
      .from('batch_generation_job')
      .select('id, status, user_id, total_panels, completed_panels')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();
      
    if (jobError || !job) {
      return ApiResponse.notFound("배치 작업을 찾을 수 없습니다");
    }
    
    // 상태 검증
    if (job.status === 'in_progress') {
      return ApiResponse.badRequest("진행 중인 작업은 재시도할 수 없습니다");
    }
    
    if (job.status === 'cancelled') {
      return ApiResponse.badRequest("취소된 작업은 재시도할 수 없습니다");
    }
    
    // 실패한 패널이 있는지 확인
    const { data: failedPanels, error: panelError } = await supabase
      .from('batch_panel_result')
      .select('id, panel_order, retry_count')
      .eq('batch_job_id', jobId)
      .eq('status', 'failed');
      
    if (panelError) {
      console.error('실패한 패널 조회 실패:', panelError);
      return ApiResponse.serverError("실패한 패널 조회에 실패했습니다");
    }
    
    if (!failedPanels || failedPanels.length === 0) {
      return ApiResponse.badRequest("재시도할 실패한 패널이 없습니다");
    }
    
    // 최대 재시도 횟수 확인 (예: 3회)
    const maxRetries = 3;
    const retriablePanels = failedPanels.filter(panel => panel.retry_count < maxRetries);
    
    if (retriablePanels.length === 0) {
      return ApiResponse.badRequest("모든 실패한 패널이 최대 재시도 횟수에 도달했습니다");
    }
    
    // 실패한 패널들을 'pending' 상태로 되돌리기
    const { error: resetError } = await supabase
      .from('batch_panel_result')
      .update({
        status: 'pending',
        error_message: null,
        started_at: null,
        completed_at: null
      })
      .in('id', retriablePanels.map(p => p.id));
      
    if (resetError) {
      console.error('패널 상태 리셋 실패:', resetError);
      return ApiResponse.serverError("패널 상태 리셋에 실패했습니다");
    }
    
    // 배치 작업 상태를 'pending'으로 변경
    const { error: jobResetError } = await supabase
      .from('batch_generation_job')
      .update({
        status: 'pending',
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
      
    if (jobResetError) {
      console.error('배치 작업 상태 리셋 실패:', jobResetError);
      return ApiResponse.serverError("작업 상태 리셋에 실패했습니다");
    }
    
    return NextResponse.json({
      success: true,
      message: `${retriablePanels.length}개의 실패한 패널이 재시도 대기 상태로 변경되었습니다`,
      retriablePanelsCount: retriablePanels.length,
      totalFailedPanels: failedPanels.length
    });
    
  } catch (error) {
    console.error("배치 작업 재시도 오류:", error);
    return ApiResponse.serverError("배치 작업 재시도 중 오류가 발생했습니다");
  }
}