import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nanoBananaService } from "@/lib/ai/nano-banana-service";
import { tokenManager } from "@/lib/subscription/token-manager";
import { checkAndResetTokensIfNeeded } from "@/lib/subscription/token-reset";
import { characterReferenceManager } from "@/lib/ai/character-reference-manager";
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
    let characterDescriptions: string = "";
    
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
        characterDescriptions = promptEnhancement.characterDescriptions;
        
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

    // 🚀 nanobananaMCP 방식: 단순 배치 생성
    const results = [];
    let successCount = 0;
    let failCount = 0;

    console.log(`🚀 [배치 생성] 시작: ${panels.length}개 패널`);

    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      const panelId = `${i + 1}`;
      
      try {
        console.log(`⚡ [배치 생성] ${i + 1}/${panels.length} 패널 생성 중...`);
        
        // 기존 API와 동일한 방식: generationQueue 사용
        const result = await nanoBananaService.generateWebtoonPanel(
          panel.prompt,
          {
            userId: userId,
            projectId: projectId,
            panelId: panelId,
            sessionId: `batch-${Date.now()}`,
            aspectRatio: aspectRatio,
            referenceImages: referenceImages, // 전체 캐릭터 레퍼런스 사용
            elementImageUrls: elementImageUrls
          }
        );

        if (result?.imageUrl) {
          successCount++;
          results.push({
            panelIndex: i,
            panelId: panelId,
            success: true,
            imageUrl: result.imageUrl,
            generationId: result.generationId || `batch-${panelId}`,
            tokensUsed: result.tokensUsed || 1290
          });
          
          console.log(`✅ [배치 생성] ${i + 1}/${panels.length} 패널 완료`);
        } else {
          failCount++;
          results.push({
            panelIndex: i,
            panelId: panelId,
            success: false,
            error: result?.error || '이미지 생성 실패'
          });
          
          console.error(`❌ [배치 생성] ${i + 1}/${panels.length} 패널 실패:`, result?.error);
        }

        // 패널 간 짧은 대기 (API 레이트 리미트 방지)
        if (i < panels.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        failCount++;
        console.error(`❌ [배치 생성] ${i + 1}/${panels.length} 패널 오류:`, error);
        
        results.push({
          panelIndex: i,
          panelId: panelId,
          success: false,
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        });
      }
    }

    console.log(`🎉 [배치 생성] 완료: 성공 ${successCount}개, 실패 ${failCount}개`);

    return NextResponse.json({
      success: true,
      data: {
        batchId,
        totalPanels: panels.length,
        successCount,
        failCount,
        results,
        tokensUsed: successCount * 1290
      },
      message: `배치 생성 완료: ${successCount}/${panels.length}개 성공`
    });

  } catch (error) {
    console.error("❌ [배치 생성] API 오류:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "배치 생성 중 오류가 발생했습니다"
    }, { status: 500 });
  }
}