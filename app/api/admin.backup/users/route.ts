import { NextRequest, NextResponse } from 'next/server';
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from '@supabase/supabase-js';

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

export async function GET(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const adminCheck = await checkAdminAccess(request);
    if (adminCheck) return adminCheck;

    // URL 파라미터에서 페이지네이션 정보 추출
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const loadDetails = searchParams.get('details') === 'true';
    const filterAuthId = searchParams.get('authId'); // 특정 사용자만 조회
    
    console.log(`📋 관리자 - 사용자 목록 조회 요청 (페이지: ${page}, 한도: ${limit}, 상세: ${loadDetails})`);

    const supabase = await createClient();
    
    // 🔧 임시 수정: Auth 사용자와 내부 사용자 모두 조회 (마이그레이션 완료까지)
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    let authUsers: any[] = [];
    try {
      const { data: authUsersData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      if (!authError) {
        authUsers = authUsersData?.users || [];
      }
    } catch (error) {
      console.warn('Auth API 호출 실패:', error);
    }

    const { data: internalUsers, error: internalError } = await supabase
      .from('user')
      .select('*')
      .order('createdAt', { ascending: false });

    if (internalError) {
      console.error('사용자 테이블 조회 오류:', internalError);
      throw internalError;
    }

    console.log(`✅ Auth 사용자: ${authUsers.length}명, 내부 사용자: ${internalUsers?.length || 0}명 조회됨`);

    // Auth + 내부 사용자 통합
    const combinedUsers = new Map();
    
    // Auth 사용자 추가
    authUsers.forEach(authUser => {
      const internalUser = internalUsers?.find(u => u.id === authUser.id);
      combinedUsers.set(authUser.id, {
        authId: authUser.id,
        email: authUser.email,
        lastSignIn: authUser.last_sign_in_at,
        createdAt: authUser.created_at,
        emailConfirmed: authUser.email_confirmed_at,
        provider: authUser.app_metadata?.provider || 'unknown',
        fullName: authUser.user_metadata?.full_name || authUser.user_metadata?.name,
        avatarUrl: authUser.user_metadata?.avatar_url,
        ...(internalUser && {
          id: internalUser.id,
          name: internalUser.name,
          role: internalUser.role,
          referralCode: internalUser.referralCode,
          referredBy: internalUser.referredBy,
          avatarUrl: internalUser.avatarUrl || authUser.user_metadata?.avatar_url,
          updatedAt: internalUser.updatedAt
        }),
        hasInternalRecord: !!internalUser
      });
    });

    // 내부 전용 사용자 추가 (예: 테스트 데이터)
    internalUsers?.forEach(internalUser => {
      if (!combinedUsers.has(internalUser.id)) {
        combinedUsers.set(internalUser.id, {
          id: internalUser.id,
          authId: internalUser.id,
          email: internalUser.email,
          name: internalUser.name,
          role: internalUser.role,
          createdAt: internalUser.createdAt,
          provider: 'internal',
          hasInternalRecord: true
        });
      }
    });

    let allUsers = Array.from(combinedUsers.values());
    
    // 특정 authId로 필터링 (개별 사용자 조회 시)
    if (filterAuthId) {
      allUsers = allUsers.filter(user => user.authId === filterAuthId);
      console.log(`🔍 특정 사용자 필터링: ${filterAuthId.substring(0, 8)}... → ${allUsers.length}명 발견`);
    }

    // 페이지네이션 적용
    const offset = (page - 1) * limit;
    const paginatedUsers = allUsers.slice(offset, offset + limit);

    // 🎯 단순화된 사용자 정보 조회 - 모든 사용자가 내부 테이블에 있음 (자동 온보딩)
    // 🚀 Canva/Miro 스타일 실시간 조회 - user_storage에서 직접 조회
    let bulkStorageUsage = new Map();
    let bulkSubscriptions = new Map();
    if (!loadDetails && paginatedUsers.length > 0) {
      console.log('🚀 [Fast] 실시간 저장소 사용량 및 구독 정보 조회 중...');
      [bulkStorageUsage, bulkSubscriptions] = await Promise.all([
        getDirectUserStorageUsage(supabase, paginatedUsers), // 🚀 직접 조회로 변경
        getBulkUserSubscriptions(supabase, paginatedUsers)
      ]);
      console.log(`⚡ [Fast] ${bulkStorageUsage.size}명의 저장소 사용량, ${bulkSubscriptions.size}명의 구독 정보 즉시 조회 완료`);
    }

    const enrichedUsers = await Promise.all(
      paginatedUsers.map(async (user) => {
        try {
          if (loadDetails) {
            // 상세 정보가 요청된 경우
            if (user.hasInternalRecord && user.id) {
              // 내부 사용자 - 모든 정보 조회
              const [subscription, tokenUsage, storageUsage, detailedUsage] = await Promise.all([
                getUserSubscription(supabase, user.id, user.email),
                getUserTokenUsage(supabase, user.id),
                getUserStorageUsage(supabase, user.id),
                getUserDetailedUsage(supabase, user.id)
              ]);
              
              return {
                ...user,
                subscription,
                tokenUsage,
                storageUsage,
                detailedUsage
              };
            } else {
              // Auth 전용 사용자 - 기본 정보만
              return {
                ...user,
                subscription: user.email === 'kimjh473947@gmail.com' ? {
                  plan: 'ADMIN',
                  tokensTotal: 999999999,
                  tokensUsed: 0
                } : null,
                tokenUsage: null,
                storageUsage: null,
                detailedUsage: null
              };
            }
          } else {
            // 기본 로딩: 일괄 계산된 저장소 사용량 + 기본 구독 정보 포함
            const userStorageInfo = bulkStorageUsage.get(user.id);
            const storageUsage = userStorageInfo ? {
              used_bytes: userStorageInfo.usedBytes,
              max_bytes: userStorageInfo.maxBytes,
              file_count: userStorageInfo.totalImages,
              usage_percentage: userStorageInfo.maxBytes > 0 
                ? Math.round((userStorageInfo.usedBytes / userStorageInfo.maxBytes) * 100)
                : 0,
              projects: userStorageInfo.projects,
              characters: userStorageInfo.characters,
              generations: userStorageInfo.generations,
              breakdown: {
                projectImages: userStorageInfo.projectImages,
                characterImages: userStorageInfo.characterImages,
                generationImages: userStorageInfo.generationImages
              }
            } : null;

            // 🎯 일괄 조회된 구독 정보 사용 (멤버십 분포 표시용)
            const basicSubscription = bulkSubscriptions.get(user.id) || {
              plan: user.email === 'kimjh473947@gmail.com' ? 'ADMIN' : 'FREE',
              tokensTotal: user.email === 'kimjh473947@gmail.com' ? 999999999 : 0,
              tokensUsed: 0,
              currentPeriodEnd: null,
              createdAt: user.createdAt
            };

            return {
              ...user,
              subscription: basicSubscription,
              tokenUsage: null,
              storageUsage,
              detailedUsage: null
            };
          }
        } catch (error) {
          console.warn(`사용자 정보 조회 실패 (${user.email}):`, error);
          return {
            ...user,
            subscription: null,
            tokenUsage: null,
            storageUsage: null,
            detailedUsage: null
          };
        }
      })
    );

    // 실제 총 사용자 수 계산
    const actualTotalUsers = allUsers.length;
    
    console.log(`✅ 관리자 - 총 ${enrichedUsers.length}명 사용자 조회 완료 (페이지 ${page}/${Math.ceil(actualTotalUsers / limit)})`);

    // 페이지네이션 메타데이터
    const totalPages = Math.ceil(actualTotalUsers / limit);
    
    return NextResponse.json({
      success: true,
      users: enrichedUsers,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount: actualTotalUsers,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      summary: {
        totalUsers: actualTotalUsers,
        currentPageUsers: enrichedUsers.length,
        authOnlyUsers: allUsers.filter(u => !u.hasInternalRecord).length,
        completeUsers: allUsers.filter(u => u.hasInternalRecord).length,
        adminUsers: allUsers.filter(u => u.role === 'ADMIN').length,
        freeUsers: allUsers.filter(u => u.role === 'USER' || (!u.hasInternalRecord && u.email !== 'kimjh473947@gmail.com')).length
      },
      loadedDetails: loadDetails,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Admin users API error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "사용자 목록 조회 중 오류가 발생했습니다",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// 🚀 [NEW] Canva/Miro 스타일 직접 저장소 사용량 조회 (즉시 응답)
async function getDirectUserStorageUsage(supabase: any, users: any[]) {
  try {
    const userIds = users.filter(u => u.hasInternalRecord && u.id).map(u => u.id);
    if (userIds.length === 0) return new Map();

    console.log(`⚡ [Fast] user_storage에서 ${userIds.length}명의 사용량 직접 조회`);
    
    // user_storage 테이블에서 직접 조회 (초고속)
    const { data: storageData } = await supabase
      .from('user_storage')
      .select('userId, used_bytes, max_bytes, file_count, updated_at')
      .in('userId', userIds);

    const storageMap = new Map();
    
    (storageData || []).forEach(storage => {
      storageMap.set(storage.userId, {
        usedBytes: storage.used_bytes || 0,
        maxBytes: storage.max_bytes || 1024 * 1024 * 1024,
        totalImages: storage.file_count || 0,
        projects: 0, // 세부 분석은 상세 조회시에만
        characters: 0,
        generations: 0,
        breakdown: {
          projectImages: 0,
          characterImages: 0,
          generationImages: 0
        },
        lastUpdated: storage.updated_at
      });
    });

    console.log(`⚡ [Fast] ${storageMap.size}명의 저장소 정보 즉시 조회 완료`);
    return storageMap;
  } catch (error) {
    console.error('❌ [Fast] 직접 저장소 조회 실패:', error);
    return new Map();
  }
}

// 🚀 모든 사용자의 구독 정보를 일괄 조회하는 함수
async function getBulkUserSubscriptions(supabase: any, users: any[]) {
  try {
    const userIds = users.filter(u => u.hasInternalRecord && u.id).map(u => u.id);
    if (userIds.length === 0) return new Map();

    // 모든 구독 정보를 한 번에 조회
    const { data: subscriptions } = await supabase
      .from('subscription')
      .select('userId, plan, tokensTotal, currentPeriodEnd, createdAt')
      .in('userId', userIds);

    const subscriptionMap = new Map();
    
    // 구독 정보가 있는 사용자들을 매핑
    (subscriptions || []).forEach(sub => {
      subscriptionMap.set(sub.userId, {
        plan: sub.plan,
        tokensTotal: sub.tokensTotal || 0,
        tokensUsed: 0, // 기본값 (상세 조회시에만 실제 값)
        currentPeriodEnd: sub.currentPeriodEnd,
        createdAt: sub.createdAt
      });
    });

    // 구독 정보가 없는 사용자들에게 기본값 설정
    users.forEach(user => {
      if (!subscriptionMap.has(user.id)) {
        subscriptionMap.set(user.id, {
          plan: user.email === 'kimjh473947@gmail.com' ? 'ADMIN' : 'FREE',
          tokensTotal: user.email === 'kimjh473947@gmail.com' ? 999999999 : 0,
          tokensUsed: 0,
          currentPeriodEnd: null,
          createdAt: user.createdAt
        });
      }
    });

    return subscriptionMap;
  } catch (error) {
    console.error('Bulk subscription loading failed:', error);
    return new Map();
  }
}

// 🚀 모든 사용자의 DB 사용량을 일괄 계산하는 함수
async function getBulkUserStorageUsage(supabase: any) {
  try {
    // 모든 사용자의 프로젝트, 캐릭터, 생성 이미지를 한 번에 조회
    const [projectsResult, charactersResult, generationsResult, userStorageResult] = await Promise.all([
      supabase
        .from('project')
        .select('userId, id, thumbnailUrl')
        .is('deletedAt', null),
      
      supabase
        .from('character')
        .select('userId, referenceImages, ratioImages, thumbnailUrl'),
      
      supabase
        .from('generation')
        .select('userId, id, imageUrl'),
        
      supabase
        .from('user_storage')
        .select('userId, used_bytes, max_bytes')
    ]);

    const projects = projectsResult.data || [];
    const characters = charactersResult.data || [];
    const generations = generationsResult.data || [];
    const userStorages = userStorageResult.data || [];

    // 사용자별 사용량 집계
    const userUsageMap = new Map();

    // 프로젝트별 이미지 계산
    projects.forEach(project => {
      if (!userUsageMap.has(project.userId)) {
        userUsageMap.set(project.userId, {
          projects: 0,
          characters: 0,
          generations: 0,
          totalImages: 0,
          projectImages: 0,
          characterImages: 0,
          generationImages: 0,
          usedBytes: 0,
          maxBytes: 1024 * 1024 * 1024, // 기본 1GB
        });
      }
      
      const usage = userUsageMap.get(project.userId);
      usage.projects++;
      if (project.thumbnailUrl) {
        usage.projectImages++;
        usage.totalImages++;
      }
    });

    // 캐릭터별 이미지 계산
    characters.forEach(character => {
      if (!userUsageMap.has(character.userId)) {
        userUsageMap.set(character.userId, {
          projects: 0,
          characters: 0,
          generations: 0,
          totalImages: 0,
          projectImages: 0,
          characterImages: 0,
          generationImages: 0,
          usedBytes: 0,
          maxBytes: 1024 * 1024 * 1024,
        });
      }
      
      const usage = userUsageMap.get(character.userId);
      usage.characters++;
      
      // 레퍼런스 이미지 계산
      const refImages = Array.isArray(character.referenceImages) ? character.referenceImages.length : 0;
      
      // 비율별 이미지 계산
      const ratioImages = character.ratioImages && typeof character.ratioImages === 'object'
        ? Object.values(character.ratioImages).reduce((sum, images) => {
            return sum + (Array.isArray(images) ? images.length : 0);
          }, 0)
        : 0;
      
      // 썸네일 이미지
      const thumbnailImages = character.thumbnailUrl ? 1 : 0;
      
      const totalCharImages = refImages + ratioImages + thumbnailImages;
      usage.characterImages += totalCharImages;
      usage.totalImages += totalCharImages;
    });

    // 생성 이미지 계산
    generations.forEach(generation => {
      if (!userUsageMap.has(generation.userId)) {
        userUsageMap.set(generation.userId, {
          projects: 0,
          characters: 0,
          generations: 0,
          totalImages: 0,
          projectImages: 0,
          characterImages: 0,
          generationImages: 0,
          usedBytes: 0,
          maxBytes: 1024 * 1024 * 1024,
        });
      }
      
      const usage = userUsageMap.get(generation.userId);
      usage.generations++;
      if (generation.imageUrl) {
        usage.generationImages++;
        usage.totalImages++;
      }
    });

    // 실제 저장소 사용량 업데이트
    userStorages.forEach(storage => {
      if (userUsageMap.has(storage.userId)) {
        const usage = userUsageMap.get(storage.userId);
        usage.usedBytes = storage.used_bytes || 0;
        usage.maxBytes = storage.max_bytes || 1024 * 1024 * 1024;
      }
    });

    // 예상 사용량 계산 (이미지당 평균 2MB)
    for (const [userId, usage] of userUsageMap.entries()) {
      const estimatedBytes = usage.totalImages * 2 * 1024 * 1024;
      if (usage.usedBytes === 0) {
        usage.usedBytes = estimatedBytes;
      }
    }

    return userUsageMap;
  } catch (error) {
    console.error('Bulk storage usage calculation failed:', error);
    return new Map();
  }
}

// 사용자 구독 정보 조회 함수
async function getUserSubscription(supabase: any, userId: string, userEmail?: string) {
  try {
    const { data: subscription } = await supabase
      .from('subscription')
      .select('*')
      .eq('userId', userId)
      .single();

    if (subscription) {
      return subscription;
    }

    // 구독 정보가 없고 관리자 이메일인 경우 ADMIN 플랜 반환
    if (userEmail === 'kimjh473947@gmail.com') {
      return {
        plan: 'ADMIN',
        tokensTotal: 999999999,
        tokensUsed: 0,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      };
    }

    // 구독 정보가 없는 일반 사용자에게 기본 FREE 플랜 반환
    return {
      plan: 'FREE',
      tokensTotal: 10000, // FREE 플랜 기본 토큰
      tokensUsed: 0,
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30일
    };
  } catch (error) {
    console.warn(`구독 정보 조회 실패 (userId: ${userId}):`, error);
    
    // 관리자인 경우 기본 ADMIN 플랜 반환
    if (userEmail === 'kimjh473947@gmail.com') {
      return {
        plan: 'ADMIN',
        tokensTotal: 999999999,
        tokensUsed: 0,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      };
    }
    
    return null;
  }
}

// 🗑️ 불필요한 Auth 정보 조회 함수 제거됨 (자동 온보딩으로 모든 사용자가 내부 테이블에 있음)

// 🎯 단순화된 토큰 사용량 조회 함수 - 모든 사용자가 내부 ID를 가짐
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