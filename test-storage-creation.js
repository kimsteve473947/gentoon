// 🚀 사용자 스토리지 테이블 생성 및 테스트 스크립트
import { createClient } from './lib/supabase/server.js'

async function testStorageTableCreation() {
  try {
    console.log('📊 [Test] 스토리지 테이블 생성 테스트 시작...')
    
    const supabase = await createClient()
    
    // 1. user_storage 테이블 생성
    console.log('🔧 [Test] user_storage 테이블 생성 중...')
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
    `
    
    const { data: createResult, error: createError } = await supabase.rpc('exec_sql', { 
      sql: createTableSQL 
    })
    
    if (createError) {
      console.error('❌ [Test] 테이블 생성 실패:', createError)
      return
    }
    
    console.log('✅ [Test] user_storage 테이블 생성 완료')
    
    // 2. 인덱스 생성
    console.log('🔧 [Test] 인덱스 생성 중...')
    const createIndexSQL = `
      CREATE INDEX IF NOT EXISTS "user_storage_user_id_idx" ON "user_storage"("user_id");
      CREATE INDEX IF NOT EXISTS "user_storage_used_bytes_idx" ON "user_storage"("used_bytes");
    `
    
    const { data: indexResult, error: indexError } = await supabase.rpc('exec_sql', { 
      sql: createIndexSQL 
    })
    
    if (indexError) {
      console.error('❌ [Test] 인덱스 생성 실패:', indexError)
    } else {
      console.log('✅ [Test] 인덱스 생성 완료')
    }
    
    // 3. 테스트 데이터 삽입
    console.log('🔧 [Test] 테스트 데이터 삽입 중...')
    const testUserId = 'test-user-id-' + Date.now()
    
    const { data: insertResult, error: insertError } = await supabase
      .from('user_storage')
      .insert({
        user_id: testUserId,
        used_bytes: 1024 * 1024 * 50, // 50MB
        file_count: 25,
        max_bytes: 1024 * 1024 * 1024 // 1GB
      })
      .select()
      .single()
    
    if (insertError) {
      console.error('❌ [Test] 테스트 데이터 삽입 실패:', insertError)
      return
    }
    
    console.log('✅ [Test] 테스트 데이터 삽입 완료:', insertResult)
    
    // 4. 데이터 조회 테스트
    console.log('🔧 [Test] 데이터 조회 테스트 중...')
    const { data: selectResult, error: selectError } = await supabase
      .from('user_storage')
      .select('*')
      .eq('user_id', testUserId)
      .single()
    
    if (selectError) {
      console.error('❌ [Test] 데이터 조회 실패:', selectError)
      return
    }
    
    console.log('✅ [Test] 데이터 조회 성공:', selectResult)
    
    // 5. 테스트 데이터 정리
    console.log('🔧 [Test] 테스트 데이터 정리 중...')
    const { error: deleteError } = await supabase
      .from('user_storage')
      .delete()
      .eq('user_id', testUserId)
    
    if (deleteError) {
      console.error('❌ [Test] 테스트 데이터 정리 실패:', deleteError)
    } else {
      console.log('✅ [Test] 테스트 데이터 정리 완료')
    }
    
    console.log('🎉 [Test] 모든 테스트 완료!')
    
  } catch (error) {
    console.error('💥 [Test] 치명적 오류:', error)
  }
}

// 스크립트 실행
testStorageTableCreation()