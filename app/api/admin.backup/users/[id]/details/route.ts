import { NextRequest, NextResponse } from 'next/server';
import { createClient } from "@/lib/supabase/server";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 관리자 권한 확인 함수
async function checkAdminAccess(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user || user.email !== 'kimjh473947@gmail.com') {
    return NextResponse.json(
      { success: false, error: "관리자 권한이 필요합니다" },
      { status: 403 }
    );
  }
  
  return null; // 권한 OK
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 관리자 권한 확인
    const adminCheck = await checkAdminAccess(request);
    if (adminCheck) return adminCheck;

    const { id } = await params;
    const userId = id;
    console.log(`📋 관리자 - 사용자 상세 정보 조회: ${userId}`);

    const supabase = await createClient();
    
    // 사용자 기본 정보 조회
    const { data: user, error: userError } = await supabase
      .from('user')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "사용자를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 상세 정보를 병렬로 조회
    const [subscription, tokenUsage, storageUsage, detailedUsage] = await Promise.all([
      getUserSubscription(supabase, userId),
      getUserTokenUsage(supabase, userId),
      getUserStorageUsage(supabase, userId),
      getUserDetailedUsage(supabase, userId)
    ]);

    const enrichedUser = {
      ...user,
      subscription,
      tokenUsage,
      storageUsage,
      detailedUsage
    };

    console.log(`✅ 관리자 - 사용자 상세 정보 조회 완료: ${user.email}`);

    return NextResponse.json({
      success: true,
      user: enrichedUser,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Admin user details API error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "사용자 상세 정보 조회 중 오류가 발생했습니다",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// 사용자 구독 정보 조회 함수
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

// 사용자 토큰 사용량 조회 함수
async function getUserTokenUsage(supabase: any, userId: string) {
  try {
    // 이번 달 시작
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // 오늘 시작
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // token_usage 테이블에서 전체 토큰 사용량 조회
    const { data: allUsages } = await supabase
      .from('token_usage')
      .select('total_tokens, api_cost, created_at')
      .eq('userId', userId)
      .order('created_at', { ascending: false });

    // 월간 토큰 사용량
    const { data: monthlyUsages } = await supabase
      .from('token_usage')
      .select('total_tokens')
      .eq('userId', userId)
      .gte('created_at', startOfMonth.toISOString());

    // 일일 토큰 사용량
    const { data: dailyUsages } = await supabase
      .from('token_usage')
      .select('total_tokens')
      .eq('userId', userId)
      .gte('created_at', startOfDay.toISOString());

    const totalTokensUsed = (allUsages || []).reduce((sum, usage) => sum + (usage.total_tokens || 0), 0);
    const monthlyUsage = (monthlyUsages || []).reduce((sum, usage) => sum + (usage.total_tokens || 0), 0);
    const dailyUsage = (dailyUsages || []).reduce((sum, usage) => sum + (usage.total_tokens || 0), 0);

    // API 비용 합계 (실제 Gemini API 비용)
    const totalApiCost = (allUsages || []).reduce((sum, usage) => sum + (parseFloat(usage.api_cost || '0')), 0);
    
    // 토큰당 비용 계산 (52원 per 1290 tokens) - 백업용
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

// 사용자 저장소 사용량 조회 함수
async function getUserStorageUsage(supabase: any, userId: string) {
  try {
    // user_storage 테이블에서 실제 저장소 사용량 조회
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

    // user_storage가 없으면 추정치 계산
    const { data: subscription } = await supabase
      .from('subscription')
      .select('plan')
      .eq('userId', userId)
      .single();

    // 플랜별 저장소 한도
    const storageLimits: { [key: string]: number } = {
      'FREE': 100 * 1024 * 1024,      // 100MB
      'PRO': 1 * 1024 * 1024 * 1024,  // 1GB  
      'PREMIUM': 5 * 1024 * 1024 * 1024, // 5GB
      'ADMIN': 100 * 1024 * 1024 * 1024  // 100GB
    };

    const plan = subscription?.plan || 'FREE';
    const maxBytes = storageLimits[plan] || storageLimits['FREE'];

    // file_metadata 테이블에서 실제 파일 크기 합계 조회
    const { data: fileMetadata } = await supabase
      .from('file_metadata')
      .select('file_size')
      .eq('userId', userId)
      .is('deleted_at', null); // 삭제되지 않은 파일만

    const usedBytes = (fileMetadata || []).reduce((sum, file) => sum + (file.file_size || 0), 0);
    const usagePercentage = Math.round((usedBytes / maxBytes) * 100);

    return {
      usedBytes,
      maxBytes,
      usagePercentage: Math.min(usagePercentage, 100)
    };
  } catch (error) {
    console.warn(`저장소 사용량 조회 실패 (userId: ${userId}):`, error);
    return {
      usedBytes: 0,
      maxBytes: 100 * 1024 * 1024, // 기본 100MB
      usagePercentage: 0
    };
  }
}

// 사용자별 상세 사용량 조회 함수
async function getUserDetailedUsage(supabase: any, userId: string) {
  try {
    // 병렬로 모든 데이터 조회
    const [projectsResult, charactersResult, generationsResult] = await Promise.all([
      // 프로젝트 수 조회
      supabase
        .from('project')
        .select('id, thumbnailUrl')
        .eq('userId', userId)
        .is('deletedAt', null),
      
      // 캐릭터 수 조회  
      supabase
        .from('character')
        .select('id, referenceImages, ratioImages, thumbnailUrl')
        .eq('userId', userId),
        
      // 생성 이미지 수 조회
      supabase
        .from('generation')
        .select('id, imageUrl')
        .eq('userId', userId)
    ]);

    const projects = projectsResult.data || [];
    const characters = charactersResult.data || [];
    const generations = generationsResult.data || [];

    // 이미지 개수 계산
    const projectImages = projects.filter(p => p.thumbnailUrl).length;
    const generationImages = generations.filter(g => g.imageUrl).length;
    
    // 캐릭터 이미지 개수 계산 (참조 이미지 + 비율 이미지 + 썸네일)
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