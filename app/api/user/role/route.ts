import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * 사용자 role 조회 API
 * 클라이언트에서 현재 로그인한 사용자의 role을 조회
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 현재 인증된 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ role: null }, { status: 401 });
    }

    // Service role 권한으로 user 테이블에서 role 조회
    const { data: userData, error } = await supabase
      .from('user')
      .select('role')
      .eq('id', user.id)
      .single();

    if (error || !userData) {
      console.error('Error fetching user role:', error);
      return NextResponse.json({ role: null }, { status: 404 });
    }

    return NextResponse.json({ role: userData.role }, { status: 200 });
  } catch (error) {
    console.error('User role API error:', error);
    return NextResponse.json({ role: null }, { status: 500 });
  }
}
