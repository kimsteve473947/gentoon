import { NextRequest, NextResponse } from 'next/server';
import { createClient } from "@/lib/supabase/server";
import { nanoBananaService } from "@/lib/ai/nano-banana-service";
import { tokenManager } from "@/lib/subscription/token-manager";

export async function POST(request: NextRequest) {
  try {
    // 사용자 인증
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }
    
    const userId = user.id;
    console.log(`👤 캐릭터 생성 요청 - 사용자: ${userId}`);

    const { prompt } = await request.json();

    if (!prompt?.trim()) {
      return NextResponse.json(
        { success: false, error: '캐릭터 설명 프롬프트가 필요합니다' },
        { status: 400 }
      );
    }

    // 토큰 잔액 확인
    const balanceInfo = await tokenManager.getBalance(userId);
    
    if (balanceInfo.estimatedImagesRemaining < 1) {
      return NextResponse.json(
        { 
          success: false, 
          error: "토큰이 부족합니다", 
          required: 1,
          balance: balanceInfo.balance,
          canGenerate: balanceInfo.estimatedImagesRemaining
        },
        { status: 402 }
      );
    }

    // 캐릭터 생성 전용 프롬프트 최적화 (1:1 비율, 배경 없음 강제)
    const optimizedPrompt = `Character reference sheet: ${prompt}

MANDATORY REQUIREMENTS:
- 1:1 aspect ratio (square format) - REQUIRED
- NO background (transparent or pure white) - REQUIRED  
- Character centered in frame
- Full body or upper body character design
- Korean webtoon/manhwa art style
- Clean professional character design
- High detail and clarity
- Consistent art style suitable for webtoon
- Vibrant but natural colors
- Perfect for character reference usage
- Focus 100% on character design only`;

    console.log('🎨 캐릭터 생성 프롬프트:', optimizedPrompt);

    // nanoBananaService로 직접 이미지 생성 (1:1 비율 강제)
    const result = await nanoBananaService.generateWebtoonPanel(
      optimizedPrompt,
      {
        userId: userId,
        selectedCharacterIds: [], // 캐릭터 생성이므로 빈 배열
        referenceImages: [], // 새 캐릭터 생성이므로 레퍼런스 없음
        aspectRatio: '1:1', // 캐릭터 생성은 항상 1:1 비율
        style: 'character_reference',
        width: 1024,
        height: 1024
      }
    );

    // Google Gemini API 실제 토큰 사용량을 기반으로 사용자 토큰 차감
    console.log(`🔢 캐릭터 생성 - 실제 Gemini API 토큰 사용량: ${result.tokensUsed}`);
    
    const tokenResult = await tokenManager.useActualTokensFromGemini(
      userId, 
      result.tokensUsed, // 실제 Gemini API에서 사용된 토큰 수
      { 
        imageCount: 1,
        saveCharacter: true,
        description: `캐릭터 생성: 1개 (실제 토큰: ${result.tokensUsed})`
      }
    );
    
    if (!tokenResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: tokenResult.error || "토큰 차감 실패",
          remainingTokens: tokenResult.remainingTokens
        },
        { status: 500 }
      );
    }

    console.log('✅ 캐릭터 생성 완료:', result.imageUrl);

    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
      thumbnailUrl: result.thumbnailUrl,
      tokensUsed: result.tokensUsed,
      remainingTokens: tokenResult.remainingTokens,
      message: '캐릭터가 성공적으로 생성되었습니다 (1:1 비율, 배경 없음)'
    });

  } catch (error) {
    console.error('캐릭터 생성 실패:', error);
    
    let errorMessage = '캐릭터 생성 중 오류가 발생했습니다';
    
    if (error instanceof Error) {
      if (error.message.includes('API_KEY') || error.message.includes('인증')) {
        errorMessage = 'AI 서비스 인증 오류입니다';
      } else if (error.message.includes('quota') || error.message.includes('토큰')) {
        errorMessage = 'AI 서비스 사용량이 초과되었습니다';
      } else if (error.message.includes('timeout') || error.message.includes('시간')) {
        errorMessage = '생성 시간이 초과되었습니다. 다시 시도해주세요';
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}