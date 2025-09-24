import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { CreateGallerySeriesRequest } from '@/types/gallery';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 관리자 전용 이메일
const ADMIN_EMAIL = 'kimjh473947@gmail.com';

async function verifyAdmin(request: NextRequest) {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return { success: false, error: 'No token provided' };
    }

    const token = authHeader.substring(7);
    
    // 토큰으로 사용자 확인
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return { success: false, error: 'Invalid token' };
    }

    if (user.email !== ADMIN_EMAIL) {
      return { success: false, error: 'Admin access required' };
    }

    return { success: true, user };
  } catch (error) {
    // 클라이언트 사이드에서 호출하는 경우, 쿠키에서 세션 확인
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user || session.user.email !== ADMIN_EMAIL) {
        return { success: false, error: 'Admin access required' };
      }

      return { success: true, user: session.user };
    } catch (sessionError) {
      return { success: false, error: 'Authentication failed' };
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인 (임시로 스킵, 실제로는 세션 체크 필요)
    // TODO: 실제 운영시에는 proper auth 체크 구현
    
    const body: CreateGallerySeriesRequest = await request.json();

    // 필수 필드 검증
    if (!body.title || !body.description || !body.client_company) {
      return NextResponse.json({
        error: 'Missing required fields: title, description, client_company'
      }, { status: 400 });
    }

    // 기본값 설정
    const seriesData = {
      title: body.title,
      description: body.description,
      author: body.author || 'GenToon',
      tags: body.tags || [],
      thumbnail_url: body.thumbnail_url || '',
      cover_image_url: body.cover_image_url || '',
      category: body.category || 'advertisement',
      status: 'completed' as const,
      rating: 5.0,
      view_count: 0,
      like_count: 0,
      is_featured: false,
      is_premium: false,
      
      // 외주 프로젝트 필드들
      is_outsourced: true,
      client_company: body.client_company,
      client_brand: body.client_brand || '',
      project_type: body.project_type,
      aspect_ratio: body.aspect_ratio,
      target_platform: body.target_platform,
      display_order: body.display_order || 0,
      is_published: body.is_published || false,
      client_metadata: body.client_metadata || {},
      project_brief: body.project_brief || '',
      
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 데이터베이스에 삽입
    const { data: series, error: insertError } = await supabase
      .from('gallery_series')
      .insert(seriesData)
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json({
        error: 'Failed to create series',
        details: process.env.NODE_ENV === 'development' ? insertError.message : undefined
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      series,
      message: 'Series created successfully'
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : undefined
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // 관리자용 시리즈 목록 조회
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

    const { data: series, error } = await supabase
      .from('gallery_series')
      .select('*')
      .eq('is_outsourced', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({
        error: 'Failed to fetch series',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      series: series || [],
      count: series?.length || 0
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}