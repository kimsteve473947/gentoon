import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserStorage, formatBytes } from '@/lib/storage/storage-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 🚀 응답 캐싱을 위한 인메모리 캐시
const responseCache = new Map();
const CACHE_DURATION = 300000; // 5분 캐시 (300초)

// 🚀 Canva 스타일 통합 대시보드 API - 모든 초기 데이터를 한 번에 로딩
export async function GET(request: NextRequest) {
  const requestStart = Date.now();
  
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // 쿼리 파라미터
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    
    // 🔐 한 번만 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    // 🔐 사용자 정보 한 번만 조회
    const { data: userData } = await supabase
      .from('user')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json(
        { success: false, error: "사용자 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const userId = userData.id;
    const offset = (page - 1) * limit;
    
    // 🚀 캐시 키 생성
    const cacheKey = `dashboard_${userId}_${page}_${limit}`;
    
    // 🚀 캐시된 응답 확인
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`📦 Cache HIT for user ${userId} (${Date.now() - requestStart}ms)`);
      return NextResponse.json(cached.data);
    }

    // 🚀 모든 데이터를 병렬로 한 번에 로딩 - Canva 스타일 + 스토리지 정보 포함
    const [
      projectsResult,
      charactersResult,
      storageInfo,
      dbUsageStats
    ] = await Promise.all([
      // 1. 최적화된 프로젝트 쿼리
      supabase
        .from('project')
        .select(`
          id, 
          title, 
          "thumbnailUrl", 
          "panelCount", 
          "hasContent", 
          status, 
          "createdAt", 
          "updatedAt", 
          "lastEditedAt"
        `)
        .eq('userId', userId)
        .is('deletedAt', null)
        .order('lastEditedAt', { ascending: false })
        .range(offset, offset + limit),

      // 2. 최적화된 캐릭터 쿼리 - 썸네일 표시용 최소 데이터만
      supabase
        .from('character')
        .select('id, name, thumbnailUrl, createdAt')
        .eq('userId', userId)
        .order('createdAt', { ascending: false }),

      // 3. 스토리지 정보 조회 (병렬)
      getUserStorage(userId).catch(error => {
        console.warn('스토리지 정보 조회 실패:', error);
        return { used_bytes: 0, max_bytes: 1073741824, file_count: 0 };
      }),

      // 4. DB 사용량 통계 (병렬)
      getSimplifiedDBUsage(userId, supabase).catch(error => {
        console.warn('DB 사용량 조회 실패:', error);
        return { totalImages: 0, estimatedBytes: 0, breakdown: {} };
      })
    ]);

    // 🛡️ 에러 체크
    if (projectsResult.error) {
      console.error('Projects query error:', projectsResult.error);
      throw projectsResult.error;
    }

    if (charactersResult.error) {
      console.error('Characters query error:', charactersResult.error);
      throw charactersResult.error;
    }

    const projects = projectsResult.data || [];
    const characters = charactersResult.data || [];

    // 🚀 페이지네이션 최적화
    const hasMoreProjects = projects.length === limit + 1;
    const actualProjects = hasMoreProjects ? projects.slice(0, limit) : projects;
    
    // 🎨 프로젝트 데이터 변환 (Canva 스타일)
    const processedProjects = actualProjects.map((project) => ({
      id: project.id,
      title: project.title || '무제 프로젝트',
      thumbnail: project.thumbnailUrl,
      panelCount: project.panelCount || 0,
      status: mapProjectStatus(project.status),
      hasContent: project.hasContent,
      contentSummary: project.hasContent ? `${project.panelCount || 0}개 패널` : '빈 프로젝트',
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      lastEditedAt: project.lastEditedAt || project.updatedAt,
      lastActivity: project.lastEditedAt || project.updatedAt,
      hasImages: project.hasContent && project.panelCount > 0
    }));

    // 🎨 캐릭터 데이터 변환 (썸네일 표시용)
    const processedCharacters = characters.map(char => ({
      id: char.id,
      name: char.name,
      thumbnailUrl: char.thumbnailUrl,
      createdAt: char.createdAt,
    }));

    // 🚀 스토리지 정보 처리
    const actualUsedBytes = Math.max(storageInfo.used_bytes || 0, dbUsageStats.estimatedBytes || 0);
    const usagePercentage = (actualUsedBytes / (storageInfo.max_bytes || 1073741824)) * 100;
    
    const warningLevel = 
      usagePercentage >= 95 ? 'critical' :
      usagePercentage >= 80 ? 'warning' :
      usagePercentage >= 60 ? 'high' :
      usagePercentage >= 30 ? 'medium' : 'normal';

    // 🚀 응답 데이터 구성
    const responseData = {
      success: true,
      data: {
        projects: {
          items: processedProjects,
          pagination: {
            page,
            limit,
            hasMore: hasMoreProjects,
            total: null // 성능을 위해 총 개수는 제공하지 않음
          }
        },
        characters: {
          items: processedCharacters,
          count: characters.length
        },
        // 🚀 스토리지 정보 포함 (별도 API 호출 불필요)
        storage: {
          usedBytes: actualUsedBytes,
          maxBytes: storageInfo.max_bytes || 1073741824,
          usagePercentage: Math.min(usagePercentage, 100),
          formatted: {
            used: formatBytes(actualUsedBytes),
            max: formatBytes(storageInfo.max_bytes || 1073741824)
          },
          breakdown: dbUsageStats.breakdown,
          warningLevel
        }
      },
      // 📊 기본 통계 (빠른 계산)
      stats: {
        projectCount: actualProjects.length,
        characterCount: characters.length,
        totalItems: actualProjects.length + characters.length
      },
      // ⚡ 성능 정보
      performance: {
        timestamp: Date.now(),
        loadTime: Date.now() - requestStart,
        cached: false
      }
    };

    // 🚀 응답 캐시에 저장
    responseCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });
    
    // 🗑️ 오래된 캐시 정리 (메모리 절약)
    if (responseCache.size > 100) {
      const oldestKey = responseCache.keys().next().value;
      responseCache.delete(oldestKey);
    }

    console.log(`🚀 Fresh data loaded for user ${userId} (${Date.now() - requestStart}ms)`);
    
    // 🚀 통합 응답 (Canva 스타일 - 모든 것을 한 번에)
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Dashboard initial API error:', error);
    return NextResponse.json(
      { success: false, error: "데이터 로드 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 🎨 프로젝트 상태 매핑 (DB -> UI)
function mapProjectStatus(dbStatus: string): 'draft' | 'completed' {
  switch (dbStatus) {
    case 'COMPLETED':
    case 'PUBLISHED':
      return 'completed';
    default:
      return 'draft';
  }
}

// 🚀 DB 사용량 계산 함수 (storage/check/route.ts와 동일한 로직)
async function getSimplifiedDBUsage(userId: string, supabase: any) {
  try {
    // 🔥 단일 SQL 쿼리로 모든 통계를 한 번에 계산
    const { data: statsData, error: statsError } = await supabase.rpc('get_user_storage_stats', {
      p_user_id: userId
    });

    if (statsError) {
      console.warn('SQL 함수 호출 실패, fallback 사용:', statsError.message);
      return await getFallbackDBUsage(userId, supabase);
    }

    if (!statsData || statsData.length === 0) {
      return getEmptyStats();
    }

    const stats = statsData[0];
    
    // 💾 사용량 계산 (이미지당 평균 2MB)
    const projectImages = (stats.project_thumbnails || 0) + (stats.panel_count || 0) + (stats.generation_count || 0);
    const characterImages = (stats.character_ref_images || 0) + (stats.character_ratio_images || 0);
    
    const projectBytes = projectImages * 2 * 1024 * 1024;
    const characterBytes = characterImages * 2 * 1024 * 1024;
    const totalBytes = projectBytes + characterBytes;

    return {
      totalImages: projectImages + characterImages,
      estimatedBytes: totalBytes,
      breakdown: {
        projects: {
          count: stats.project_count || 0,
          images: projectImages,
          bytes: projectBytes,
          details: {
            thumbnails: stats.project_thumbnails || 0,
            panels: stats.panel_count || 0,
            generatedImages: stats.generation_count || 0
          }
        },
        characters: {
          count: stats.character_count || 0,
          images: characterImages,
          bytes: characterBytes,
          details: {
            referenceImages: stats.character_ref_images || 0,
            ratioImages: stats.character_ratio_images || 0
          }
        }
      }
    };
  } catch (error) {
    console.error('통합 쿼리 실행 중 오류:', error);
    return await getFallbackDBUsage(userId, supabase);
  }
}

// 🛡️ Fallback 함수
async function getFallbackDBUsage(userId: string, supabase: any) {
  try {
    const [projectsResult, charactersResult] = await Promise.all([
      supabase
        .from('project')
        .select('id, thumbnailUrl', { count: 'exact' })
        .eq('userId', userId)
        .is('deletedAt', null),
      
      supabase
        .from('character')
        .select('referenceImages, ratioImages')
        .eq('userId', userId)
    ]);

    const projects = projectsResult.data || [];
    const characters = charactersResult.data || [];
    const projectCount = projectsResult.count || 0;
    
    const projectThumbnailImages = projects.filter((p: any) => p.thumbnailUrl).length;
    const projectImages = projectThumbnailImages;
    
    const characterImages = characters.reduce((sum: number, c: any) => {
      const refs = Array.isArray(c.referenceImages) ? c.referenceImages.length : 0;
      const ratios = c.ratioImages && typeof c.ratioImages === 'object' 
        ? Object.values(c.ratioImages).reduce((ratioSum: number, images: any) => {
            return ratioSum + (Array.isArray(images) ? images.length : 0);
          }, 0)
        : 0;
      return sum + refs + ratios;
    }, 0);

    const projectBytes = projectImages * 2 * 1024 * 1024;
    const characterBytes = characterImages * 2 * 1024 * 1024;
    const totalBytes = projectBytes + characterBytes;

    return {
      totalImages: projectImages + characterImages,
      estimatedBytes: totalBytes,
      breakdown: {
        projects: {
          count: projectCount,
          images: projectImages,
          bytes: projectBytes,
          details: { thumbnails: projectThumbnailImages, panels: 0, generatedImages: 0 }
        },
        characters: {
          count: characters.length,
          images: characterImages,
          bytes: characterBytes,
          details: { referenceImages: 0, ratioImages: 0 }
        }
      }
    };
  } catch (error) {
    console.error('Fallback 쿼리 실행 중 오류:', error);
    return getEmptyStats();
  }
}

// 🎯 빈 통계 객체 반환
function getEmptyStats() {
  return {
    totalImages: 0,
    estimatedBytes: 0,
    breakdown: {
      projects: {
        count: 0,
        images: 0,
        bytes: 0,
        details: { thumbnails: 0, panels: 0, generatedImages: 0 }
      },
      characters: {
        count: 0,
        images: 0,
        bytes: 0,
        details: { referenceImages: 0, ratioImages: 0 }
      }
    }
  };
}