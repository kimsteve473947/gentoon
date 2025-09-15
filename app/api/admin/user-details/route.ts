import { NextRequest, NextResponse } from 'next/server';
import { createClient } from "@/lib/supabase/server";
import { getSimpleTokenStats } from '@/lib/subscription/simple-token-usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 관리자 권한 확인
async function checkAdminAccess() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user || user.email !== 'kimjh473947@gmail.com') {
    return NextResponse.json(
      { success: false, error: "관리자 권한이 필요합니다" },
      { status: 403 }
    );
  }
  
  return null;
}

/**
 * 🎯 특정 사용자의 상세 정보 온디맨드 로딩
 * GET /api/admin/user-details?userId=xxx&stats=true&days=30
 */
export async function GET(request: NextRequest) {
  try {
    const adminCheck = await checkAdminAccess();
    if (adminCheck) return adminCheck;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const includeStats = searchParams.get('stats') === 'true';
    const days = parseInt(searchParams.get('days') || '30');
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId 파라미터가 필요합니다" },
        { status: 400 }
      );
    }
    
    console.log(`🔍 사용자 상세 정보 온디맨드 로딩: ${userId.substring(0, 8)}... (통계: ${includeStats})`);

    const supabase = await createClient();
    
    // 병렬로 사용자 정보 조회
    const [authUserResponse, internalUserResponse] = await Promise.all([
      // Auth 사용자 정보
      supabase.auth.admin.getUserById(userId).catch(() => ({ data: { user: null } })),
      // 내부 사용자 정보  
      supabase
        .from('user')
        .select('*')
        .eq('id', userId)
        .single()
        .then(res => res)
        .catch(() => ({ data: null }))
    ]);

    const authUser = authUserResponse.data?.user;
    const internalUser = internalUserResponse.data;

    if (!authUser && !internalUser) {
      return NextResponse.json(
        { success: false, error: "사용자를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 기본 사용자 정보 구성
    const basicUserInfo = {
      // Auth 정보
      authId: authUser?.id || userId,
      email: authUser?.email || internalUser?.email || 'Unknown',
      lastSignIn: authUser?.last_sign_in_at,
      createdAt: authUser?.created_at,
      emailConfirmed: authUser?.email_confirmed_at,
      provider: authUser?.app_metadata?.provider || 'unknown',
      
      // 내부 사용자 정보
      ...(internalUser && {
        id: internalUser.id,
        id: internalUser.id,
        name: internalUser.name,
        fullName: internalUser.name,
        avatarUrl: internalUser.avatarUrl || authUser?.user_metadata?.avatar_url,
        referralCode: internalUser.referralCode,
        referredBy: internalUser.referredBy,
        role: internalUser.role,
        internalCreatedAt: internalUser.createdAt,
        updatedAt: internalUser.updatedAt
      }),
      
      hasInternalRecord: !!internalUser
    };

    // 응답 구성
    let response: any = {
      success: true,
      user: basicUserInfo,
      timestamp: new Date().toISOString()
    };

    // 통계가 요청된 경우
    if (includeStats) {
      console.log(`📊 상세 통계 조회 중...`);
      
      if (internalUser) {
        // 내부 사용자가 있는 경우: 모든 상세 정보 조회
        const [subscription, tokenUsage, storageUsage, detailedUsage, simpleTokenStats] = await Promise.all([
          getUserSubscription(supabase, internalUser.id),
          getUserTokenUsage(supabase, internalUser.id),
          getUserStorageUsage(supabase, internalUser.id),
          getUserDetailedUsage(supabase, internalUser.id),
          getSimpleTokenStats(userId, days)
        ]);

        response.details = {
          subscription,
          tokenUsage,
          storageUsage,
          detailedUsage,
          simpleTokenStats
        };
      } else {
        // Auth에만 있는 사용자의 경우: 간단한 토큰 통계만 조회
        const simpleTokenStats = await getSimpleTokenStats(userId, days);
        response.details = {
          subscription: null,
          tokenUsage: null,
          storageUsage: null,
          detailedUsage: null,
          simpleTokenStats
        };
      }
    }

    console.log(`✅ 사용자 상세 정보 조회 완료: ${response.user.email}`);

    return NextResponse.json(response);

  } catch (error) {
    console.error("사용자 상세 정보 조회 오류:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "사용자 정보 조회 중 오류가 발생했습니다",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// 기존 함수들 재사용
async function getUserSubscription(supabase: any, userId: string) {
  try {
    const { data: subscription } = await supabase
      .from('subscription')
      .select('*')
      .eq('userId', userId)
      .single();

    return subscription;
  } catch (error) {
    console.warn(`구독 정보 조회 실패 (userId: ${userId}):`, error);
    return null;
  }
}

async function getUserTokenUsage(supabase: any, userId: string) {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [allUsages, monthlyUsages, dailyUsages] = await Promise.all([
      supabase
        .from('token_usage')
        .select('total_tokens, api_cost, created_at')
        .eq('userId', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('token_usage')
        .select('total_tokens')
        .eq('userId', userId)
        .gte('created_at', startOfMonth.toISOString()),
      supabase
        .from('token_usage')
        .select('total_tokens')
        .eq('userId', userId)
        .gte('created_at', startOfDay.toISOString())
    ]);

    const totalTokensUsed = (allUsages.data || []).reduce((sum, usage) => sum + (usage.total_tokens || 0), 0);
    const monthlyUsage = (monthlyUsages.data || []).reduce((sum, usage) => sum + (usage.total_tokens || 0), 0);
    const dailyUsage = (dailyUsages.data || []).reduce((sum, usage) => sum + (usage.total_tokens || 0), 0);

    const totalApiCost = (allUsages.data || []).reduce((sum, usage) => sum + (parseFloat(usage.api_cost || '0')), 0);
    const costPerToken = 52 / 1290;
    const estimatedCostKRW = totalApiCost > 0 ? totalApiCost : totalTokensUsed * costPerToken;

    return {
      totalTokensUsed,
      totalCostKRW: Math.round(estimatedCostKRW),
      monthlyUsage,
      dailyUsage
    };
  } catch (error) {
    console.warn(`토큰 사용량 조회 실패 (userId: ${userId}):`, error);
    return {
      totalTokensUsed: 0,
      totalCostKRW: 0,
      monthlyUsage: 0,
      dailyUsage: 0
    };
  }
}

async function getUserStorageUsage(supabase: any, userId: string) {
  try {
    const { data: userStorage } = await supabase
      .from('user_storage')
      .select('*')
      .eq('userId', userId)
      .single();

    if (userStorage) {
      const usagePercentage = Math.round((userStorage.used_bytes / userStorage.max_bytes) * 100);
      return {
        usedBytes: userStorage.used_bytes,
        maxBytes: userStorage.max_bytes,
        usagePercentage: Math.min(usagePercentage, 100)
      };
    }

    return {
      usedBytes: 0,
      maxBytes: 100 * 1024 * 1024,
      usagePercentage: 0
    };
  } catch (error) {
    console.warn(`저장소 사용량 조회 실패 (userId: ${userId}):`, error);
    return {
      usedBytes: 0,
      maxBytes: 100 * 1024 * 1024,
      usagePercentage: 0
    };
  }
}

async function getUserDetailedUsage(supabase: any, userId: string) {
  try {
    const [projectsResult, charactersResult, generationsResult] = await Promise.all([
      supabase
        .from('project')
        .select('id, thumbnailUrl')
        .eq('userId', userId)
        .is('deletedAt', null),
      supabase
        .from('character')
        .select('id, referenceImages, ratioImages, thumbnailUrl')
        .eq('userId', userId),
      supabase
        .from('generation')
        .select('id, imageUrl')
        .eq('userId', userId)
    ]);

    const projects = projectsResult.data || [];
    const characters = charactersResult.data || [];
    const generations = generationsResult.data || [];

    const projectImages = projects.filter(p => p.thumbnailUrl).length;
    const generationImages = generations.filter(g => g.imageUrl).length;
    
    const characterImages = characters.reduce((sum, c) => {
      const refs = Array.isArray(c.referenceImages) ? c.referenceImages.length : 0;
      const ratios = c.ratioImages && typeof c.ratioImages === 'object' 
        ? Object.values(c.ratioImages).reduce((ratioSum: number, images: any) => {
            return ratioSum + (Array.isArray(images) ? images.length : 0);
          }, 0)
        : 0;
      const thumbnails = c.thumbnailUrl ? 1 : 0;
      return sum + refs + ratios + thumbnails;
    }, 0);

    const totalImages = projectImages + generationImages + characterImages;

    return {
      projects: projects.length,
      characters: characters.length,
      generations: generations.length,
      totalImages,
      breakdown: {
        projectImages,
        generationImages,
        characterImages
      }
    };
  } catch (error) {
    console.warn(`상세 사용량 조회 실패 (userId: ${userId}):`, error);
    return {
      projects: 0,
      characters: 0,
      generations: 0,
      totalImages: 0,
      breakdown: {
        projectImages: 0,
        generationImages: 0,
        characterImages: 0
      }
    };
  }
}