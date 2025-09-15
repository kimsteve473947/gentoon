import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '12'), 50); // 최대 50개로 제한
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const offset = (page - 1) * limit;

    // 기본 쿼리 구성
    let query = supabase
      .from('gallery_series')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    let countQuery = supabase
      .from('gallery_series')
      .select('*', { count: 'exact', head: true });

    // 카테고리 필터
    if (category && category !== 'all' && ['romance', 'fantasy', 'action', 'comedy', 'drama'].includes(category)) {
      query = query.eq('category', category);
      countQuery = countQuery.eq('category', category);
    }

    // 인기작 필터
    if (featured === 'true') {
      query = query.eq('is_featured', true);
      countQuery = countQuery.eq('is_featured', true);
    }

    // 검색 기능
    if (search && search.trim().length > 0) {
      const searchTerm = search.trim();
      query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%`);
      countQuery = countQuery.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%`);
    }

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
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}