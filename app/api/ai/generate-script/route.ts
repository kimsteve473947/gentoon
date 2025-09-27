import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nanoBananaService } from "@/lib/ai/nano-banana-service";
import { tokenManager } from "@/lib/subscription/token-manager";
import { ApiResponse, ApiResponse as ApiResponseInterface } from "@/lib/auth/api-middleware";
import { ErrorCode } from "@/lib/errors/error-types";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2분 타임아웃 - 성능 최적화

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponseInterface>> {
  try {
    // Supabase 인증 확인
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return ApiResponse.unauthorized();
    }
    
    const userId = user.id;
    
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      return ApiResponse.badRequest("잘못된 요청 형식입니다");
    }

    const { storyPrompt, characterNames, elementNames, panelCount, style } = requestBody;
    
    if (!storyPrompt || typeof storyPrompt !== 'string' || storyPrompt.trim().length === 0) {
      return ApiResponse.badRequest("스토리 프롬프트가 필요합니다");
    }

    if (storyPrompt.length > 2000) {
      return ApiResponse.badRequest("스토리 프롬프트는 2000자를 초과할 수 없습니다");
    }

    if (panelCount && (panelCount < 1 || panelCount > 20)) {
      return ApiResponse.badRequest("패널 개수는 1-20개 사이여야 합니다");
    }

    // 🎯 단순한 AI 대본 생성 횟수 확인
    let scriptBalance;
    try {
      scriptBalance = await tokenManager.getScriptGenerationBalance(userId);
    } catch (balanceError) {
      console.error("대본 생성 횟수 조회 실패:", balanceError);
      return ApiResponse.errorWithCode(
        ErrorCode.SERVER_ERROR,
        "대본 생성 횟수 확인 중 오류가 발생했습니다",
        String(balanceError)
      );
    }
    
    if (scriptBalance.remainingGenerations < 1) {
      return ApiResponse.errorWithCode(
        ErrorCode.INSUFFICIENT_TOKENS,
        `AI 대본 생성 횟수가 부족합니다 (${scriptBalance.userPlan} 플랜: ${scriptBalance.remainingGenerations}/${scriptBalance.monthlyLimit}회 잔여)`
      );
    }

    // 캐릭터 정보 문자열 생성
    const characterInfo = characterNames && characterNames.length > 0 
      ? `등장 캐릭터: ${characterNames.join(', ')}`
      : '';

    // 요소 정보 문자열 생성  
    const elementInfo = elementNames && elementNames.length > 0
      ? `등장 요소: ${elementNames.join(', ')}`
      : '';

    // 🎨 구글 최적화 기반 한국어 웹툰 프롬프트 생성
    const scriptPrompt = `
웹툰 스토리를 ${panelCount}개 컷의 이미지 생성 프롬프트로 변환하세요.

스토리: ${storyPrompt}
${characterInfo}
${elementInfo}

**규칙:**
- 각 프롬프트 **100-200자** 제한
- 한국어로 작성
- 대사/텍스트 금지, 시각적 장면만
- 카메라 용어 사용: "클로즈업", "미디엄샷", "와이드샷"

**출력 형식** (JSON):
{
  "panels": [
    {
      "order": 1,
      "prompt": "클로즈업으로 잡힌 카페 안 여성이 따뜻한 오후 햇살 속에서 양손으로 커피컵을 감싸며 부드럽게 미소짓는 모습, 갈색 머리, 흰색 니트, 뒤쪽은 흐릿한 다른 손님들",
      "characters": ["캐릭터이름들"],
      "elements": ["요소이름들"]
    }
  ]
}

한국어로만 응답하세요:`;

    console.log('🤖 Sending prompt to Vertex AI:', scriptPrompt.substring(0, 200) + '...');

    // Vertex AI (Gemini)로 대본 생성 - 텍스트 생성 모드
    let response;
    try {
      response = await nanoBananaService.generateText(scriptPrompt);
    } catch (aiError) {
      console.error('AI 서비스 호출 실패:', aiError);
      
      // AI 서비스 에러의 종류에 따른 세분화된 처리
      if (aiError instanceof Error) {
        if (aiError.message.includes('timeout') || aiError.message.includes('deadline')) {
          return ApiResponse.generationTimeout("AI 스크립트 생성이 시간을 초과했습니다. 더 간단한 스토리로 다시 시도해주세요.");
        }
        if (aiError.message.includes('quota') || aiError.message.includes('limit')) {
          return ApiResponse.errorWithCode(ErrorCode.RATE_LIMIT_EXCEEDED, "AI 서비스 사용량이 한도를 초과했습니다. 잠시 후 다시 시도해주세요.");
        }
        if (aiError.message.includes('safety') || aiError.message.includes('policy')) {
          return ApiResponse.errorWithCode(ErrorCode.INVALID_PROMPT, "부적절한 콘텐츠가 감지되었습니다. 다른 스토리로 시도해주세요.");
        }
      }
      
      return ApiResponse.aiServiceError("AI 스크립트 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
    
    if (!response?.text) {
      return ApiResponse.aiServiceError('AI에서 유효한 응답을 받지 못했습니다');
    }

    console.log('🔍 Raw Vertex AI response:', response.text);
    console.log('📊 Token usage from Vertex AI:', response.tokensUsed);

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
      
      // 패널 데이터 검증 및 최적화
      if (!scriptData.panels || !Array.isArray(scriptData.panels)) {
        throw new Error('응답에 panels 배열이 없습니다');
      }
      
      // 🎯 각 패널 프롬프트 길이 검증 및 최적화
      scriptData.panels = scriptData.panels.map((panel: any, index: number) => {
        let prompt = panel.prompt || '';
        
        // 100-200자 제한 적용
        if (prompt.length < 100) {
          console.warn(`⚠️ Panel ${index + 1} prompt too short (${prompt.length} chars), enhancing...`);
          // 짧으면 보강
          prompt = `${prompt}. Korean webtoon style, detailed character expressions, vibrant colors, professional illustration quality.`;
        } else if (prompt.length > 200) {
          console.warn(`⚠️ Panel ${index + 1} prompt too long (${prompt.length} chars), truncating...`);
          // 길면 자르기
          prompt = prompt.substring(0, 197) + '...';
        }
        
        console.log(`📏 Panel ${index + 1} prompt: ${prompt.length} chars`);
        
        return {
          ...panel,
          prompt,
          characters: panel.characters || characterNames || [],
          elements: panel.elements || elementNames || [],
          shot_type: panel.shot_type || 'medium shot',
          mood: panel.mood || 'neutral'
        };
      });
      
    } catch (parseError) {
      console.error('❌ JSON 파싱 실패:', parseError);
      console.error('❌ 원본 응답:', response.text);
      
      // 🚨 폴백: 구글 최적화 방식으로 대본 생성
      const fallbackPanels = Array.from({ length: panelCount }, (_, i) => {
        const shotTypes = ['close-up shot', 'medium shot', 'wide shot'];
        const moods = ['cheerful', 'dramatic', 'serene', 'tense', 'nostalgic'];
        const lighting = ['soft natural light', 'warm golden hour', 'bright daylight', 'gentle morning light'];
        
        const shotType = shotTypes[i % shotTypes.length];
        const mood = moods[i % moods.length];
        const light = lighting[i % lighting.length];
        
        // 100-200자 최적화된 프롬프트 생성
        const optimizedPrompt = `${shotType} of characters in ${storyPrompt} scene, ${mood} atmosphere, ${light}, Korean webtoon style, detailed expressions, vibrant colors, professional digital art quality`;
        
        return {
          order: i + 1,
          prompt: optimizedPrompt.length > 200 ? optimizedPrompt.substring(0, 197) + '...' : optimizedPrompt,
          characters: characterNames || [],
          elements: elementNames || [],
          shot_type: shotType.replace(' shot', ''),
          mood: mood
        };
      });
      
      scriptData = { panels: fallbackPanels };
    }

    // 🎯 단순한 AI 대본 생성 횟수 1회 차감
    console.log(`📝 대본 생성 완료 - AI 토큰 사용량: ${response.tokensUsed.toLocaleString()}`);
    
    let generationResult;
    try {
      generationResult = await tokenManager.useScriptGeneration(userId);
    } catch (generationError) {
      console.error("대본 생성 횟수 차감 실패:", generationError);
      return ApiResponse.errorWithCode(
        ErrorCode.SERVER_ERROR,
        "대본 생성 횟수 차감 중 오류가 발생했습니다",
        String(generationError)
      );
    }
    
    if (!generationResult.success) {
      return ApiResponse.errorWithCode(
        ErrorCode.INSUFFICIENT_TOKENS,
        generationResult.error || "대본 생성 횟수 차감에 실패했습니다"
      );
    }

    console.log(`✅ AI 대본 생성 완료: 1회 차감 (잔여: ${generationResult.remainingGenerations}/${generationResult.monthlyLimit}회)`);

    return ApiResponse.success({
      panels: scriptData.panels || [],
      tokensUsed: response.tokensUsed, // 참고용 (실제 차감은 횟수 기반)
      remainingGenerations: generationResult.remainingGenerations,
      userPlan: generationResult.userPlan,
      monthlyLimit: generationResult.monthlyLimit
    });

  } catch (error) {
    console.error("Script generation error:", error);
    
    // 예상치 못한 에러의 경우 적절한 사용자 메시지로 변환
    let userMessage = "대본 생성 중 예상치 못한 오류가 발생했습니다";
    let errorCode = ErrorCode.SERVER_ERROR;
    
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('deadline')) {
        errorCode = ErrorCode.GENERATION_TIMEOUT;
        userMessage = "AI 스크립트 생성이 시간을 초과했습니다. 더 간단한 스토리로 다시 시도해주세요.";
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        errorCode = ErrorCode.NETWORK_ERROR;
        userMessage = "네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.";
      }
    }
    
    return ApiResponse.errorWithCode(
      errorCode,
      userMessage,
      String(error)
    );
  }
}