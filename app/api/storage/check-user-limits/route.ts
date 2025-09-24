import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlanConfig } from "@/lib/subscription/plan-config";
import { prisma } from "@/lib/db/prisma";

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

    // 사용자 정보 조회
    const { data: userData } = await supabase
      .from('user')
      .select('id, email')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json(
        { success: false, error: "사용자 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 🚨 실시간 사용량 계산
    const [
      generationsResult,
      charactersResult,
      projectsResult,
      panelsResult
    ] = await Promise.all([
      supabase
        .from('generation')
        .select('id, tokensUsed')
        .eq('userId', userData.id),
      
      supabase
        .from('character')
        .select('id, referenceImages, ratioImages')
        .eq('userId', userData.id),
      
      supabase
        .from('project')
        .select('id')
        .eq('userId', userData.id)
        .is('deletedAt', null),
      
      supabase
        .from('panel')
        .select('id')
        .in('projectId', 
          (await supabase
            .from('project')
            .select('id')
            .eq('userId', userData.id)
            .is('deletedAt', null)
          ).data?.map(p => p.id) || []
        )
    ]);

    const generations = generationsResult.data || [];
    const characters = charactersResult.data || [];
    const projects = projectsResult.data || [];
    const panels = panelsResult.data || [];

    // 📊 현재 사용량 계산
    const currentUsage = {
      totalGenerations: generations.length,
      totalCharacters: characters.length,
      totalProjects: projects.length,
      totalPanels: panels.length,
      totalTokensUsed: generations.reduce((sum, g) => sum + (g.tokensUsed || 0), 0),
    };

    // 구독 정보 조회하여 제한 설정
    const subscription = await prisma.subscription.findUnique({
      where: { userId: userData.id }
    });
    
    const planType = subscription?.plan || 'FREE';
    const planConfig = getPlanConfig(planType);
    
    // ⚠️ 플랜별 제한 사항 정의
    const limits = {
      maxGenerations: 10000,  // 생성 이미지 최대 개수 (플랜 무관)
      maxCharacters: planConfig.maxCharacters,     // 캐릭터 제한 (플랜별)
      maxElements: planConfig.maxElements,         // 요소 제한 (플랜별)
      maxPanels: 50000,       // 패널 최대 개수 (플랜 무관)
      maxTokens: planConfig.platformTokens,       // 토큰 제한 (플랜별)
    };

    // 🔍 제한 사항 검증
    const violations = [];
    const warnings = [];

    if (currentUsage.totalGenerations > limits.maxGenerations) {
      violations.push({
        type: 'generations',
        current: currentUsage.totalGenerations,
        limit: limits.maxGenerations,
        severity: 'critical'
      });
    } else if (currentUsage.totalGenerations > limits.maxGenerations * 0.8) {
      warnings.push({
        type: 'generations',
        current: currentUsage.totalGenerations,
        limit: limits.maxGenerations,
        percentage: Math.round((currentUsage.totalGenerations / limits.maxGenerations) * 100)
      });
    }

    if (currentUsage.totalCharacters > limits.maxCharacters) {
      violations.push({
        type: 'characters',
        current: currentUsage.totalCharacters,
        limit: limits.maxCharacters,
        severity: 'critical'
      });
    } else if (currentUsage.totalCharacters > limits.maxCharacters * 0.8) {
      warnings.push({
        type: 'characters',
        current: currentUsage.totalCharacters,
        limit: limits.maxCharacters,
        percentage: Math.round((currentUsage.totalCharacters / limits.maxCharacters) * 100)
      });
    }

    // 프로젝트 제한 제거됨 (무제한)

    if (currentUsage.totalPanels > limits.maxPanels) {
      violations.push({
        type: 'panels',
        current: currentUsage.totalPanels,
        limit: limits.maxPanels,
        severity: 'critical'
      });
    }

    if (currentUsage.totalTokensUsed > limits.maxTokens) {
      violations.push({
        type: 'tokens',
        current: currentUsage.totalTokensUsed,
        limit: limits.maxTokens,
        severity: 'critical'
      });
    }

    // 🚫 비정상 사용량 판단
    const isAbnormalUser = violations.length > 0;
    const hasWarnings = warnings.length > 0;

    // 📈 사용량 레벨 계산
    const usageLevel = 
      violations.length > 0 ? 'critical' :
      warnings.length > 0 ? 'warning' :
      currentUsage.totalGenerations > 1000 ? 'high' :
      currentUsage.totalGenerations > 100 ? 'medium' : 'normal';

    // 🎯 권장 조치사항
    const recommendations = [];
    
    if (isAbnormalUser) {
      recommendations.push("즉시 사용량을 줄이시거나 상위 플랜으로 업그레이드하세요.");
      recommendations.push("불필요한 캐릭터나 요소를 삭제하세요.");
    } else if (hasWarnings) {
      recommendations.push("사용량이 제한에 가까워지고 있습니다. 계획적으로 사용하세요.");
      recommendations.push("상위 플랜 업그레이드를 고려해보세요.");
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userData.id,
        email: userData.email
      },
      currentUsage,
      limits,
      status: {
        isAbnormalUser,
        hasWarnings,
        usageLevel,
        canContinue: !isAbnormalUser
      },
      violations,
      warnings,
      recommendations,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("User limits check error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "사용자 제한 확인 중 오류가 발생했습니다",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}