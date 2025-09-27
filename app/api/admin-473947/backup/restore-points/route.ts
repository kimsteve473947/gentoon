import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isUserAdmin } from '@/lib/auth/api-middleware';

// Mock 복구 포인트 데이터
const mockRestorePoints = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1일 전
    version: 'v2.1.0',
    type: 'automatic',
    size: 1024 * 1024 * 180, // 180MB
    tables_count: 12,
    users_count: 1250
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3일 전
    version: 'v2.0.5',
    type: 'manual',
    size: 1024 * 1024 * 165, // 165MB
    tables_count: 12,
    users_count: 1200
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1주일 전
    version: 'v2.0.0',
    type: 'automatic',
    size: 1024 * 1024 * 150, // 150MB
    tables_count: 11,
    users_count: 1100
  }
];

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // 관리자 권한 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const isAdmin = await isUserAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // 복구 포인트 반환
    return NextResponse.json({
      success: true,
      restorePoints: mockRestorePoints
    });

  } catch (error) {
    console.error('복구 포인트 조회 오류:', error);
    return NextResponse.json(
      { error: '복구 포인트를 불러오는데 실패했습니다' },
      { status: 500 }
    );
  }
}