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

    // 에피소드 정보 조회 (외주 프로젝트 정보 포함)
    const { data: episode, error: episodeError } = await supabase
      .from('gallery_episodes')
      .select(`
        *,
        series:gallery_series(
          id,
          title,
          author,
          category,
          is_outsourced,
          client_company,
          client_brand,
          project_type,
          aspect_ratio,
          target_platform,
          is_featured,
          is_premium
        )
      `)
      .eq('id', id)
      .single();

    if (episodeError || !episode) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
    }

    // 조회수 증가
    await supabase
      .from('gallery_episodes')
      .update({ view_count: episode.view_count + 1 })
      .eq('id', id);

    return NextResponse.json({
      ...episode,
      view_count: episode.view_count + 1,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}