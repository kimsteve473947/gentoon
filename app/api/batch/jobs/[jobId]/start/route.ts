import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiResponse } from "@/lib/auth/api-middleware";
import { nanoBananaService } from "@/lib/ai/nano-banana-service";
import { tokenManager } from "@/lib/subscription/token-manager";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5분 타임아웃

/**
 * 배치 작업 시작/재개
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
    
    // 상태 검증
    if (job.status === 'completed') {
      return ApiResponse.badRequest("이미 완료된 작업입니다");
    }
    
    if (job.status === 'in_progress') {
      return ApiResponse.badRequest("이미 진행 중인 작업입니다");
    }
    
    // 토큰 잔액 확인
    const requiredTokens = (job.total_panels - job.completed_panels) * 2000;
    const balance = await tokenManager.getImageGenerationBalance(user.id);
    
    if (balance.remainingTokens < requiredTokens) {
      return ApiResponse.badRequest(
        `토큰이 부족합니다. 필요: ${requiredTokens.toLocaleString()}토큰, 보유: ${balance.remainingTokens.toLocaleString()}토큰`
      );
    }
    
    // 작업 상태를 'in_progress'로 변경
    const { error: updateError } = await supabase
      .from('batch_generation_job')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
      
    if (updateError) {
      console.error('배치 작업 상태 업데이트 실패:', updateError);
      return ApiResponse.serverError("작업 시작에 실패했습니다");
    }
    
    // 백그라운드에서 배치 실행 (비동기)
    processBatchJobAsync(jobId, user.id);
    
    return NextResponse.json({
      success: true,
      message: "배치 작업이 시작되었습니다",
      jobId
    });
    
  } catch (error) {
    console.error("배치 작업 시작 오류:", error);
    return ApiResponse.serverError("배치 작업 시작 중 오류가 발생했습니다");
  }
}

/**
 * 비동기 배치 처리 함수
 */
async function processBatchJobAsync(jobId: string, userId: string) {
  const supabase = await createClient();
  
  try {
    // 처리해야 할 패널들 조회
    const { data: pendingPanels, error: panelError } = await supabase
      .from('batch_panel_result')
      .select('*')
      .eq('batch_job_id', jobId)
      .in('status', ['pending', 'failed'])
      .order('panel_order');
      
    if (panelError || !pendingPanels) {
      throw new Error('패널 조회 실패: ' + panelError?.message);
    }
    
    // 사용자 캐릭터와 요소 조회
    const [charactersResult, elementsResult] = await Promise.all([
      supabase
        .from('character')
        .select('id, name, description, thumbnailUrl, ratioImages')
        .eq('userId', userId),
      supabase
        .from('element')
        .select('id, name, description, category, thumbnailUrl')
        .eq('userId', userId)
    ]);
    
    const characters = charactersResult.data || [];
    const elements = elementsResult.data || [];
    
    let totalTokensUsed = 0;
    let completedCount = 0;
    
    // 각 패널 순차 처리
    for (const panel of pendingPanels) {
      try {
        // 패널 상태를 'in_progress'로 업데이트
        await supabase
          .from('batch_panel_result')
          .update({
            status: 'in_progress',
            started_at: new Date().toISOString()
          })
          .eq('id', panel.id);
        
        // 전체 작업 진행 상황 업데이트
        await supabase
          .from('batch_generation_job')
          .update({
            current_panel_index: panel.panel_order - 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);
        
        // 캐릭터 레퍼런스 수집
        const characterReferences = panel.characters
          .map((charName: string) => {
            const character = characters.find(c => c.name === charName);
            if (!character) return null;
            
            // 비율에 따른 이미지 선택 로직 필요
            return {
              name: character.name,
              description: character.description,
              imageUrl: character.thumbnailUrl
            };
          })
          .filter(Boolean);
        
        // AI 이미지 생성
        const { data: job } = await supabase
          .from('batch_generation_job')
          .select('canvas_ratio')
          .eq('id', jobId)
          .single();
          
        const response = await nanoBananaService.generateImage(
          panel.prompt,
          job?.canvas_ratio || '4:5',
          characterReferences,
          {
            requestType: 'batch_generation',
            panelIndex: panel.panel_order,
            totalPanels: pendingPanels.length
          }
        );
        
        if (response?.imageUrl) {
          // 성공 시 패널 결과 업데이트
          await supabase
            .from('batch_panel_result')
            .update({
              status: 'completed',
              image_url: response.imageUrl,
              generation_id: response.generationId,
              tokens_used: response.tokensUsed || 2000,
              completed_at: new Date().toISOString()
            })
            .eq('id', panel.id);
          
          totalTokensUsed += response.tokensUsed || 2000;
          completedCount++;
          
          // 패널 테이블에도 업데이트 (generationId 제거)
          await supabase
            .from('panel')
            .upsert({
              projectId: (await supabase.from('batch_generation_job').select('project_id').eq('id', jobId).single()).data?.project_id,
              order: panel.panel_order,
              prompt: panel.prompt,
              imageUrl: response.imageUrl
            }, {
              onConflict: 'projectId,order'
            });
          
        } else {
          throw new Error('이미지 생성 실패');
        }
        
        // 진행률 업데이트
        await supabase
          .from('batch_generation_job')
          .update({
            completed_panels: completedCount,
            total_tokens_used: totalTokensUsed,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);
        
        // 레이트 리미트 방지 대기
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (panelError) {
        console.error(`패널 ${panel.panel_order} 생성 실패:`, panelError);
        
        // 실패 처리
        await supabase
          .from('batch_panel_result')
          .update({
            status: 'failed',
            error_message: panelError instanceof Error ? panelError.message : String(panelError),
            retry_count: panel.retry_count + 1,
            completed_at: new Date().toISOString()
          })
          .eq('id', panel.id);
      }
    }
    
    // 전체 작업 완료 처리
    const { data: finalResults } = await supabase
      .from('batch_panel_result')
      .select('status')
      .eq('batch_job_id', jobId);
    
    const allCompleted = finalResults?.every(r => r.status === 'completed');
    const finalStatus = allCompleted ? 'completed' : 'failed';
    
    await supabase
      .from('batch_generation_job')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
    
    // 토큰 사용량 기록
    if (totalTokensUsed > 0) {
      await tokenManager.useImageGenerationTokens(
        userId,
        totalTokensUsed,
        {
          requestType: 'batch_generation',
          description: `배치 생성: ${completedCount}개 패널 완료`
        }
      );
    }
    
  } catch (error) {
    console.error('배치 처리 실패:', error);
    
    // 실패 상태로 업데이트
    await supabase
      .from('batch_generation_job')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}