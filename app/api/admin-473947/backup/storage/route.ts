import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isUserAdmin } from '@/lib/auth/api-middleware';

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

    // Mock 스토리지 정보 (실제로는 실제 백업 시스템에서 조회)
    const storageInfo = {
      used: 1024 * 1024 * 250, // 250MB 사용
      total: 1024 * 1024 * 1024 * 10, // 10GB 총 용량
      backupCount: 15 // 총 백업 파일 수
    };

    return NextResponse.json(storageInfo);

  } catch (error) {
    console.error('스토리지 정보 조회 오류:', error);
    return NextResponse.json(
      { error: '스토리지 정보를 불러오는데 실패했습니다' },
      { status: 500 }
    );
  }
}