import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { CreateGalleryEpisodeRequest } from '@/types/gallery';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 관리자 전용 이메일
const ADMIN_EMAIL = 'kimjh473947@gmail.com';

interface BulkEpisodeUploadRequest {
  episodes: CreateGalleryEpisodeRequest[];
}

export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인 (임시로 스킵, 실제로는 세션 체크 필요)
    // TODO: 실제 운영시에는 proper auth 체크 구현
    
    const body: BulkEpisodeUploadRequest = await request.json();

    if (!body.episodes || !Array.isArray(body.episodes) || body.episodes.length === 0) {
      return NextResponse.json({
        error: 'Episodes array is required and must not be empty'
      }, { status: 400 });
    }

    // 각 에피소드 검증
    for (const episode of body.episodes) {
      if (!episode.series_id || !episode.title) {
        return NextResponse.json({
          error: 'Each episode must have series_id and title'
        }, { status: 400 });
      }
    }

    // 시리즈 존재 확인
    const seriesId = body.episodes[0].series_id;
    const { data: series, error: seriesError } = await supabase
      .from('gallery_series')
      .select('id, is_outsourced')
      .eq('id', seriesId)
      .single();

    if (seriesError || !series) {
      return NextResponse.json({
        error: 'Series not found'
      }, { status: 404 });
    }

    if (!series.is_outsourced) {
      return NextResponse.json({
        error: 'This endpoint is only for outsourced projects'
      }, { status: 400 });
    }

    // 에피소드 데이터 준비
    const episodesData = body.episodes.map((episode, index) => ({
      series_id: episode.series_id,
      title: episode.title,
      description: episode.description || '',
      episode_number: episode.episode_number || (index + 1),
      thumbnail_url: episode.thumbnail_url || '',
      panels_data: episode.panels_data || [],
      is_premium: false,
      view_count: 0,
      like_count: 0,
      
      // Instagram 최적화 필드들
      instagram_order: episode.instagram_order || (index + 1),
      slide_count: episode.slide_count || 1,
      caption: episode.caption || '',
      hashtags: episode.hashtags || [],
      social_media_optimized: episode.social_media_optimized ?? true,
      call_to_action: episode.call_to_action || '',
      
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // 데이터베이스에 일괄 삽입
    const { data: insertedEpisodes, error: insertError } = await supabase
      .from('gallery_episodes')
      .insert(episodesData)
      .select();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json({
        error: 'Failed to create episodes',
        details: process.env.NODE_ENV === 'development' ? insertError.message : undefined
      }, { status: 500 });
    }

    // 시리즈 업데이트 시간 갱신
    await supabase
      .from('gallery_series')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', seriesId);

    return NextResponse.json({
      success: true,
      episodes: insertedEpisodes || [],
      count: insertedEpisodes?.length || 0,
      message: `${insertedEpisodes?.length || 0} episodes created successfully`
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
    const { searchParams } = new URL(request.url);
    const seriesId = searchParams.get('series_id');
    
    if (!seriesId) {
      return NextResponse.json({
        error: 'series_id parameter is required'
      }, { status: 400 });
    }

    // 해당 시리즈의 에피소드 목록 조회
    const { data: episodes, error } = await supabase
      .from('gallery_episodes')
      .select(`
        *,
        series:gallery_series!inner(
          id,
          title,
          is_outsourced
        )
      `)
      .eq('series_id', seriesId)
      .eq('series.is_outsourced', true)
      .order('episode_number', { ascending: true });

    if (error) {
      return NextResponse.json({
        error: 'Failed to fetch episodes',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      episodes: episodes || [],
      count: episodes?.length || 0
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// 개별 에피소드 업데이트
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { episode_id, ...updateData } = body;

    if (!episode_id) {
      return NextResponse.json({
        error: 'episode_id is required'
      }, { status: 400 });
    }

    // 에피소드 업데이트
    const { data: updatedEpisode, error: updateError } = await supabase
      .from('gallery_episodes')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', episode_id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({
        error: 'Failed to update episode',
        details: process.env.NODE_ENV === 'development' ? updateError.message : undefined
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      episode: updatedEpisode,
      message: 'Episode updated successfully'
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// 에피소드 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const episodeId = searchParams.get('episode_id');

    if (!episodeId) {
      return NextResponse.json({
        error: 'episode_id parameter is required'
      }, { status: 400 });
    }

    // 에피소드 삭제
    const { error: deleteError } = await supabase
      .from('gallery_episodes')
      .delete()
      .eq('id', episodeId);

    if (deleteError) {
      return NextResponse.json({
        error: 'Failed to delete episode',
        details: process.env.NODE_ENV === 'development' ? deleteError.message : undefined
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Episode deleted successfully'
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}