import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nanoBananaService } from "@/lib/ai/nano-banana-service";
import { tokenManager } from "@/lib/subscription/token-manager";
import { ApiResponse } from "@/lib/auth/api-middleware";
import { ErrorCode } from "@/lib/errors/error-types";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5분 타임아웃 - 배치 생성은 더 긴 시간 필요

interface ScriptPanel {
  order: number;
  prompt: string;
  characters: string[];
  elements: string[];
}

interface BatchGenerationRequest {
  panels: ScriptPanel[];
  canvasRatio: '1:1' | '4:5';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Supabase 인증 확인
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return ApiResponse.unauthorized();
    }
    
    const userId = user.id;
    
    let requestBody: BatchGenerationRequest;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      return ApiResponse.badRequest("잘못된 요청 형식입니다");
    }

    const { panels, canvasRatio } = requestBody;
    
    if (!panels || !Array.isArray(panels) || panels.length === 0) {
      return ApiResponse.badRequest("패널 정보가 필요합니다");
    }

    if (panels.length > 10) {
      return ApiResponse.badRequest("한 번에 최대 10개 패널까지 생성 가능합니다");
    }

    if (!canvasRatio || !['1:1', '4:5'].includes(canvasRatio)) {
      return ApiResponse.badRequest("올바른 캔버스 비율을 선택해주세요");
    }

    // 토큰 잔액 확인 (배치 생성은 더 많은 토큰 필요)
    const requiredTokens = panels.length * 2000; // 패널당 대략 2000토큰 예상
    
    let balance;
    try {
      balance = await tokenManager.getImageGenerationBalance(userId);
    } catch (balanceError) {
      console.error("토큰 잔액 조회 실패:", balanceError);
      return ApiResponse.errorWithCode(
        ErrorCode.SERVER_ERROR,
        "토큰 잔액 확인 중 오류가 발생했습니다"
      );
    }
    
    if (balance.remainingTokens < requiredTokens) {
      return ApiResponse.errorWithCode(
        ErrorCode.INSUFFICIENT_TOKENS,
        `이미지 생성 토큰이 부족합니다 (${balance.userPlan} 플랜: ${balance.remainingTokens.toLocaleString()}/${balance.monthlyLimit.toLocaleString()}토큰 잔여, 필요: ${requiredTokens.toLocaleString()}토큰)`
      );
    }

    // 사용자의 캐릭터와 요소 정보 조회
    const [charactersResult, elementsResult] = await Promise.all([
      supabase
        .from('character')
        .select('id, name, description, thumbnailUrl, squareRatioUrl, portraitRatioUrl')
        .eq('userId', userId),
      supabase
        .from('element')
        .select('id, name, description, category, thumbnailUrl')
        .eq('userId', userId)
    ]);

    const characters = charactersResult.data || [];
    const elements = elementsResult.data || [];

    console.log(`🚀 배치 생성 시작: ${panels.length}개 패널, ${canvasRatio} 비율`);

    // 배치로 이미지 생성
    const generatedImages = [];
    let totalTokensUsed = 0;

    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      
      try {
        console.log(`🎨 패널 ${i + 1}/${panels.length} 생성 중...`);

        // 캐릭터 레퍼런스 이미지 수집
        const characterReferences = panel.characters
          .map(charName => {
            const character = characters.find(c => c.name === charName);
            if (!character) return null;
            
            // 캔버스 비율에 따라 적절한 이미지 선택
            const referenceUrl = canvasRatio === '1:1' 
              ? character.squareRatioUrl 
              : character.portraitRatioUrl;
            
            return {
              name: character.name,
              description: character.description,
              imageUrl: referenceUrl
            };
          })
          .filter(Boolean);

        // 요소 레퍼런스 정보 수집
        const elementReferences = panel.elements
          .map(elemName => {
            const element = elements.find(e => e.name === elemName || elemName.includes(e.name));
            if (!element) return null;
            
            return {
              name: element.name,
              description: element.description,
              category: element.category
            };
          })
          .filter(Boolean);

        // AI 이미지 생성
        const response = await nanoBananaService.generateImage(
          panel.prompt,
          canvasRatio,
          characterReferences,
          { 
            requestType: 'batch_generation',
            panelIndex: i + 1,
            totalPanels: panels.length
          }
        );

        if (response?.imageUrl) {
          generatedImages.push({
            order: panel.order,
            imageUrl: response.imageUrl,
            prompt: panel.prompt,
            characters: panel.characters,
            elements: panel.elements,
            tokensUsed: response.tokensUsed || 2000
          });
          
          totalTokensUsed += response.tokensUsed || 2000;
          console.log(`✅ 패널 ${i + 1} 생성 완료 (${response.tokensUsed}토큰 사용)`);
        } else {
          throw new Error(`패널 ${i + 1} 이미지 생성 실패`);
        }

        // 배치 생성 간 잠시 대기 (API 레이트 리미트 방지)
        if (i < panels.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (panelError) {
        console.error(`❌ 패널 ${i + 1} 생성 실패:`, panelError);
        
        // 부분 실패 시에도 이미 생성된 이미지들은 반환
        return NextResponse.json({
          success: false,
          error: `패널 ${i + 1} 생성 중 오류가 발생했습니다`,
          partialResults: generatedImages,
          totalTokensUsed
        }, { status: 207 }); // 207 Multi-Status
      }
    }

    // 토큰 사용량 기록
    try {
      await tokenManager.useImageGenerationTokens(
        userId,
        totalTokensUsed,
        {
          requestType: 'batch_generation',
          description: `배치 생성: ${panels.length}개 패널 (총 ${totalTokensUsed.toLocaleString()}토큰)`
        }
      );
    } catch (tokenError) {
      console.error("토큰 차감 처리 실패:", tokenError);
      // 토큰 기록 실패해도 이미지는 성공적으로 생성됨
    }

    console.log(`🎉 배치 생성 완료: ${panels.length}개 패널, 총 ${totalTokensUsed.toLocaleString()}토큰 사용`);

    return NextResponse.json({
      success: true,
      message: `${panels.length}개 패널이 성공적으로 생성되었습니다`,
      generatedImages,
      totalTokensUsed,
      remainingTokens: balance.remainingTokens - totalTokensUsed
    });

  } catch (error) {
    console.error("배치 생성 오류:", error);
    
    let userMessage = "배치 생성 중 예상치 못한 오류가 발생했습니다";
    let errorCode = ErrorCode.SERVER_ERROR;
    
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('deadline')) {
        errorCode = ErrorCode.GENERATION_TIMEOUT;
        userMessage = "배치 생성이 시간을 초과했습니다. 패널 수를 줄이고 다시 시도해주세요.";
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        errorCode = ErrorCode.NETWORK_ERROR;
        userMessage = "네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.";
      }
    }
    
    return ApiResponse.errorWithCode(errorCode, userMessage, String(error));
  }
}