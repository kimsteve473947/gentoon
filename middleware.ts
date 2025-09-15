import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ensureUserExists } from '@/lib/supabase/auto-onboarding'

export async function middleware(request: NextRequest) {
  // Supabase 응답 객체 생성
  let supabaseResponse = NextResponse.next({
    request,
  })

  try {
    // Supabase 클라이언트 생성
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // 사용자 세션 확인
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // 보호된 경로 정의
    const protectedPaths = ['/dashboard', '/studio', '/api/ai', '/api/payments', '/api/subscription']
    const authPaths = ['/sign-in']
    const path = request.nextUrl.pathname

    // 경로 체크
    const isProtected = protectedPaths.some(p => path.startsWith(p))
    const isAuthPath = authPaths.some(p => path.startsWith(p))

    // 보호된 경로에 비로그인 사용자가 접근하는 경우
    if (!user && isProtected) {
      // 개발 모드에서는 API 경로 인증 우회
      if (process.env.NODE_ENV === 'development' && path.startsWith('/api/')) {
        console.log(`Development mode: Bypassing auth for API path: ${path}`);
        return supabaseResponse;
      }
      
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/sign-in'
      return NextResponse.redirect(redirectUrl)
    }

    // 로그인한 사용자가 로그인 페이지에 접근하는 경우
    if (user && isAuthPath) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // 🚀 자동 사용자 온보딩 (로그인 사용자만)
    if (user && isProtected) {
      try {
        await ensureUserExists(user);
      } catch (error) {
        console.warn('자동 온보딩 실패:', error);
        // 온보딩 실패해도 페이지 접근은 허용 (API에서 다시 시도)
      }
    }

    return supabaseResponse
  } catch (error) {
    // 에러 발생 시 기본 응답 반환
    console.error('Middleware error:', error)
    return supabaseResponse
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}