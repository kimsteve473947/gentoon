import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SecureLogger } from '@/lib/utils/secure-logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '6');
    const offset = (page - 1) * limit;

    const supabase = await createClient();

    // 🔐 사용자 인증
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ⚡ 초고속 단일 쿼리 - timestamp만 선택하여 최적화
    const { data: projects, error: projectError } = await supabase
      .from('project')
      .select('id, title, thumbnailUrl, lastEditedAt')
      .eq('userId', user.id)
      .is('deletedAt', null)
      .order('lastEditedAt', { ascending: false })
      .range(offset, offset + limit - 1);

    if (projectError) {
      SecureLogger.error('프로젝트 쿼리 에러', projectError);
      return NextResponse.json({ error: projectError.message }, { status: 500 });
    }

    const loadTime = Date.now() - startTime;

    // 🚀 초간단 데이터 변환 - timestamp 그대로 전송
    const transformedProjects = projects?.map(project => ({
      id: project.id,
      title: project.title,
      thumbnail: project.thumbnailUrl,
      lastEdited: project.lastEditedAt // timestamp 그대로
    })) || [];

    const hasNextPage = projects?.length === limit;

    SecureLogger.lightningFast(`⚡ [Lightning-Fast] 프로젝트 로딩 완료: ${transformedProjects.length}개 (${loadTime}ms)`);

    return NextResponse.json({
      success: true,
      projects: transformedProjects,
      pagination: {
        page,
        limit,
        hasNextPage
      },
      performance: {
        loadTime,
        isOptimized: loadTime < 500,
        timestamp: Date.now()
      }
    });

  } catch (error) {
    SecureLogger.error('[Lightning-Fast] 예상치 못한 에러', error);
    const loadTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      performance: { loadTime, isOptimized: false }
    }, { status: 500 });
  }
}