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

    // 기본 쿼리 구성 - project 테이블 사용
    let query = supabase
      .from('project')
      .select('*')
      .eq('status', 'PUBLISHED')
      .eq('isPublic', true)
      .is('deletedAt', null);

    let countQuery = supabase
      .from('project')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PUBLISHED')
      .eq('isPublic', true)
      .is('deletedAt', null);

    // 검색 기능 - project 테이블 필드에 맞게 수정
    if (filters.search) {
      const searchTerm = filters.search.trim();
      query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      countQuery = countQuery.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }

    // 정렬 - project 테이블 필드에 맞게 수정
    const validSortFields = ['createdAt', 'lastEditedAt', 'title'];
    const actualSortBy = validSortFields.includes(filters.sortBy || '') ? filters.sortBy : 'createdAt';
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
    
    // 필수 필드 검증 - project 테이블에 맞게 수정
    if (!body.title || !body.userId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: title, userId'
      }, { status: 400 });
    }

    // 프로젝트 생성 - project 테이블에 맞게 수정
    const { data: project, error } = await supabase
      .from('project')
      .insert({
        title: body.title,
        description: body.description || '',
        userId: body.userId,
        thumbnailUrl: body.thumbnailUrl || null,
        status: body.published ? 'PUBLISHED' : 'DRAFT',
        isPublic: body.published || false
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