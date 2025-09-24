import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const message = searchParams.get('message');

    console.error('결제 수단 등록 실패:', { code, message });

    // 실패 페이지로 리다이렉트
    return NextResponse.redirect(
      new URL(`/settings/subscription?error=registration_failed&message=${encodeURIComponent(message || '결제 수단 등록에 실패했습니다')}`, request.url)
    );

  } catch (error) {
    console.error('결제 수단 등록 실패 처리 오류:', error);
    return NextResponse.redirect(
      new URL('/settings/subscription?error=unknown_error', request.url)
    );
  }
}