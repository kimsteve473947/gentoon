import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { geminiClient } from "@/lib/ai/gemini-client";
import { tokenManager } from "@/lib/subscription/token-manager";
import { recordTokenUsage, AI_MODELS } from "@/lib/subscription/token-usage";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }
    
    const userId = user.id;
    const body = await request.json();
    const { storyPrompt, characterNames, panelCount, style } = body;
    
    if (!storyPrompt) {
      return NextResponse.json(
        { success: false, error: "스토리 프롬프트가 필요합니다" },
        { status: 400 }
      );
    }

    // 토큰 잔액 확인 (대본 생성은 1토큰 사용)
    const balanceInfo = await tokenManager.getBalance(userId);
    
    if (balanceInfo.balance < 1) {
      return NextResponse.json(
        { 
          success: false, 
          error: "토큰이 부족합니다",
          balance: balanceInfo.balance
        },
        { status: 402 }
      );
    }

    // 캐릭터 정보 문자열 생성
    const characterInfo = characterNames && characterNames.length > 0 
      ? `등장 캐릭터: ${characterNames.join(', ')}`
      : '';

    // AI 대본 생성 프롬프트 (웹툰 이미지 생성에 최적화)
    const scriptPrompt = `
당신은 웹툰 제작 전문가입니다. 주어진 스토리를 기반으로 ${panelCount}개 컷의 웹툰 대본을 만들어주세요.

스토리: ${storyPrompt}
${characterInfo}
컷 수: ${panelCount}컷

**중요 규칙 (반드시 준수):**

1. **이미지 생성 전용**: 각 컷은 AI가 그림을 그릴 수 있도록 시각적 장면만 묘사
2. **텍스트 금지**: 대사, 말풍선, 텍스트, 나레이션 절대 포함 금지
3. **메타 표현 금지**: "프레임", "패널", "컷", "만화" 등의 단어 사용 금지
4. **구체적 시각 묘사**: 인물 표정, 동작, 배경, 분위기, 조명, 색감 상세 설명
5. **웹툰 스타일**: 한국 웹툰 특유의 감정 표현과 연출 고려
6. **캐릭터 일관성**: 등장인물이 있다면 컷마다 일관된 외모 유지

출력 형식 (JSON만):
{
  "panels": [
    {
      "order": 1,
      "prompt": "웹툰 스타일로 그릴 구체적인 장면 묘사",
      "characters": ["등장하는 캐릭터 이름들"]
    }
  ]
}

좋은 예시:
"따뜻한 오후 햇살이 비치는 카페, 창가 테이블에 앉아 커피컵을 두 손으로 감싸며 미소짓는 20대 여성, 부드러운 갈색 머리, 화이트 니트, 배경은 흐릿하게 처리된 다른 손님들"

나쁜 예시:
"'안녕하세요'라고 인사하는 장면", "대화하는 모습", "1번째 패널"

JSON 형식으로만 응답하세요:`;

    console.log('🤖 Sending prompt to Gemini:', scriptPrompt.substring(0, 200) + '...');

    // Gemini로 대본 생성
    const response = await geminiClient.generateContent(scriptPrompt);
    
    if (!response?.text) {
      throw new Error('AI 응답을 받지 못했습니다');
    }

    console.log('🔍 Raw Gemini response:', response.text);
    console.log('📊 Token usage from API:', response.usage);

    // JSON 파싱 개선
    let scriptData;
    try {
      let cleanResponse = response.text.trim();
      
      // 마크다운 코드 블록 제거
      cleanResponse = cleanResponse.replace(/```json\s*/g, '');
      cleanResponse = cleanResponse.replace(/```\s*$/g, '');
      
      // JSON이 아닌 텍스트가 앞뒤에 있다면 제거
      const jsonStart = cleanResponse.indexOf('{');
      const jsonEnd = cleanResponse.lastIndexOf('}') + 1;
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        cleanResponse = cleanResponse.substring(jsonStart, jsonEnd);
      }
      
      console.log('🧹 Cleaned response:', cleanResponse);
      
      scriptData = JSON.parse(cleanResponse);
      
      // 패널 데이터 검증
      if (!scriptData.panels || !Array.isArray(scriptData.panels)) {
        throw new Error('응답에 panels 배열이 없습니다');
      }
      
    } catch (parseError) {
      console.error('❌ JSON 파싱 실패:', parseError);
      console.error('❌ 원본 응답:', response.text);
      
      // 폴백: 간단한 대본 생성
      const fallbackPanels = Array.from({ length: panelCount }, (_, i) => ({
        order: i + 1,
        prompt: `${storyPrompt}에 관련된 장면 ${i + 1}, 웹툰 스타일로 그려진 감정적인 순간`,
        characters: characterNames || []
      }));
      
      scriptData = { panels: fallbackPanels };
    }

    // ✅ 실제 Google AI API 토큰 사용량 기록
    const tokenResult = await recordTokenUsage({
      userId,
      serviceType: 'text_generation',
      modelName: AI_MODELS.TEXT_GENERATION,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      totalTokens: response.usage.totalTokens,
      metadata: {
        requestType: 'script_generation',
        panelCount,
        storyLength: storyPrompt.length,
        hasCharacters: (characterNames?.length || 0) > 0
      }
    });

    console.log(`✅ Recorded ${response.usage.totalTokens} tokens for script generation`);

    return NextResponse.json({
      success: true,
      panels: scriptData.panels || [],
      tokensUsed: response.usage.totalTokens, // 실제 사용된 토큰
      cost: tokenResult.cost
    });

  } catch (error) {
    console.error("Script generation error:", error);
    const errorMessage = error instanceof Error ? error.message : "대본 생성 중 오류가 발생했습니다";
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}