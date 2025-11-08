import { NextRequest, NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest, ApiResponse } from "@/lib/auth/api-middleware";
import { nanoBananaService } from "@/lib/ai/nano-banana-service";
import { tokenManager } from "@/lib/subscription/token-manager";
import { checkAndResetTokensIfNeeded, getUserTokenInfo } from "@/lib/subscription/token-reset";
import { canUploadFile } from "@/lib/storage/storage-manager";
import { characterReferenceManager } from "@/lib/ai/character-reference-manager";
import { generationQueue } from "@/lib/ai/generation-queue";
import { logImageGeneration } from "@/lib/logging/activity-logger";
import { createClient } from "@/lib/supabase/server";
import { usageTriggers } from "@/lib/usage/cache-manager";
import { trackStorageUsage } from "@/lib/storage/tracker";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2분 타임아웃 - 성능 최적화

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const userId = request.user.id;
    console.log(`👤 인증된 사용자: ${userId}`);

    // ✨ JSON 처리 (저장된 이미지 URL 방식)
    const body = await request.json();
    const { prompt, characterIds, elementImageUrls, projectId, panelId, settings, aspectRatio, referenceImage, editMode } = body;
    
    console.log('📥 Received request with projectId:', projectId, 'panelId:', panelId);
    console.log('📎 요소 이미지 URL들:', elementImageUrls?.length || 0, '개');

    if (!prompt) {
      return ApiResponse.badRequest("프롬프트가 필요합니다");
    }

    // 🚨 토큰 초기화 체크 및 잔액 확인 (개발/프로덕션 모드 모두 적용)
    await checkAndResetTokensIfNeeded(userId);
    const balanceInfo = await tokenManager.getBalance(userId);
    
    // 이미지 생성 옵션 설정
    const imageCount = settings?.batchCount || 1; // 배치 생성 개수
    const highResolution = settings?.highResolution || false;
    const saveCharacter = settings?.saveCharacter || false;
    
    // 🚨 토큰 부족 체크 (필수)
    if (balanceInfo.estimatedImagesRemaining < imageCount) {
      console.log(`❌ 토큰 부족: 필요 ${imageCount}개, 잔여 ${balanceInfo.estimatedImagesRemaining}개`);
      return ApiResponse.paymentRequired(`토큰이 부족합니다. 필요: ${imageCount}장, 잔여: ${balanceInfo.estimatedImagesRemaining}장 (${balanceInfo.balance.toLocaleString()}/${balanceInfo.total.toLocaleString()} 토큰)`);
    }
    
    console.log(`✅ 토큰 잔액 확인: ${balanceInfo.estimatedImagesRemaining}장 생성 가능 (${balanceInfo.balance.toLocaleString()}/${balanceInfo.total.toLocaleString()} 토큰)`);

    // 예상 파일 크기 체크 (이미지당 약 500KB로 추정)
    const estimatedFileSize = imageCount * 500 * 1024; // 500KB per image
    
    // 저장 용량 체크 (userData는 미들웨어에서 이미 확인됨)
    const storageCheck = await canUploadFile(request.userData.id, estimatedFileSize);
    
    if (!storageCheck.canUpload) {
      return ApiResponse.insufficientStorage("저장 공간이 부족합니다. 파일을 삭제하거나 멤버십을 업그레이드하세요.");
    }

    // 비율 설정
    const ratio = aspectRatio || settings?.aspectRatio || '4:5';
    const width = ratio === '16:9' ? 1920 : ratio === '1:1' ? 1024 : 896;
    const height = ratio === '16:9' ? 1080 : ratio === '1:1' ? 1024 : 1152;
    console.log(`🔧 이미지 생성: ${ratio} 비율 (${width}x${height})`);

    let enhancedPrompt = prompt;
    let referenceImages: string[] = [];
    let characterDescriptions = "";

    // 🎭 캐릭터 레퍼런스 처리 (editMode에서도 필요)
    if (characterIds && characterIds.length > 0) {
      console.log('🎭 캐릭터 레퍼런스 처리 - 캐릭터 ID들:', characterIds);
      
      try {
        // 선택된 캐릭터들로 프롬프트 향상 (프로젝트 비율 전달)
        const promptEnhancement = await characterReferenceManager.enhancePromptWithSelectedCharacters(
          userId,
          prompt,
          characterIds,
          ratio as '4:5' | '1:1' | '16:9' // 프로젝트 비율 전달
        );

        enhancedPrompt = promptEnhancement.enhancedPrompt;
        referenceImages = promptEnhancement.referenceImages;
        characterDescriptions = promptEnhancement.characterDescriptions;
        
        console.log(`🎭 캐릭터 레퍼런스 적용: ${promptEnhancement.detectedCharacters.length}개 캐릭터`);
        console.log(`📚 레퍼런스 이미지: ${referenceImages.length}개`);
      } catch (error) {
        console.warn('캐릭터 레퍼런스 처리 실패:', error);
        // 캐릭터 처리가 실패해도 기본 프롬프트로 계속 진행
      }
    }

    // 🔄 편집 모드 프롬프트 설정
    if (editMode && referenceImage) {
      console.log('✏️ 편집 모드: 이전 이미지를 참조하여 다음 패널 생성');
      enhancedPrompt = `[IMAGE EDIT MODE] Based on the provided reference image, make the following changes: ${prompt}`;
    }

    let result;
    
    if (editMode && referenceImage) {
      // 🚀 나노바나나MCP 편집 모드: editImageNanoBananaMCP 직접 호출
      console.log(`🔄 나노바나나MCP 편집 모드: panelId=${panelId}, userId=${userId}`);
      console.log(`📸 이전 이미지: ${referenceImage.substring(0, 50)}...`);
      
      // nanoBananaService에서 직접 editImageNanoBananaMCP 호출
      const { nanoBananaService } = await import('@/lib/ai/nano-banana-service');
      
      // 캐릭터 레퍼런스 준비 (편집 모드에서도 캐릭터 일관성 유지)
      const characterReferences = referenceImages.map(url => ({ imageUrl: url }));
      
      result = await nanoBananaService.editImageNanoBananaMCP(
        referenceImage,
        enhancedPrompt, // 향상된 프롬프트 사용 (요소 정보 포함)
        characterReferences,
        ratio as '4:5' | '1:1',
        {
          userId: userId,
          panelId: parseInt(panelId) || undefined,
          sessionId: `batch-edit-${Date.now()}`,
          elementImageUrls: elementImageUrls // 요소 이미지 URL들 전달
        }
      );
      
      console.log(`✅ 나노바나나MCP 편집 완료: tokensUsed=${result.tokensUsed}`);
    } else {
      // 🆕 일반 생성 모드: 기존 큐 시스템 사용
      console.log(`🎯 큐에 생성 요청 추가: panelId=${panelId}, userId=${userId}`);
      
      result = await generationQueue.enqueue(
        userId,
        enhancedPrompt,
        {
          selectedCharacterIds: characterIds,
          referenceImages: referenceImages,
          elementImageUrls: elementImageUrls, // ✨ 저장된 요소 이미지 URL들
          characterDescriptions: new Map(characterIds?.map((id: string) => [id, characterDescriptions]) || []),
          aspectRatio: ratio,
          width: width,
          height: height
        },
        panelId, // 패널별 중복 방지용
        panelId ? 5 : 0 // 패널 업데이트는 높은 우선순위
      );
    }

    // Google Gemini API 실제 토큰 사용량을 기반으로 사용자 토큰 차감
    console.log(`🔢 실제 Gemini API 토큰 사용량: ${result.tokensUsed}`);
    
    const tokenResult = await tokenManager.useActualTokensFromGemini(
      userId, 
      result.tokensUsed, // 실제 Gemini API에서 사용된 토큰 수
      { 
        imageCount,
        highResolution, 
        saveCharacter,
        description: `이미지 생성: ${imageCount}장 (실제 토큰: ${result.tokensUsed})`
      }
    );
    
    if (!tokenResult.success) {
      return ApiResponse.error(tokenResult.error || "토큰 차감 실패");
    }

    // 🚀 데이터베이스에 생성 기록 저장
    const supabase = await createClient();
    const generation = {
      userId: userId,
      imageUrl: result.imageUrl,
      thumbnailUrl: result.thumbnailUrl,
      // tokensUsed: result.tokensUsed, // 임시 제거 - Supabase 스키마에 없음
      prompt: prompt,
      projectId: projectId
      // panelId 제거 - UUID 타입 오류 방지 (숫자 0,1,2,3 대신 UUID 필요)
      // aspectRatio 제거 - Prisma 스키마에 없음
      // createdAt 제거 - 자동 설정됨
    };

    const { data: savedGeneration, error: insertError } = await supabase
      .from('generation')
      .insert(generation)
      .select()
      .single();

    if (insertError) {
      console.error('생성 기록 저장 실패:', insertError);
      // 저장 실패해도 이미지 생성은 성공했으므로 계속 진행
    } else {
      console.log('💾 생성 기록 저장 완료:', savedGeneration.id);
      
      // 🔗 패널 이미지 URL 업데이트 (panelId는 order 번호이므로 order로 업데이트)
      if (panelId !== undefined && projectId && savedGeneration?.id) {
        const { error: updateError } = await supabase
          .from('panel')
          .update({
            imageUrl: result.imageUrl
          })
          .eq('projectId', projectId)
          .eq('"order"', parseInt(panelId));
        
        if (updateError) {
          console.error('❌ 패널 업데이트 실패:', updateError);
        } else {
          console.log('✅ 패널 이미지 업데이트 완료:', panelId);
        }
      }
    }

    // 🚀 사용량 캐시 업데이트 - 이미지 생성
    await usageTriggers.onImageGenerated(userId, result.tokensUsed);

    // 📊 스토리지 사용량 업데이트 - 생성된 이미지 추가
    try {
      // 생성된 이미지의 실제 파일 크기로 스토리지 업데이트 (약 500KB로 추정했던 크기 사용)
      const actualFileSize = estimatedFileSize; // 실제로는 생성된 파일의 정확한 크기를 알 수 있다면 더 좋음
      const storageResult = await trackStorageUsage(userId, actualFileSize, 'add');
      
      if (storageResult.success) {
        console.log(`📊 스토리지 업데이트 완료: +${actualFileSize} bytes (총 ${storageResult.currentUsage} bytes)`);
      } else {
        console.error('스토리지 업데이트 실패:', storageResult.error);
      }
    } catch (storageError) {
      console.error('스토리지 추적 오류:', storageError);
      // 스토리지 추적 실패해도 이미지 생성은 성공했으므로 계속 진행
    }

    // 🚀 활동 로깅 - 이미지 생성 성공
    await logImageGeneration(userId, result.tokensUsed, imageCount, 'completed');

    // 성공 응답 데이터
    const responseData = {
      imageUrl: result.imageUrl,
      thumbnailUrl: result.thumbnailUrl,
      tokensUsed: result.tokensUsed,
      generationId: savedGeneration?.id || `gen-${Date.now()}`,
      remainingTokens: tokenResult.remainingTokens,
      dailyRemaining: tokenResult.dailyRemaining
    };
    
    console.log('📤 응답 전송:', responseData.imageUrl);
    return ApiResponse.success(responseData);

  } catch (error) {
    console.error("🚨 Generation API error:", error);
    console.error("🚨 Error type:", error?.constructor?.name);
    console.error("🚨 Error message:", error instanceof Error ? error.message : "Unknown error");
    console.error("🚨 Error stack:", error instanceof Error ? error.stack : "No stack");
    console.error("🚨 Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));

    // 🚀 활동 로깅 - 이미지 생성 실패
    try {
      const userId = request.user.id; // userId를 다시 가져와서 사용
      const failedImageCount = 1; // 실패한 경우 기본값
      await logImageGeneration(userId, 0, failedImageCount, 'failed');
    } catch (logError) {
      console.error("Activity logging failed:", logError);
    }

    // 사용자 친화적 에러 메시지 처리
    const errorMessage = error instanceof Error ? error.message : "이미지 생성 중 오류가 발생했습니다";
    
    if (errorMessage === 'CONTENT_POLICY_VIOLATION') {
      return ApiResponse.error("이용정책에 맞지 않은 이미지 생성 요청입니다! 건전한 콘텐츠로 다시 시도해 주세요.", 400);
    }
    
    if (errorMessage === 'COPYRIGHT_VIOLATION') {
      return ApiResponse.error("저작권 침해 우려로 이미지를 생성할 수 없습니다. 다른 내용으로 시도해 주세요.", 400);
    }
    
    if (errorMessage.includes('PROHIBITED_CONTENT') || errorMessage.includes('SAFETY')) {
      return ApiResponse.error("이용정책에 맞지 않은 이미지 생성 요청입니다! 건전한 콘텐츠로 다시 시도해 주세요.", 400);
    }
    
    return ApiResponse.error(errorMessage, 500, String(error));
  }
});

