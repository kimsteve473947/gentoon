import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NanoBananaServiceFactory } from "@/lib/ai/nano-banana-service";
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

    const { storyPrompt, characterNames, selectedCharacterIds, elementNames, selectedElementIds, panelCount, style } = requestBody;
    
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

    // 🎯 실제 데이터베이스에서 캐릭터 정보 가져오기
    let characterInfo = '';
    let selectedCharacterDetails = [];
    if (selectedCharacterIds && selectedCharacterIds.length > 0) {
      try {
        const { data: characters } = await supabase
          .from('character')
          .select('id, name, description')
          .in('id', selectedCharacterIds)
          .eq('userId', userId);
        
        if (characters && characters.length > 0) {
          selectedCharacterDetails = characters;
          const characterDescriptions = characters.map(char => 
            `${char.name}(${char.description || '캐릭터'})`
          );
          characterInfo = `등장 캐릭터: ${characterDescriptions.join(', ')}`;
          console.log('🎭 실제 DB 캐릭터 정보:', characterDescriptions);
        }
      } catch (error) {
        console.warn('캐릭터 정보 로드 실패:', error);
        characterInfo = characterNames && characterNames.length > 0 
          ? `등장 캐릭터: ${characterNames.join(', ')}`
          : '';
      }
    } else if (characterNames && characterNames.length > 0) {
      characterInfo = `등장 캐릭터: ${characterNames.join(', ')}`;
    }

    // 🎯 실제 데이터베이스에서 요소 정보 가져오기  
    let elementInfo = '';
    let selectedElementDetails = [];
    if (selectedElementIds && selectedElementIds.length > 0) {
      try {
        const { data: elements } = await supabase
          .from('element')
          .select('id, name, description')
          .in('id', selectedElementIds)
          .eq('userId', userId);
        
        if (elements && elements.length > 0) {
          selectedElementDetails = elements;
          const elementDescriptions = elements.map(elem => 
            `${elem.name}(${elem.description || '요소'})`
          );
          elementInfo = `등장 요소: ${elementDescriptions.join(', ')}`;
          console.log('🎯 실제 DB 요소 정보:', elementDescriptions);
        }
      } catch (error) {
        console.warn('요소 정보 로드 실패:', error);
        elementInfo = elementNames && elementNames.length > 0
          ? `등장 요소: ${elementNames.join(', ')}`
          : '';
      }
    } else if (elementNames && elementNames.length > 0) {
      elementInfo = `등장 요소: ${elementNames.join(', ')}`;
    }

    // 🎨 nanobananaMCP 멀티모달 최적화 기반 한국어 웹툰 프롬프트 생성
    const scriptPrompt = `
웹툰 스토리를 ${panelCount}개 컷의 AI 이미지 생성 프롬프트로 변환하세요.

스토리: ${storyPrompt}
${characterInfo}
${elementInfo}

**🚨 필수 제약사항:**
- **반드시 위에 명시된 캐릭터와 요소만 사용하세요**
- **새로운 캐릭터나 요소를 임의로 추가하지 마세요**
- **각 패널의 characters 배열에는 위 캐릭터 이름만 포함**
- **각 패널의 elements 배열에는 위 요소 이름만 포함**
- **각 패널당 최대 3명의 캐릭터만 등장** (AI 멀티모달 제한)
- 첫 번째 패널은 새로 생성, 이후 패널은 이전 이미지 편집 방식
- 연속성을 위해 캐릭터 등장 패턴을 전략적으로 배치

**캐릭터 배치 전략:**
1. **집중형**: 주요 장면에서는 1-2명 집중 (감정 표현 극대화)
2. **전환형**: 캐릭터 교체 시 겹치는 패널 최소화
3. **그룹형**: 3명 등장 시 명확한 역할 분담 (주인공, 조연, 배경인물)

**스토리텔링 최적화:**
- 각 패널의 캐릭터 조합을 의도적으로 설계
- 불필요한 캐릭터 등장 지양
- 시각적 임팩트와 스토리 진행의 균형

**기본 규칙:**
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
      "characters": ["위에 명시된 캐릭터 이름만 사용"],
      "elements": ["위에 명시된 요소 이름만 사용"]
    },
    {
      "order": 2,
      "prompt": "미디엄샷으로 보이는 캐릭터들이 테이블에 마주 앉아 대화하는 모습, 따뜻한 분위기, 창문으로 들어오는 자연광",
      "characters": ["위에 명시된 캐릭터 이름만 사용"],
      "elements": ["위에 명시된 요소 이름만 사용"]
    }
  ]
}

🚨 **중요**: characters와 elements 배열에는 반드시 위에서 제공된 정확한 이름만 사용하세요. 
${selectedCharacterDetails.length > 0 ? `사용 가능한 캐릭터: ${selectedCharacterDetails.map(c => c.name).join(', ')}` : ''}
${selectedElementDetails.length > 0 ? `사용 가능한 요소: ${selectedElementDetails.map(e => e.name).join(', ')}` : ''}

⚠️ 반드시 각 패널의 characters 배열에 3명 이하의 캐릭터만 포함하세요.
한국어로만 응답하세요:`;

    console.log('🤖 Sending prompt to Google AI Studio:', scriptPrompt.substring(0, 200) + '...');

    // 🔐 사용자별 격리된 Google AI Studio (Gemini)로 대본 생성 - 텍스트 생성 모드
    let response;
    try {
      // 세션 ID 생성 (사용자별 고유 텍스트 생성 세션)
      const sessionId = `script-${userId}-${Date.now()}`;
      
      // 사용자별 격리된 서비스 획득
      const userService = NanoBananaServiceFactory.getUserInstance(userId, sessionId);
      console.log(`🔐 스크립트 생성용 격리된 서비스 사용: ${userId}-${sessionId}`);
      
      response = await userService.generateText(scriptPrompt, {
        userId: userId,
        sessionId: sessionId,
        projectId: 'script-generation'
      });
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

    console.log('🔍 Raw Google AI Studio response:', response.text);
    console.log('📊 Token usage from Google AI Studio:', response.tokensUsed);

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
      
      // 🎯 각 패널 프롬프트 길이 검증 및 멀티모달 최적화
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
        
        // 🎭 멀티모달 제약: 각 패널당 최대 3명 캐릭터 강제 적용
        let panelCharacters = panel.characters || characterNames || [];
        if (panelCharacters.length > 3) {
          console.warn(`⚠️ Panel ${index + 1} has ${panelCharacters.length} characters, limiting to 3 for multimodal constraints`);
          panelCharacters = panelCharacters.slice(0, 3);
        }
        
        console.log(`📏 Panel ${index + 1}: ${prompt.length} chars, ${panelCharacters.length} characters`);
        
        // 🎭 캐릭터 ID 기반 매핑: AI가 생성한 캐릭터 대신 실제 선택된 캐릭터 ID 사용
        let mappedCharacterIds = [];
        if (selectedCharacterIds && selectedCharacterIds.length > 0) {
          // 패널별로 선택된 캐릭터들을 순환 배치 (최대 3개)
          const maxCharacters = Math.min(3, selectedCharacterIds.length);
          const startIndex = (index * 2) % selectedCharacterIds.length;
          
          for (let j = 0; j < maxCharacters; j++) {
            const charIndex = (startIndex + j) % selectedCharacterIds.length;
            mappedCharacterIds.push(selectedCharacterIds[charIndex]);
          }
          
          console.log(`🎭 패널 ${index + 1} 캐릭터 매핑: ${mappedCharacterIds.length}개`);
        }

        // 🎯 요소 ID 기반 매핑: AI가 생성한 요소 대신 실제 선택된 요소 ID 사용  
        let mappedElementIds = [];
        if (selectedElementIds && selectedElementIds.length > 0) {
          // 요소도 적절히 분산 배치 (최대 2개)
          const maxElements = Math.min(2, selectedElementIds.length);
          const startIndex = index % selectedElementIds.length;
          
          for (let j = 0; j < maxElements; j++) {
            const elementIndex = (startIndex + j) % selectedElementIds.length;
            mappedElementIds.push(selectedElementIds[elementIndex]);
          }
          
          console.log(`🎯 패널 ${index + 1} 요소 매핑: ${mappedElementIds.length}개`);
        }

        return {
          ...panel,
          prompt,
          characterIds: mappedCharacterIds, // 🚀 실제 DB 캐릭터 ID들
          elementIds: mappedElementIds, // 🚀 실제 DB 요소 ID들
          characters: panelCharacters, // AI 생성 이름들 (참고용)
          elements: panel.elements || elementNames || [], // AI 생성 이름들 (참고용)
          shot_type: panel.shot_type || 'medium shot',
          mood: panel.mood || 'neutral'
        };
      });
      
    } catch (parseError) {
      console.error('❌ JSON 파싱 실패:', parseError);
      console.error('❌ 원본 응답:', response.text);
      
      // 🚨 폴백: nanobananaMCP 멀티모달 최적화 방식으로 대본 생성
      const fallbackPanels = Array.from({ length: panelCount }, (_, i) => {
        const shotTypes = ['close-up shot', 'medium shot', 'wide shot'];
        const moods = ['cheerful', 'dramatic', 'serene', 'tense', 'nostalgic'];
        const lighting = ['soft natural light', 'warm golden hour', 'bright daylight', 'gentle morning light'];
        
        const shotType = shotTypes[i % shotTypes.length];
        const mood = moods[i % moods.length];
        const light = lighting[i % lighting.length];
        
        // 🎭 실제 선택된 캐릭터 ID 기반 매핑
        let mappedCharacterIds = [];
        if (selectedCharacterIds && selectedCharacterIds.length > 0) {
          const maxCharacters = Math.min(3, selectedCharacterIds.length);
          const startIndex = (i * 2) % selectedCharacterIds.length;
          
          for (let j = 0; j < maxCharacters; j++) {
            const charIndex = (startIndex + j) % selectedCharacterIds.length;
            mappedCharacterIds.push(selectedCharacterIds[charIndex]);
          }
        }

        // 🎯 실제 선택된 요소 ID 기반 매핑
        let mappedElementIds = [];
        if (selectedElementIds && selectedElementIds.length > 0) {
          const maxElements = Math.min(2, selectedElementIds.length);
          const startIndex = i % selectedElementIds.length;
          
          for (let j = 0; j < maxElements; j++) {
            const elementIndex = (startIndex + j) % selectedElementIds.length;
            mappedElementIds.push(selectedElementIds[elementIndex]);
          }
        }
        
        // 100-200자 최적화된 프롬프트 생성
        const optimizedPrompt = `${shotType} of characters in ${storyPrompt} scene, ${mood} atmosphere, ${light}, Korean webtoon style, detailed expressions, vibrant colors, professional digital art quality`;
        
        return {
          order: i + 1,
          prompt: optimizedPrompt.length > 200 ? optimizedPrompt.substring(0, 197) + '...' : optimizedPrompt,
          characterIds: mappedCharacterIds, // 🚀 실제 DB 캐릭터 ID들
          elementIds: mappedElementIds, // 🚀 실제 DB 요소 ID들
          characters: characterNames || [], // AI 생성 이름들 (참고용)
          elements: (elementNames || []).slice(0, 2), // AI 생성 이름들 (참고용)
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