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
    
    // 토큰 잔액 확인 (nanoBananaService는 1290 토큰 사용)
    const requiredTokens = (job.total_panels - job.completed_panels) * 1290;
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
    
    // 🚀 연속성 있는 배치 생성을 위해 generate-batch API 사용
    try {
      // 작업 정보 조회
      const { data: jobData } = await supabase
        .from('batch_generation_job')
        .select('canvas_ratio, project_id')
        .eq('id', jobId)
        .single();
      
      if (!jobData) {
        throw new Error('배치 작업 정보를 찾을 수 없습니다');
      }

      // 패널 데이터를 generate-batch API 형식으로 변환
      const panels = pendingPanels.map(panel => ({
        order: panel.panel_order,
        prompt: panel.prompt,
        characters: Array.isArray(panel.characters) ? panel.characters : [],
        elements: Array.isArray(panel.elements) ? panel.elements : []
      }));

      // 캐릭터 ID 수집 (이름 -> ID 변환)
      const selectedCharacters = [...new Set(
        panels.flatMap(p => p.characters)
          .map(charName => {
            const character = characters.find(c => c.name === charName);
            return character?.id;
          })
          .filter(Boolean)
      )];

      // 요소 데이터 변환
      const selectedElements = [...new Set(
        panels.flatMap(p => p.elements)
          .map(elementName => {
            const element = elements.find(e => e.name === elementName);
            if (!element) return null;
            return {
              id: element.id,
              name: element.name,
              description: element.description,
              category: element.category,
              thumbnailUrl: element.thumbnailUrl,
              isSelected: true
            };
          })
          .filter(Boolean)
      )];

      console.log(`🚀 연속성 배치 생성 시작: ${panels.length}개 패널, 캐릭터: ${selectedCharacters.length}개, 요소: ${selectedElements.length}개`);

      // 🔗 editImageNanoBananaMCP를 사용한 연속성 배치 생성
      const results = [];
      let successCount = 0;
      let failCount = 0;
      let previousImageUrl: string | null = null;

      // 캐릭터 레퍼런스 준비 (characterReferenceManager 방식)
      const { characterReferenceManager } = await import('@/lib/ai/character-reference-manager');
      let referenceImages: string[] = [];

      if (selectedCharacters.length > 0) {
        try {
          const promptEnhancement = await characterReferenceManager.enhancePromptWithSelectedCharacters(
            userId,
            "웹툰 이미지 생성",
            selectedCharacters,
            jobData.canvas_ratio as '4:5' | '1:1'
          );
          referenceImages = promptEnhancement.referenceImages;
          console.log(`✅ 캐릭터 레퍼런스 로딩: ${referenceImages.length}개`);
        } catch (error) {
          console.warn('캐릭터 레퍼런스 로딩 실패:', error);
        }
      }

      // 요소 이미지 URL 준비
      const elementImageUrls = selectedElements
        .filter(element => element.isSelected && element.thumbnailUrl)
        .map(element => element.thumbnailUrl!)
        .filter(Boolean);

      // 패널 순차 처리 (연속성 있게)
      for (let i = 0; i < panels.length; i++) {
        const panel = panels[i];
        const panelId = panel.order.toString();

        try {
          console.log(`⚡ 배치 ${i + 1}/${panels.length} 패널 생성 중...`);

          let result;

          if (i === 0) {
            // 첫 번째 패널: 일반 생성
            result = await nanoBananaService.generateWebtoonPanel(
              panel.prompt,
              {
                userId: userId,
                projectId: jobData.project_id,
                panelId: parseInt(panelId),
                sessionId: `batch-${jobId}`,
                aspectRatio: jobData.canvas_ratio as '4:5' | '1:1',
                referenceImages: referenceImages,
                elementImageUrls: elementImageUrls
              }
            );
          } else {
            // 두 번째부터: editImageNanoBananaMCP 사용 (연속성)
            const characterReferences = referenceImages.map(url => ({ imageUrl: url }));

            result = await nanoBananaService.editImageNanoBananaMCP(
              previousImageUrl!,
              panel.prompt,
              characterReferences,
              jobData.canvas_ratio as '4:5' | '1:1',
              {
                userId: userId,
                panelId: parseInt(panelId),
                sessionId: `batch-${jobId}`,
                elementImageUrls: elementImageUrls
              }
            );
          }

          if (result?.imageUrl) {
            successCount++;
            results.push({
              panelIndex: i,
              panelId: panelId,
              success: true,
              imageUrl: result.imageUrl,
              generationId: `batch-${jobId}-${panelId}`,
              tokensUsed: result.tokensUsed || 1290
            });

            previousImageUrl = result.imageUrl;
            console.log(`✅ 배치 ${i + 1}/${panels.length} 패널 완료`);
          } else {
            failCount++;
            results.push({
              panelIndex: i,
              panelId: panelId,
              success: false,
              error: '이미지 생성 실패'
            });
          }

          // 패널 간 대기
          if (i < panels.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (error) {
          failCount++;
          console.error(`❌ 배치 ${i + 1}/${panels.length} 패널 오류:`, error);
          
          results.push({
            panelIndex: i,
            panelId: panelId,
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류'
          });
        }
      }

      const batchResult = {
        success: true,
        data: {
          totalPanels: panels.length,
          successCount,
          failCount,
          results,
          tokensUsed: successCount * 1290
        }
      };

      console.log(`🎉 연속성 배치 생성 완료: ${successCount}개 성공, ${failCount}개 실패`);
      
      if (successCount === 0) {
        throw new Error('모든 패널 생성이 실패했습니다');
      }

      console.log(`✅ 연속성 배치 생성 완료: ${batchResult.data.successCount}/${batchResult.data.totalPanels}개 성공`);

      // 결과를 batch_panel_result 테이블에 반영
      for (const result of batchResult.data.results) {
        const panelIndex = result.panelIndex;
        const correspondingPanel = pendingPanels.find(p => p.panel_order === panelIndex + 1);
        
        if (!correspondingPanel) continue;

        if (result.success && result.imageUrl) {
          // 성공한 패널 업데이트
          await supabase
            .from('batch_panel_result')
            .update({
              status: 'completed',
              image_url: result.imageUrl,
              generation_id: result.generationId,
              tokens_used: result.tokensUsed || 1290,
              completed_at: new Date().toISOString()
            })
            .eq('id', correspondingPanel.id);

          // panel 테이블에도 반영
          await supabase
            .from('panel')
            .upsert({
              projectId: jobData.project_id,
              order: panelIndex + 1,
              prompt: correspondingPanel.prompt,
              imageUrl: result.imageUrl
            }, {
              onConflict: 'projectId,order'
            });

          totalTokensUsed += result.tokensUsed || 1290;
          completedCount++;
        } else {
          // 실패한 패널 처리
          await supabase
            .from('batch_panel_result')
            .update({
              status: 'failed',
              error_message: result.error || '이미지 생성 실패',
              retry_count: correspondingPanel.retry_count + 1,
              completed_at: new Date().toISOString()
            })
            .eq('id', correspondingPanel.id);
        }
      }

      // 전체 작업 진행률 업데이트
      await supabase
        .from('batch_generation_job')
        .update({
          completed_panels: completedCount,
          total_tokens_used: totalTokensUsed,
          current_panel_index: batchResult.data.totalPanels - 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

    } catch (batchError) {
      console.error('연속성 배치 생성 실패:', batchError);
      throw batchError;
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