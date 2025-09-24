import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const startTime = Date.now();
  
  try {
    console.log('🔍 Health check 시작...');
    
    // 1. 기본 응답 테스트
    const basicResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    };
    
    // 2. Supabase 연결 테스트
    const supabase = await createClient();
    const connectionTime = Date.now();
    
    console.log(`📡 Supabase 클라이언트 생성: ${connectionTime - startTime}ms`);
    
    // 3. 가장 간단한 쿼리 테스트
    const { data, error } = await supabase
      .from('user')
      .select('id')
      .limit(1);
    
    const queryTime = Date.now();
    console.log(`🔍 간단한 쿼리 완료: ${queryTime - connectionTime}ms`);
    
    if (error) {
      console.error('❌ DB 쿼리 오류:', error);
      return NextResponse.json({
        ...basicResponse,
        database: {
          status: 'error',
          error: error.message,
          connectionTime: connectionTime - startTime,
          queryTime: null
        }
      }, { status: 500 });
    }
    
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ Health check 완료: ${totalTime}ms`);
    
    return NextResponse.json({
      ...basicResponse,
      database: {
        status: 'connected',
        connectionTime: connectionTime - startTime,
        queryTime: queryTime - connectionTime,
        totalTime,
        recordCount: data?.length || 0
      },
      performance: {
        isHealthy: totalTime < 5000, // 5초 이내면 정상
        warning: totalTime > 2000 ? 'Slow response detected' : null
      }
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('❌ Health check 실패:', error);
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      totalTime,
      environment: process.env.NODE_ENV
    }, { status: 500 });
  }
}