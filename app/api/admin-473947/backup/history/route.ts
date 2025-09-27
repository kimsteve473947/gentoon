import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isUserAdmin } from '@/lib/auth/api-middleware';

// Mock 백업 기록 데이터 (실제 구현에서는 데이터베이스에서 조회)
const mockBackups = [
  {
    id: '1',
    type: 'full',
    name: '전체 백업 - 2024년 1월',
    size: 1024 * 1024 * 150, // 150MB
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1일 전
    status: 'completed',
    duration: 1800, // 30분
    description: '월간 정기 백업'
  },
  {
    id: '2',
    type: 'incremental',
    name: '증분 백업 - 일일',
    size: 1024 * 1024 * 25, // 25MB
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2일 전
    status: 'completed',
    duration: 300, // 5분
    description: '일일 자동 백업'
  },
  {
    id: '3',
    type: 'config',
    name: '시스템 설정 백업',
    size: 1024 * 1024 * 5, // 5MB
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1주일 전
    status: 'completed',
    duration: 120, // 2분
    description: '시스템 설정 및 환경변수 백업'
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

    // 백업 기록 반환 (실제로는 데이터베이스에서 조회)
    return NextResponse.json({
      success: true,
      backups: mockBackups
    });

  } catch (error) {
    console.error('백업 기록 조회 오류:', error);
    return NextResponse.json(
      { error: '백업 기록을 불러오는데 실패했습니다' },
      { status: 500 }
    );
  }
}