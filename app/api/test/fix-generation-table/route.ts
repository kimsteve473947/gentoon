import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 🔧 Generation 테이블 tokensUsed 컬럼 추가 API
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 [Fix] Generation 테이블 tokensUsed 컬럼 추가 시작...');
    
    // 1. 먼저 현재 상태 확인
    console.log('🔍 [Fix] 1. 현재 tokensUsed 컬럼 존재 여부 확인');
    
    // Use service role for administrative operations
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: testData, error: testError } = await supabase
      .from('generation')
      .select('id, tokensUsed')
      .limit(1);
    
    if (!testError) {
      console.log('✅ [Fix] tokensUsed 컬럼이 이미 존재합니다');
      return NextResponse.json({
        success: true,
        message: "tokensUsed 컬럼이 이미 존재합니다",
        action: "none_required",
        sampleData: testData
      });
    }
    
    console.log('❌ [Fix] tokensUsed 컬럼이 없음:', testError.message);
    
    // 2. Supabase RPC를 통해 직접 ALTER TABLE 시도
    console.log('🔧 [Fix] 2. Supabase를 통한 스키마 수정 시도');
    
    try {
      // Try using Supabase RPC to execute SQL
      const { data: sqlResult, error: sqlError } = await supabase
        .rpc('exec_sql', {
          query: 'ALTER TABLE generation ADD COLUMN IF NOT EXISTS "tokensUsed" INTEGER DEFAULT 2;'
        });
      
      if (sqlError) {
        console.log('⚠️ [Fix] RPC 실행 실패, 다른 방법 시도:', sqlError.message);
        
        // Fallback: try using service role direct connection
        const prisma = new PrismaClient({
          datasources: {
            db: {
              url: process.env.DIRECT_URL
            }
          }
        });
        
        try {
          await prisma.$executeRaw`
            ALTER TABLE generation 
            ADD COLUMN IF NOT EXISTS "tokensUsed" INTEGER DEFAULT 2;
          `;
          console.log('✅ [Fix] Prisma를 통한 ALTER TABLE 명령 실행 완료');
        } finally {
          await prisma.$disconnect();
        }
      } else {
        console.log('✅ [Fix] Supabase RPC를 통한 ALTER TABLE 명령 실행 완료');
      }
      
      // 3. 변경 사항 확인
      console.log('🔍 [Fix] 3. 변경 사항 확인');
      const { data: verifyData, error: verifyError } = await supabase
        .from('generation')
        .select('id, tokensUsed')
        .limit(1);
      
      if (verifyError) {
        console.error('❌ [Fix] 확인 실패:', verifyError.message);
        return NextResponse.json({
          success: false,
          message: "컬럼 추가 후 확인 실패",
          error: verifyError.message,
          action: "manual_intervention_needed"
        }, { status: 500 });
      }
      
      console.log('✅ [Fix] tokensUsed 컬럼 추가 성공!');
      
      // 4. 기존 데이터에 기본값 설정 (필요한 경우)
      console.log('🔄 [Fix] 4. 기존 데이터 기본값 설정');
      
      try {
        // Try with Supabase first
        const { error: updateError } = await supabase
          .rpc('exec_sql', {
            query: 'UPDATE generation SET "tokensUsed" = 2 WHERE "tokensUsed" IS NULL;'
          });
        
        if (updateError) {
          // Fallback to Prisma
          const prisma = new PrismaClient({
            datasources: {
              db: {
                url: process.env.DIRECT_URL
              }
            }
          });
          
          try {
            await prisma.$executeRaw`
              UPDATE generation 
              SET "tokensUsed" = 2 
              WHERE "tokensUsed" IS NULL;
            `;
          } finally {
            await prisma.$disconnect();
          }
        }
        
        console.log('✅ [Fix] 기존 데이터 기본값 설정 완료');
      } catch (updateErr) {
        console.log('⚠️ [Fix] 기존 데이터 업데이트 건너뜀:', updateErr);
      }
      
      return NextResponse.json({
        success: true,
        message: "tokensUsed 컬럼이 성공적으로 추가되었습니다",
        action: "column_added",
        verificationData: verifyData
      });
      
    } catch (sqlError: any) {
      console.error('❌ [Fix] 스키마 수정 실패:', sqlError);
      
      return NextResponse.json({
        success: false,
        message: "데이터베이스 스키마 수정 실패",
        error: sqlError.message,
        action: "manual_intervention_needed",
        manualSql: "ALTER TABLE generation ADD COLUMN IF NOT EXISTS \"tokensUsed\" INTEGER DEFAULT 2;"
      }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error('💥 [Fix] 치명적 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: "스키마 수정 중 오류 발생",
      details: error.message,
      action: "manual_intervention_needed",
      manualSql: "ALTER TABLE generation ADD COLUMN IF NOT EXISTS \"tokensUsed\" INTEGER DEFAULT 2;"
    }, { status: 500 });
  }
}

// GET 요청으로 현재 상태만 확인
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [Check] Generation 테이블 tokensUsed 컬럼 상태 확인...');
    
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: testData, error: testError } = await supabase
      .from('generation')
      .select('id, tokensUsed')
      .limit(1);
    
    if (!testError) {
      return NextResponse.json({
        success: true,
        message: "tokensUsed 컬럼이 존재합니다",
        status: "exists",
        sampleData: testData
      });
    } else {
      return NextResponse.json({
        success: false,
        message: "tokensUsed 컬럼이 없습니다",
        status: "missing",
        error: testError.message,
        action: "POST 요청으로 수정 가능"
      });
    }
    
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: "컬럼 상태 확인 중 오류 발생",
      details: error.message
    }, { status: 500 });
  }
}