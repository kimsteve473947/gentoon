import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    console.log('🔍 [DB-Check] 데이터베이스 컬럼 구조 확인 시작');
    
    // 프로젝트 테이블 컬럼 확인
    const { data: projectColumns, error: projectError } = await supabase
      .rpc('get_table_columns', { table_name: 'project' });
    
    if (projectError) {
      console.error('❌ [DB-Check] 프로젝트 컬럼 조회 실패:', projectError);
      
      // Raw SQL로 직접 확인해보기
      try {
        const { data: rawColumns, error: rawError } = await supabase
          .from('information_schema.columns')
          .select('column_name, data_type, is_nullable')
          .eq('table_name', 'project')
          .eq('table_schema', 'public');
          
        if (rawError) {
          console.error('❌ [DB-Check] Raw 컬럼 조회도 실패:', rawError);
          // 더 간단한 방법으로 시도
          const { data: simpleCheck, error: simpleError } = await supabase
            .from('project')
            .select()
            .limit(1);
            
          return NextResponse.json({
            success: true,
            message: "컬럼 스키마 조회 실패했지만 프로젝트 데이터 샘플",
            data: {
              sampleProject: simpleCheck,
              error: simpleError,
              projectColumnsError: projectError,
              rawColumnsError: rawError
            }
          });
        } else {
          return NextResponse.json({
            success: true,
            message: "Raw 컬럼 정보 조회 성공",
            data: {
              projectColumns: rawColumns,
              projectColumnsError: projectError
            }
          });
        }
      } catch (innerError) {
        console.error('❌ [DB-Check] 내부 에러:', innerError);
        return NextResponse.json({
          success: false,
          error: "컬럼 조회 중 내부 오류",
          details: innerError
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: "프로젝트 테이블 컬럼 정보",
      data: {
        projectColumns
      }
    });
    
  } catch (error) {
    console.error('💥 [DB-Check] 전체 오류:', error);
    return NextResponse.json({
      success: false,
      error: "DB 컬럼 확인 중 오류 발생",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}