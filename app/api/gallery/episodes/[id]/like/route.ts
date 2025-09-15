import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body; // 'like' or 'unlike'

    if (!['like', 'unlike'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // 현재 좋아요 수 조회
    const { data: episode, error: fetchError } = await supabase
      .from('gallery_episodes')
      .select('like_count')
      .eq('id', id)
      .single();

    if (fetchError || !episode) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
    }

    // 좋아요 수 업데이트
    const newLikeCount = action === 'like' 
      ? episode.like_count + 1 
      : Math.max(0, episode.like_count - 1);

    const { error: updateError } = await supabase
      .from('gallery_episodes')
      .update({ like_count: newLikeCount })
      .eq('id', id);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update like count' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      like_count: newLikeCount,
      action,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}