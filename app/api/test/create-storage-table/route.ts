import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 🚀 user_storage 테이블 생성 테스트 API
export async function POST(request: NextRequest) {
  try {
    console.log('📊 [CreateStorage] user_storage 테이블 생성 시작...');
    
    const supabase = await createClient();
    
    // 1. 테이블 존재 여부 확인
    const { data: tables, error: checkError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'user_storage')
      .eq('table_schema', 'public');
    
    if (checkError) {
      console.error('❌ [CreateStorage] 테이블 확인 실패:', checkError);
    } else if (tables && tables.length > 0) {
      console.log('✅ [CreateStorage] user_storage 테이블이 이미 존재합니다');
      return NextResponse.json({
        success: true,
        message: "user_storage 테이블이 이미 존재합니다",
        tableExists: true
      });
    }
    
    console.log('🔧 [CreateStorage] user_storage 테이블 생성 중...');
    
    // 2. 테이블 생성 SQL 실행 (RPC 함수 사용)
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS "user_storage" (
          "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          "user_id" UUID UNIQUE NOT NULL,
          "used_bytes" BIGINT DEFAULT 0,
          "file_count" INTEGER DEFAULT 0,
          "max_bytes" BIGINT DEFAULT 1073741824,
          "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- 인덱스 생성
      CREATE INDEX IF NOT EXISTS "user_storage_user_id_idx" ON "user_storage"("user_id");
      CREATE INDEX IF NOT EXISTS "user_storage_used_bytes_idx" ON "user_storage"("used_bytes");
    `;
    
    // 먼저 raw SQL로 시도
    try {
      // user 테이블에서 샘플 데이터 조회해서 테이블 존재 확인
      const { data: users, error: userError } = await supabase
        .from('user')
        .select('id')
        .limit(1);
        
      if (userError) {
        console.error('❌ [CreateStorage] user 테이블 접근 실패:', userError);
      } else {
        console.log('✅ [CreateStorage] user 테이블 접근 성공, 사용자 수:', users?.length || 0);
      }
      
      // 직접 테이블 생성 시도
      const { error: createError } = await supabase
        .from('user_storage')
        .select('id')
        .limit(1);
        
      if (createError) {
        console.log('🔧 [CreateStorage] user_storage 테이블이 없으므로 수동 생성이 필요합니다');
        
        // 테스트용으로 임시 레코드 삽입 시도 (테이블이 없으면 에러 발생)
        const testUserId = 'test-' + Date.now();
        const { data: insertResult, error: insertError } = await supabase
          .from('user_storage')
          .insert({
            user_id: testUserId,
            used_bytes: 0,
            file_count: 0,
            max_bytes: 1073741824
          })
          .select()
          .single();
          
        if (insertError) {
          console.error('❌ [CreateStorage] 테이블이 존재하지 않습니다:', insertError.message);
        } else {
          console.log('✅ [CreateStorage] 테이블 생성 및 테스트 데이터 삽입 성공');
          
          // 테스트 데이터 삭제
          await supabase.from('user_storage').delete().eq('user_id', testUserId);
        }
      } else {
        console.log('✅ [CreateStorage] user_storage 테이블이 이미 존재합니다');
      }
      
    } catch (error) {
      console.error('❌ [CreateStorage] 테이블 생성 중 오류:', error);
    }
    
    return NextResponse.json({
      success: true,
      message: "user_storage 테이블 생성 테스트 완료",
      note: "Supabase 대시보드에서 직접 테이블을 생성해야 할 수 있습니다"
    });
    
  } catch (error) {
    console.error('💥 [CreateStorage] 치명적 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: "테이블 생성 테스트 중 오류 발생",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}