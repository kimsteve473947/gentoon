import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 시리즈 정보 조회
    const { data: series, error: seriesError } = await supabase
      .from('gallery_series')
      .select('*')
      .eq('id', id)
      .single();

    if (seriesError || !series) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    // 에피소드 목록 조회
    const { data: episodes, error: episodesError } = await supabase
      .from('gallery_episodes')
      .select('*')
      .eq('series_id', id)
      .order('episode_number', { ascending: true });

    if (episodesError) {
      console.error('Episodes error:', episodesError);
      return NextResponse.json({ error: 'Failed to fetch episodes' }, { status: 500 });
    }

    // 조회수 증가
    await supabase
      .from('gallery_series')
      .update({ view_count: series.view_count + 1 })
      .eq('id', id);

    return NextResponse.json({
      series: {
        ...series,
        view_count: series.view_count + 1,
      },
      episodes: episodes || [],
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}