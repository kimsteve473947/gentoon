import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 🔍 데이터베이스 스키마 확인 API (인증 불필요)
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [Schema] 데이터베이스 스키마 확인 시작...');
    
    const supabase = await createClient();
    
    // 테이블별 컬럼 정보 확인
    const results = {
      user_storage: null,
      subscription: null,
      project: null,
      character: null,
      generation: null,
      errors: []
    };
    
    // 1. user_storage 테이블 확인
    console.log('📊 [Schema] 1. user_storage 테이블 확인');
    try {
      const { data, error } = await supabase
        .from('user_storage')
        .select('*')
        .limit(1);
        
      if (error) {
        console.error('❌ [Schema] user_storage 오류:', error.message);
        results.user_storage = { error: error.message, hint: error.hint };
        results.errors.push(`user_storage: ${error.message}`);
      } else {
        console.log('✅ [Schema] user_storage 접근 성공');
        results.user_storage = { exists: true, sampleData: data };
      }
    } catch (error) {
      results.user_storage = { error: 'Exception: ' + error.message };
      results.errors.push(`user_storage exception: ${error.message}`);
    }
    
    // 2. subscription 테이블 확인
    console.log('📊 [Schema] 2. subscription 테이블 확인');
    try {
      const { data, error } = await supabase
        .from('subscription')
        .select('*')
        .limit(1);
        
      if (error) {
        console.error('❌ [Schema] subscription 오류:', error.message);
        results.subscription = { error: error.message };
        results.errors.push(`subscription: ${error.message}`);
      } else {
        console.log('✅ [Schema] subscription 접근 성공');
        results.subscription = { exists: true, sampleData: data };
      }
    } catch (error) {
      results.subscription = { error: 'Exception: ' + error.message };
      results.errors.push(`subscription exception: ${error.message}`);
    }
    
    // 3. project 테이블 확인
    console.log('📊 [Schema] 3. project 테이블 확인');
    try {
      const { data, error } = await supabase
        .from('project')
        .select('*')
        .limit(1);
        
      if (error) {
        console.error('❌ [Schema] project 오류:', error.message);
        results.project = { error: error.message };
        results.errors.push(`project: ${error.message}`);
      } else {
        console.log('✅ [Schema] project 접근 성공');
        results.project = { exists: true, sampleData: data };
      }
    } catch (error) {
      results.project = { error: 'Exception: ' + error.message };
      results.errors.push(`project exception: ${error.message}`);
    }
    
    // 4. character 테이블 확인
    console.log('📊 [Schema] 4. character 테이블 확인');
    try {
      const { data, error } = await supabase
        .from('character')
        .select('*')
        .limit(1);
        
      if (error) {
        console.error('❌ [Schema] character 오류:', error.message);
        results.character = { error: error.message };
        results.errors.push(`character: ${error.message}`);
      } else {
        console.log('✅ [Schema] character 접근 성공');
        results.character = { exists: true, sampleData: data };
      }
    } catch (error) {
      results.character = { error: 'Exception: ' + error.message };
      results.errors.push(`character exception: ${error.message}`);
    }
    
    // 5. generation 테이블 확인
    console.log('📊 [Schema] 5. generation 테이블 확인');
    try {
      const { data, error } = await supabase
        .from('generation')
        .select('*')
        .limit(1);
        
      if (error) {
        console.error('❌ [Schema] generation 오류:', error.message);
        results.generation = { error: error.message };
        results.errors.push(`generation: ${error.message}`);
      } else {
        console.log('✅ [Schema] generation 접근 성공');
        results.generation = { exists: true, sampleData: data };
      }
    } catch (error) {
      results.generation = { error: 'Exception: ' + error.message };
      results.errors.push(`generation exception: ${error.message}`);
    }
    
    console.log('🎯 [Schema] 스키마 확인 완료');
    
    return NextResponse.json({
      success: true,
      message: "데이터베이스 스키마 확인 완료",
      results,
      summary: {
        totalTables: 5,
        accessibleTables: Object.values(results).filter(r => r && !r.error).length,
        errors: results.errors
      }
    });
    
  } catch (error) {
    console.error('💥 [Schema] 치명적 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: "스키마 확인 중 오류 발생",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}