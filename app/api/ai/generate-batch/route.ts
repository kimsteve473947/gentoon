import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tokenManager } from "@/lib/subscription/token-manager";
import { checkAndResetTokensIfNeeded } from "@/lib/subscription/token-reset";
import { characterReferenceManager } from "@/lib/ai/character-reference-manager";
import { multiPanelContinuityEngine, type MPCPanel } from "@/lib/ai/multi-panel-continuity";
import type { AspectRatio } from "@/lib/ai/prompt-templates";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5분 타임아웃 - 배치 생성용

interface ScriptPanel {
  order: number;
  prompt: string;
  characters: string[];
  elements: string[];
}

interface Element {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnailUrl?: string;
  isSelected?: boolean;
}

interface BatchGenerationRequest {
  panels: ScriptPanel[];
  selectedCharacters: string[];
  selectedElements: Element[];
  aspectRatio: AspectRatio;
  projectId: string;
  settings?: {
    highResolution?: boolean;
    saveCharacter?: boolean;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Supabase 인증 확인
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: '로그인이 필요합니다'
      }, { status: 401 });
    }
    
    const userId = user.id;
    console.log(`🚀 [배치 생성] 사용자: ${userId}`);
    const body: BatchGenerationRequest = await request.json();
    const { panels, selectedCharacters, selectedElements, aspectRatio, projectId, settings } = body;
    
    console.log(`📋 [배치 생성] 패널 수: ${panels.length}, 캐릭터: ${selectedCharacters.length}, 요소: ${selectedElements.length}`);

    if (!panels || panels.length === 0) {
      return NextResponse.json({
        success: false,
        error: "생성할 패널이 없습니다"
      }, { status: 400 });
    }

    if (panels.length > 10) {
      return NextResponse.json({
        success: false,
        error: "한 번에 최대 10개 패널까지만 생성할 수 있습니다"
      }, { status: 400 });
    }

    // 토큰 확인 (nanobananaMCP 방식 - 단순화)
    await checkAndResetTokensIfNeeded(userId);
    const balanceInfo = await tokenManager.getBalance(userId);
    
    const requiredTokens = panels.length * 1290; // nanobananaMCP와 일치
    
    if (balanceInfo.balance < requiredTokens) {
      console.log(`❌ [배치 생성] 토큰 부족: 필요 ${requiredTokens}, 잔여 ${balanceInfo.balance}`);
      return NextResponse.json({
        success: false,
        error: `토큰이 부족합니다. 필요: ${panels.length}장 (${requiredTokens.toLocaleString()} 토큰), 잔여: ${balanceInfo.estimatedImagesRemaining}장`
      }, { status: 402 });
    }

    console.log(`✅ [배치 생성] 토큰 확인 완료: ${balanceInfo.balance.toLocaleString()} 토큰`);

    // 배치 생성 ID 생성
    const batchId = `batch_${userId}_${Date.now()}`;
    
    // 캐릭터 레퍼런스 준비 (기존 API와 동일한 방식)
    let referenceImages: string[] = [];

    if (selectedCharacters.length > 0) {
      console.log(`🎭 [배치 생성] 캐릭터 레퍼런스 로딩: ${selectedCharacters.length}개`);
      
      try {
        // 기존 API와 동일한 방식: enhancePromptWithSelectedCharacters 사용
        const promptEnhancement = await characterReferenceManager.enhancePromptWithSelectedCharacters(
          userId,
          "웹툰 이미지 생성", // 기본 프롬프트
          selectedCharacters,
          aspectRatio
        );

        referenceImages = promptEnhancement.referenceImages;

        console.log(`✅ [배치 생성] 캐릭터 레퍼런스 로딩 완료: ${referenceImages.length}개`);
      } catch (error) {
        console.error(`❌ [배치 생성] 캐릭터 레퍼런스 로딩 실패:`, error);
        // 캐릭터 레퍼런스 실패시에도 계속 진행
      }
    }

    // 요소 이미지 URL 준비 (nanobananaMCP 방식)
    const elementImageUrls = selectedElements
      .filter(element => element.isSelected && element.thumbnailUrl)
      .map(element => element.thumbnailUrl!)
      .filter(Boolean);

    console.log(`🎯 [배치 생성] 요소 이미지: ${elementImageUrls.length}개`);

    // 🚀 우리만의 MPC(Multi-Panel Continuity) 시스템 사용
    console.log(`🚀 [MPC 배치] 시작: ${panels.length}개 패널 연속성 생성`);

    // 패널 데이터를 MPC 형식으로 변환
    const mpcPanels: MPCPanel[] = panels.map(panel => ({
      order: panel.order,
      prompt: panel.prompt,
      characters: panel.characters,
      elements: panel.elements
    }));

    // MPC 엔진 옵션 설정
    const mpcOptions = {
      userId: userId,
      projectId: projectId,
      aspectRatio: aspectRatio,
      characterReferences: referenceImages,
      elementImageUrls: elementImageUrls,
      sessionId: `mpc-batch-${Date.now()}`
    };

    try {
      // MPC 엔진으로 연속성 있는 배치 생성
      const mpcResult = await multiPanelContinuityEngine.generateBatchWithContinuity(
        mpcPanels,
        mpcOptions
      );

      console.log(`🎉 [MPC 배치] 완료: ${mpcResult.successCount}/${mpcResult.totalPanels}개 성공, 평균 연속성: ${mpcResult.averageContinuityScore.toFixed(1)}점`);

      // MPC 결과를 기존 API 형식으로 변환
      const results = mpcResult.results.map(result => ({
        panelIndex: result.panelIndex,
        panelId: (result.panelIndex + 1).toString(),
        success: result.success,
        imageUrl: result.imageUrl,
        thumbnailUrl: result.thumbnailUrl,
        generationId: `mpc-${mpcOptions.sessionId}-${result.panelIndex + 1}`,
        tokensUsed: result.tokensUsed,
        error: result.error,
        continuityScore: result.continuityScore // MPC만의 추가 정보
      }));

      const successCount = mpcResult.successCount;
      const failCount = mpcResult.failCount;
      const totalTokensUsed = mpcResult.totalTokensUsed;

      return NextResponse.json({
        success: true,
        data: {
          batchId: `mpc-${mpcOptions.sessionId}`,
          totalPanels: panels.length,
          successCount,
          failCount,
          results,
          tokensUsed: totalTokensUsed,
          averageContinuityScore: mpcResult.averageContinuityScore,
          sessionId: mpcResult.sessionId
        },
        message: `MPC 배치 생성 완료: ${successCount}/${panels.length}개 성공 (평균 연속성: ${mpcResult.averageContinuityScore.toFixed(1)}점)`
      });

    } catch (mpcError) {
      console.error("❌ [MPC 배치] 생성 실패:", mpcError);
      return NextResponse.json({
        success: false,
        error: mpcError instanceof Error ? mpcError.message : "MPC 배치 생성 중 오류가 발생했습니다"
      }, { status: 500 });
    }

  } catch (error) {
    console.error("❌ [배치 생성] API 오류:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "배치 생성 중 오류가 발생했습니다"
    }, { status: 500 });
  }
}