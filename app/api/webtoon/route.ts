import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { WebtoonFilters, WebtoonResponse } from '@/types/webtoon';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // 필터링 파라미터 추출
    const filters: WebtoonFilters = {
      category: (searchParams.get('category') as any) || 'all',
      featured: searchParams.get('featured') === 'true',
      client: searchParams.get('client') || undefined,
      search: searchParams.get('search') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '12'), 50),
      sortBy: (searchParams.get('sortBy') as any) || 'created_at',
      sortOrder: (searchParams.get('sortOrder') as any) || 'desc'
    };

    const offset = ((filters.page || 1) - 1) * (filters.limit || 12);

    // 기본 쿼리 구성
    let query = supabase
      .from('webtoon_projects')
      .select('*')
      .eq('published', true);

    let countQuery = supabase
      .from('webtoon_projects')
      .select('*', { count: 'exact', head: true })
      .eq('published', true);

    // 카테고리 필터
    if (filters.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
      countQuery = countQuery.eq('category', filters.category);
    }

    // 추천작 필터
    if (filters.featured) {
      query = query.eq('featured', true);
      countQuery = countQuery.eq('featured', true);
    }

    // 클라이언트 필터
    if (filters.client) {
      query = query.ilike('client', `%${filters.client}%`);
      countQuery = countQuery.ilike('client', `%${filters.client}%`);
    }

    // 검색 기능
    if (filters.search) {
      const searchTerm = filters.search.trim();
      query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,client.ilike.%${searchTerm}%`);
      countQuery = countQuery.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,client.ilike.%${searchTerm}%`);
    }

    // 정렬
    const validSortFields = ['created_at', 'views', 'likes', 'title'];
    const actualSortBy = validSortFields.includes(filters.sortBy || '') ? filters.sortBy : 'created_at';
    const actualSortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';
    
    query = query.order(actualSortBy!, { ascending: actualSortOrder === 'asc' });

    // 페이지네이션
    query = query.range(offset, offset + (filters.limit || 12) - 1);

    // 데이터 조회
    const [projectsResult, countResult] = await Promise.all([
      query,
      countQuery
    ]);

    const { data: projects, error: projectsError } = projectsResult;
    const { count, error: countError } = countResult;

    if (projectsError) {
      console.error('Database error:', projectsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch projects',
        details: process.env.NODE_ENV === 'development' ? projectsError.message : undefined
      }, { status: 500 });
    }

    if (countError) {
      console.error('Count error:', countError);
    }

    const response: WebtoonResponse = {
      success: true,
      data: projects || [],
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 12,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / (filters.limit || 12))
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : undefined
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 관리자 권한 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const body = await request.json();
    
    // 필수 필드 검증
    if (!body.title || !body.description || !body.client || !body.category) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: title, description, client, category'
      }, { status: 400 });
    }

    // 프로젝트 생성
    const { data: project, error } = await supabase
      .from('webtoon_projects')
      .insert({
        title: body.title,
        description: body.description,
        client: body.client,
        category: body.category,
        thumbnail_url: body.thumbnail_url || null,
        images: body.images || [],
        featured: body.featured || false,
        published: body.published || false,
        tags: body.tags || [],
        episode_count: body.episode_count || 1,
        creator_id: body.creator_id || null
      })
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to create project',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: project,
      message: 'Project created successfully'
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}