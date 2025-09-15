import { NextRequest, NextResponse } from 'next/server';
import { initializeDefaultCharacters } from '@/lib/services/default-character-setup';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 관리자 요청: 기본 캐릭터 초기화 시작');
    
    const characterId = await initializeDefaultCharacters();
    
    return NextResponse.json({
      success: true,
      message: '기본 캐릭터 초기화 완료',
      characterId: characterId
    });
    
  } catch (error) {
    console.error('❌ 기본 캐릭터 초기화 실패:', error);
    
    return NextResponse.json({
      success: false,
      error: '기본 캐릭터 초기화 실패',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: '기본 캐릭터 초기화 API',
    usage: 'POST 요청으로 기본 캐릭터를 생성합니다.'
  });
}