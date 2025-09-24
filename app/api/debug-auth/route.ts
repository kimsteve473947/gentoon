import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    console.log('🔍 Auth Debug 시작...');
    
    // 환경 변수 체크
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    console.log('🔑 환경 변수 체크:');
    console.log(`  SUPABASE_URL: ${supabaseUrl ? '✅ 설정됨' : '❌ 없음'}`);
    console.log(`  SUPABASE_KEY: ${supabaseKey ? '✅ 설정됨' : '❌ 없음'}`);
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        error: 'Supabase 환경 변수가 설정되지 않음',
        supabaseUrl: !!supabaseUrl,
        supabaseKey: !!supabaseKey
      }, { status: 500 });
    }
    
    // Supabase 클라이언트 생성
    const supabase = await createClient();
    console.log('📡 Supabase 클라이언트 생성 완료');
    
    // 인증 상태 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('👤 인증 상태:');
    console.log(`  User: ${user ? '✅ 로그인됨' : '❌ 로그인 안됨'}`);
    console.log(`  Error: ${authError ? authError.message : '없음'}`);
    
    if (user) {
      console.log(`  User ID: ${user.id}`);
      console.log(`  Email: ${user.email}`);
    }
    
    return NextResponse.json({
      environment: process.env.NODE_ENV,
      auth: {
        user: user ? {
          id: user.id,
          email: user.email,
          authenticated: true
        } : null,
        error: authError?.message || null
      },
      config: {
        supabaseUrl: !!supabaseUrl,
        supabaseKey: !!supabaseKey
      }
    });
    
  } catch (error) {
    console.error('❌ Auth Debug 실패:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: process.env.NODE_ENV
    }, { status: 500 });
  }
}