// 토큰 사용량 조회 API
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  
  // 사용량 통계 조회
  if (path === "usage") {
    try {
      const userId = request.user.id;
      
      // 상세 잔액 정보
      const balanceInfo = await tokenManager.getBalance(userId);
      
      // 토큰 부족 체크
      const lowBalanceCheck = await tokenManager.checkLowBalance(userId);
      
      // 월간 수익성 분석
      const profitAnalysis = await tokenManager.getMonthlyProfitAnalysis(userId);
      
      // 사용 내역
      const usageHistory = await tokenManager.getUsageHistory(userId, 20);
      
      return ApiResponse.success({
        balance: balanceInfo,
        lowBalance: lowBalanceCheck,
        profitAnalysis,
        history: usageHistory,
      });
      
    } catch (error) {
      console.error("Get usage error:", error);
      return ApiResponse.error("사용량 조회 중 오류가 발생했습니다");
    }
  }
  
  // 기존 생성 기록 조회
  return getGenerationHistory(request);
});

// 생성 기록 조회
async function getGenerationHistory(request: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const limit = parseInt(searchParams.get("limit") || "10");

    const supabase = await createClient();

    // 생성 기록 조회 쿼리 구성
    let query = supabase
      .from('generation')
      .select(`
        *,
        character (*),
        project (*)
      `)
      .eq('userId', request.userData.id)
      .order('createdAt', { ascending: false })
      .limit(limit);

    if (projectId) {
      query = query.eq('projectId', projectId);
    }

    const { data: generations } = await query;

    return ApiResponse.success({ generations });

  } catch (error) {
    console.error("Get generations error:", error);
    return ApiResponse.error("생성 기록 조회 중 오류가 발생했습니다");
  }
}