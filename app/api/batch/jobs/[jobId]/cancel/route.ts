import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiResponse } from "@/lib/auth/api-middleware";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 배치 작업 취소
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
      .select('id, status, user_id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();
      
    if (jobError || !job) {
      return ApiResponse.notFound("배치 작업을 찾을 수 없습니다");
    }
    
    // 상태 검증
    if (job.status === 'completed') {
      return ApiResponse.badRequest("이미 완료된 작업은 취소할 수 없습니다");
    }
    
    if (job.status === 'cancelled') {
      return ApiResponse.badRequest("이미 취소된 작업입니다");
    }
    
    if (job.status === 'failed') {
      return ApiResponse.badRequest("실패한 작업은 취소할 수 없습니다");
    }
    
    // 배치 작업 상태를 'cancelled'로 변경
    const { error: updateError } = await supabase
      .from('batch_generation_job')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
      
    if (updateError) {
      console.error('배치 작업 취소 실패:', updateError);
      return ApiResponse.serverError("작업 취소에 실패했습니다");
    }
    
    // 진행 중인 패널들을 'skipped' 상태로 변경
    const { error: panelUpdateError } = await supabase
      .from('batch_panel_result')
      .update({
        status: 'skipped',
        completed_at: new Date().toISOString()
      })
      .eq('batch_job_id', jobId)
      .in('status', ['pending', 'in_progress']);
      
    if (panelUpdateError) {
      console.error('패널 상태 업데이트 실패:', panelUpdateError);
      // 배치 작업 취소는 성공했으므로 계속 진행
    }
    
    return NextResponse.json({
      success: true,
      message: "배치 작업이 취소되었습니다"
    });
    
  } catch (error) {
    console.error("배치 작업 취소 오류:", error);
    return ApiResponse.serverError("배치 작업 취소 중 오류가 발생했습니다");
  }
}