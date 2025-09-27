import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { UsageCacheManager } from '@/lib/usage/cache-manager';

// 관리자 권한 확인
async function checkAdminAccess(supabase: any, user: any) {
  if (!user) return false;
  
  const { data: subscription } = await supabase
    .from('subscription')
    .select('plan')
    .eq('userId', user.id)
    .single();
  
  return subscription?.plan === 'ADMIN';
}

// POST: 사용량 캐시 새로고침
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: '로그인이 필요합니다'
      }, { status: 401 });
    }

    // 관리자 권한 확인
    const hasAdminAccess = await checkAdminAccess(supabase, user);
    if (!hasAdminAccess) {
      return NextResponse.json({
        success: false,
        error: '관리자 권한이 필요합니다'
      }, { status: 403 });
    }

    const body = await request.json();
    const { userId, refreshAll } = body;

    let result;
    
    if (refreshAll) {
      // 모든 사용자 캐시 새로고침
      console.log('🔄 [CacheRefresh] 모든 사용자 캐시 새로고침 시작...');
      result = await UsageCacheManager.refreshAllUsersCache();
      
      return NextResponse.json({
        success: result.success,
        message: `캐시 새로고침 완료: ${result.updated}/${result.total || 0}명 업데이트`,
        stats: {
          updated: result.updated,
          total: result.total || 0,
          successRate: result.total > 0 ? Math.round((result.updated / result.total) * 100) : 0
        }
      });
    } else if (userId) {
      // 특정 사용자 캐시 새로고침
      console.log(`🔄 [CacheRefresh] 사용자 ${userId} 캐시 새로고침 시작...`);
      result = await UsageCacheManager.refreshAllUserCache(userId);
      
      if (result) {
        return NextResponse.json({
          success: true,
          message: '사용자 캐시가 새로고침되었습니다',
          cache: result
        });
      } else {
        return NextResponse.json({
          success: false,
          error: '캐시 새로고침에 실패했습니다'
        }, { status: 500 });
      }
    } else {
      return NextResponse.json({
        success: false,
        error: 'userId 또는 refreshAll 파라미터가 필요합니다'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ [CacheRefresh] 캐시 새로고침 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '캐시 새로고침 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}

// GET: 캐시 상태 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: '로그인이 필요합니다'
      }, { status: 401 });
    }

    // 관리자 권한 확인
    const hasAdminAccess = await checkAdminAccess(supabase, user);
    if (!hasAdminAccess) {
      return NextResponse.json({
        success: false,
        error: '관리자 권한이 필요합니다'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (userId) {
      // 특정 사용자 캐시 상태 조회
      const { data: cache } = await supabase
        .from('user_usage_cache')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!cache) {
        return NextResponse.json({
          success: false,
          error: '해당 사용자의 캐시가 존재하지 않습니다'
        }, { status: 404 });
      }

      // 실제 데이터와 비교
      const [
        { count: actualProjects },
        { count: actualCharacters },
        { count: actualImages }
      ] = await Promise.all([
        supabase.from('project').select('id', { count: 'exact', head: true }).eq('userId', userId).is('deletedAt', null),
        supabase.from('character').select('id', { count: 'exact', head: true }).eq('userId', userId),
        supabase.from('generation').select('id', { count: 'exact', head: true }).eq('userId', userId)
      ]);

      return NextResponse.json({
        success: true,
        cache: {
          ...cache,
          lastCalculatedAgo: getTimeAgo(cache.last_calculated),
          accuracy: {
            projects: {
              cached: cache.total_projects,
              actual: actualProjects || 0,
              accurate: cache.total_projects === (actualProjects || 0)
            },
            characters: {
              cached: cache.total_characters,
              actual: actualCharacters || 0,
              accurate: cache.total_characters === (actualCharacters || 0)
            },
            images: {
              cached: cache.current_month_images,
              actual: actualImages || 0,
              accurate: cache.current_month_images === (actualImages || 0)
            }
          }
        }
      });
    } else {
      // 전체 캐시 상태 요약
      const { data: caches, count } = await supabase
        .from('user_usage_cache')
        .select('last_calculated', { count: 'exact' })
        .order('last_calculated', { ascending: false });

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const recentCaches = caches?.filter(cache => 
        new Date(cache.last_calculated) > oneHourAgo
      ).length || 0;

      const staleCaches = caches?.filter(cache => 
        new Date(cache.last_calculated) < oneDayAgo
      ).length || 0;

      return NextResponse.json({
        success: true,
        summary: {
          totalUsers: count || 0,
          recentlyUpdated: recentCaches,
          staleCaches: staleCaches,
          healthScore: count > 0 ? Math.round(((count - staleCaches) / count) * 100) : 0
        }
      });
    }

  } catch (error) {
    console.error('❌ [CacheRefresh] 캐시 상태 조회 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '캐시 상태 조회 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}

// 헬퍼 함수
function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  return `${diffDays}일 전`;
}