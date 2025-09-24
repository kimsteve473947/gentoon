import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: generationId } = await params;
    
    if (!generationId) {
      return NextResponse.json(
        { success: false, error: "Generation ID is required" },
        { status: 400 }
      );
    }

    // 서버 사이드에서 service_role로 RLS 우회하여 접근
    const supabase = await createClient();
    
    const { data: generation, error } = await supabase
      .from('generation')
      .select('id, imageUrl, thumbnailUrl, tokensUsed, createdAt')
      .eq('id', generationId)
      .maybeSingle(); // single() 대신 maybeSingle() 사용으로 에러 방지

    if (error) {
      console.error('Generation query error:', error);
      return NextResponse.json(
        { success: false, error: "Database error" },
        { status: 500 }
      );
    }

    if (!generation) {
      return NextResponse.json(
        { success: false, error: "Generation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      generation
    });

  } catch (error) {
    console.error('Generation API error:', error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}