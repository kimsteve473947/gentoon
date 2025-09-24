import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ProjectType, AspectRatio, TargetPlatform, GalleryViewMode } from '@/types/gallery';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 기존 파라미터들
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '12'), 50); // 최대 50개로 제한
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const offset = (page - 1) * limit;

    // 새로운 외주 프로젝트 관련 파라미터들
    const viewMode = searchParams.get('viewMode') as GalleryViewMode || 'all';
    const isOutsourced = searchParams.get('is_outsourced');
    const projectType = searchParams.get('project_type') as ProjectType;
    const clientCompany = searchParams.get('client_company');
    const aspectRatio = searchParams.get('aspect_ratio') as AspectRatio;
    const targetPlatform = searchParams.get('target_platform') as TargetPlatform;
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order') === 'asc' ? 'asc' : 'desc';

    // 기본 쿼리 구성
    let query = supabase
      .from('gallery_series')
      .select('*')
      .eq('is_published', true); // 게시된 시리즈만 조회

    let countQuery = supabase
      .from('gallery_series')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true);

    // 뷰 모드 기반 필터링
    switch (viewMode) {
      case 'featured':
        query = query.eq('is_featured', true);
        countQuery = countQuery.eq('is_featured', true);
        break;
      case 'outsourced':
        query = query.eq('is_outsourced', true);
        countQuery = countQuery.eq('is_outsourced', true);
        break;
      case 'internal':
        query = query.eq('is_outsourced', false);
        countQuery = countQuery.eq('is_outsourced', false);
        break;
      case 'all':
      default:
        // 모든 프로젝트 표시
        break;
    }

    // 외주 프로젝트 필터
    if (isOutsourced !== null && isOutsourced !== undefined) {
      const outsourcedValue = isOutsourced === 'true';
      query = query.eq('is_outsourced', outsourcedValue);
      countQuery = countQuery.eq('is_outsourced', outsourcedValue);
    }

    // 프로젝트 타입 필터
    if (projectType && projectType !== 'all') {
      query = query.eq('project_type', projectType);
      countQuery = countQuery.eq('project_type', projectType);
    }

    // 클라이언트 회사 필터
    if (clientCompany && clientCompany.trim().length > 0) {
      query = query.ilike('client_company', `%${clientCompany.trim()}%`);
      countQuery = countQuery.ilike('client_company', `%${clientCompany.trim()}%`);
    }

    // 화면 비율 필터
    if (aspectRatio && aspectRatio !== 'all') {
      query = query.eq('aspect_ratio', aspectRatio);
      countQuery = countQuery.eq('aspect_ratio', aspectRatio);
    }

    // 타겟 플랫폼 필터
    if (targetPlatform && targetPlatform !== 'all') {
      query = query.eq('target_platform', targetPlatform);
      countQuery = countQuery.eq('target_platform', targetPlatform);
    }

    // 카테고리 필터 (기존 로직 + 새로운 프로젝트 타입 고려)
    if (category && category !== 'all') {
      // 외주 프로젝트의 경우 project_type을 카테고리로 사용
      if (viewMode === 'outsourced' || isOutsourced === 'true') {
        if (['webtoon', 'instatoon', 'advertisement', 'promotional', 'branding'].includes(category)) {
          query = query.eq('project_type', category);
          countQuery = countQuery.eq('project_type', category);
        }
      } else {
        // 일반 프로젝트의 경우 기존 카테고리 사용
        if (['romance', 'fantasy', 'action', 'comedy', 'drama'].includes(category)) {
          query = query.eq('category', category);
          countQuery = countQuery.eq('category', category);
        }
      }
    }

    // 인기작 필터 (별도 파라미터로도 지원)
    if (featured === 'true') {
      query = query.eq('is_featured', true);
      countQuery = countQuery.eq('is_featured', true);
    }

    // 검색 기능 (클라이언트 회사명도 포함)
    if (search && search.trim().length > 0) {
      const searchTerm = search.trim();
      const searchColumns = [
        `title.ilike.%${searchTerm}%`,
        `description.ilike.%${searchTerm}%`,
        `author.ilike.%${searchTerm}%`,
        `client_company.ilike.%${searchTerm}%`,
        `client_brand.ilike.%${searchTerm}%`
      ];
      query = query.or(searchColumns.join(','));
      countQuery = countQuery.or(searchColumns.join(','));
    }

    // 정렬 적용
    const validSortFields = ['created_at', 'updated_at', 'view_count', 'like_count', 'display_order', 'title'];
    const actualSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    
    // 외주 프로젝트의 경우 display_order를 우선으로 정렬
    if (viewMode === 'outsourced' || isOutsourced === 'true') {
      query = query.order('display_order', { ascending: sortOrder === 'asc' });
      if (actualSortBy !== 'display_order') {
        query = query.order(actualSortBy, { ascending: sortOrder === 'asc' });
      }
    } else {
      query = query.order(actualSortBy, { ascending: sortOrder === 'asc' });
    }

    // 페이지네이션 적용
    query = query.range(offset, offset + limit - 1);

    // 데이터 조회
    const [seriesResult, countResult] = await Promise.all([
      query,
      countQuery
    ]);

    const { data: series, error: seriesError } = seriesResult;
    const { count, error: countError } = countResult;

    if (seriesError) {
      console.error('Database error:', seriesError);
      return NextResponse.json({ 
        error: 'Failed to fetch series',
        details: process.env.NODE_ENV === 'development' ? seriesError.message : undefined
      }, { status: 500 });
    }

    if (countError) {
      console.error('Count error:', countError);
    }

    // 외주 프로젝트 통계 계산 (외주 뷰 모드일 때)
    let outsourcedStats = null;
    if (viewMode === 'outsourced' || isOutsourced === 'true') {
      try {
        const { data: statsData } = await supabase
          .from('gallery_series')
          .select('client_company, project_type, target_platform')
          .eq('is_outsourced', true)
          .eq('is_published', true);

        if (statsData) {
          const companiesSet = new Set(statsData.map(s => s.client_company).filter(Boolean));
          const projectTypesCount = statsData.reduce((acc, s) => {
            acc[s.project_type] = (acc[s.project_type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          const platformsCount = statsData.reduce((acc, s) => {
            acc[s.target_platform] = (acc[s.target_platform] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          outsourcedStats = {
            total_clients: companiesSet.size,
            total_projects: statsData.length,
            project_types: projectTypesCount,
            platforms: platformsCount
          };
        }
      } catch (error) {
        console.error('Failed to fetch outsourced stats:', error);
      }
    }

    return NextResponse.json({
      success: true,
      series: series || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNext: count ? page * limit < count : false,
        hasPrev: page > 1,
      },
      filters: {
        category,
        featured: featured === 'true',
        search,
        // 새로운 필터들
        viewMode,
        is_outsourced: isOutsourced === 'true',
        project_type: projectType,
        client_company: clientCompany,
        aspect_ratio: aspectRatio,
        target_platform: targetPlatform,
        sort_by: actualSortBy,
        sort_order: sortOrder
      },
      // 외주 프로젝트 통계 (해당하는 경우에만)
      ...(outsourcedStats && { outsourced_stats: outsourcedStats })
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}