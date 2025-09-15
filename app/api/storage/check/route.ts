import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserStorage, canUploadFile, formatBytes } from '@/lib/storage/storage-manager'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 사용자 인증 확인
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }
    
    // 사용자 ID 가져오기
    const { data: userData } = await supabase
      .from('user')
      .select('id')
      .eq('id', user.id)
      .single()
    
    if (!userData) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 })
    }
    
    // 🎯 기존 스토리지 정보와 간소화된 DB 사용량을 동시에 계산
    const [storageInfo, dbUsageStats] = await Promise.all([
      getUserStorage(userData.id),
      getSimplifiedDBUsage(userData.id, supabase)
    ]);
    
    // 실제 사용량과 예상 사용량 중 큰 값을 사용
    const actualUsedBytes = Math.max(storageInfo.used_bytes, dbUsageStats.estimatedBytes);
    const usagePercentage = (actualUsedBytes / storageInfo.max_bytes) * 100;
    
    // 경고 레벨 계산
    const warningLevel = 
      usagePercentage >= 95 ? 'critical' :
      usagePercentage >= 80 ? 'warning' :
      usagePercentage >= 60 ? 'high' :
      usagePercentage >= 30 ? 'medium' : 'normal';
    
    return NextResponse.json({
      usedBytes: actualUsedBytes,
      maxBytes: storageInfo.max_bytes,
      remainingBytes: storageInfo.max_bytes - actualUsedBytes,
      usagePercentage: Math.min(usagePercentage, 100),
      fileCount: dbUsageStats.totalImages,
      formatted: {
        used: formatBytes(actualUsedBytes),
        max: formatBytes(storageInfo.max_bytes),
        remaining: formatBytes(storageInfo.max_bytes - actualUsedBytes)
      },
      breakdown: dbUsageStats.breakdown,
      warningLevel,
      // 🎯 사용자 친화적인 카테고리별 정보
      categories: {
        projects: {
          count: dbUsageStats.breakdown.projects.count,
          used: formatBytes(dbUsageStats.breakdown.projects.bytes),
          usedBytes: dbUsageStats.breakdown.projects.bytes,
          description: `프로젝트 ${dbUsageStats.breakdown.projects.count}개 (썸네일, 패널, AI 이미지 포함)`
        },
        characters: {
          count: dbUsageStats.breakdown.characters.count,
          used: formatBytes(dbUsageStats.breakdown.characters.bytes),
          usedBytes: dbUsageStats.breakdown.characters.bytes,
          description: `캐릭터 ${dbUsageStats.breakdown.characters.count}개 (레퍼런스 이미지 포함)`
        }
      },
      // 기존 호환성을 위한 stats
      stats: {
        totalProjects: dbUsageStats.breakdown.projects.count,
        totalCharacters: dbUsageStats.breakdown.characters.count,
        totalImages: dbUsageStats.totalImages,
        lastUpdated: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Storage check error:', error)
    return NextResponse.json(
      { error: '스토리지 정보를 가져오는데 실패했습니다' },
      { status: 500 }
    )
  }
}

// 🚀 고도로 최적화된 사용자 DB 사용량 계산 - 단일 통합 쿼리
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

// 🛡️ Fallback 함수 - SQL 함수가 없을 경우 사용
async function getFallbackDBUsage(userId: string, supabase: any) {
  // 먼저 프로젝트 가져오기
  const projectsResult = await supabase
    .from('project')
    .select('id, thumbnailUrl', { count: 'exact' })
    .eq('userId', userId)
    .is('deletedAt', null);

  const projects = projectsResult.data || [];
  const projectIds = projects.map((p: any) => p.id);

  // 나머지 데이터 병렬로 가져오기
  const [
    charactersResult,
    panelsResult,
    generationsResult
  ] = await Promise.all([
    supabase
      .from('character')
      .select('referenceImages, ratioImages')
      .eq('userId', userId),
    
    projectIds.length > 0 ? supabase
      .from('panel')
      .select('id', { count: 'exact' })
      .in('projectId', projectIds) : { count: 0 },
    
    supabase
      .from('generation')
      .select('id', { count: 'exact' })
      .eq('userId', userId)
  ]);

  const characters = charactersResult.data || [];
  const projectCount = projectsResult.count || 0;
  const panelCount = panelsResult.count || 0;
  const generationCount = generationsResult.count || 0;

  const projectThumbnailImages = projects.filter((p: any) => p.thumbnailUrl).length;
  const projectImages = projectThumbnailImages + panelCount + generationCount;
  
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
        details: {
          thumbnails: projectThumbnailImages,
          panels: panelCount,
          generatedImages: generationCount
        }
      },
      characters: {
        count: characters.length,
        images: characterImages,
        bytes: characterBytes,
        details: {
          referenceImages: characters.reduce((sum: number, c: any) => sum + (Array.isArray(c.referenceImages) ? c.referenceImages.length : 0), 0),
          ratioImages: characters.reduce((sum: number, c: any) => {
            if (c.ratioImages && typeof c.ratioImages === 'object') {
              return sum + Object.values(c.ratioImages).reduce((ratioSum: number, images: any) => {
                return ratioSum + (Array.isArray(images) ? images.length : 0);
              }, 0);
            }
            return sum;
          }, 0)
        }
      }
    }
  };
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
        details: {
          thumbnails: 0,
          panels: 0,
          generatedImages: 0
        }
      },
      characters: {
        count: 0,
        images: 0,
        bytes: 0,
        details: {
          referenceImages: 0,
          ratioImages: 0
        }
      }
    }
  };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { fileSize } = await request.json()
    
    if (!fileSize || fileSize < 0) {
      return NextResponse.json({ error: '유효하지 않은 파일 크기입니다' }, { status: 400 })
    }
    
    // 사용자 인증 확인
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }
    
    // 사용자 ID 가져오기
    const { data: userData } = await supabase
      .from('user')
      .select('id')
      .eq('id', user.id)
      .single()
    
    if (!userData) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 })
    }
    
    // 업로드 가능 여부 확인
    const result = await canUploadFile(userData.id, fileSize)
    
    if (!result.canUpload) {
      return NextResponse.json({
        ...result,
        error: '저장 공간이 부족합니다. 멤버십을 업그레이드하거나 파일을 삭제해주세요.',
        formatted: {
          used: formatBytes(result.usedBytes),
          max: formatBytes(result.maxBytes),
          remaining: formatBytes(result.remainingBytes),
          fileSize: formatBytes(fileSize)
        }
      }, { status: 403 })
    }
    
    return NextResponse.json({
      ...result,
      formatted: {
        used: formatBytes(result.usedBytes),
        max: formatBytes(result.maxBytes),
        remaining: formatBytes(result.remainingBytes),
        fileSize: formatBytes(fileSize)
      }
    })
  } catch (error) {
    console.error('Storage check error:', error)
    return NextResponse.json(
      { error: '용량 확인에 실패했습니다' },
      { status: 500 }
    )
  }
}