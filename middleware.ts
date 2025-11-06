// ⚠️ CRITICAL: @supabase/ssr를 상단에서 import하면 Edge Runtime 빌드 에러 발생
// 동적 import로만 사용해야 함
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
// import { ensureUserExists } from '@/lib/supabase/auto-onboarding' // Edge Runtime 비호환 - 비활성화

// 보안 시스템은 동적 import로 처리 (Edge Runtime 호환성)
// import { rateLimiter } from '@/lib/security/rate-limiter'
// import { ipProtection } from '@/lib/security/ip-protection'
// import { getSecurityConfig, isIPWhitelisted, isDevelopmentMode } from '@/lib/security/api-security-config'
// import { SecureLogger } from '@/lib/utils/secure-logger'

export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  const { pathname } = new URL(request.url);
  const method = request.method;

  // 🛡️ === 1단계: 네이버급 보안 검사 ===
  // Edge Runtime 호환성 문제로 일시적으로 비활성화
  // const securityResult = await performSecurityCheck(request, pathname, method);
  // if (!securityResult.allowed) {
  //   return securityResult.response;
  // }

  // Supabase 응답 객체 생성
  let supabaseResponse = NextResponse.next({
    request,
  })

  try {
    // ⚠️ 동적 import로 Supabase 클라이언트 로드 (Edge Runtime 호환)
    const { createServerClient } = await import('@supabase/ssr');

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
    const protectedPaths = ['/dashboard', '/studio', '/projects', '/api/ai', '/api/payments', '/api/subscription', '/api/projects', '/api/storage', '/api/characters']
    const authPaths = ['/sign-in']
    const path = request.nextUrl.pathname

    // 개발 환경에서 테스트 API는 인증 제외
    const testPaths = ['/api/payments/test', '/api/debug']
    const isTestPath = process.env.NODE_ENV === 'development' && testPaths.some(p => path.startsWith(p))

    // 경로 체크
    const isProtected = protectedPaths.some(p => path.startsWith(p)) && !isTestPath
    const isAuthPath = authPaths.some(p => path.startsWith(p))

    // 보호된 경로에 비로그인 사용자가 접근하는 경우
    if (!user && isProtected) {
      // API 경로에서는 JSON 에러 응답 반환
      if (path.startsWith('/api/')) {
        return NextResponse.json(
          { 
            success: false, 
            error: "인증이 필요합니다",
            code: "UNAUTHORIZED" 
          },
          { status: 401 }
        );
      }
      
      // 일반 페이지는 로그인 페이지로 리다이렉트
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/sign-in'
      return NextResponse.redirect(redirectUrl)
    }

    // 로그인한 사용자가 로그인 페이지에 접근하는 경우
    if (user && isAuthPath) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // 🚀 자동 사용자 온보딩 (로그인 사용자만)
    // Edge Runtime 호환성 문제로 일시적으로 비활성화
    // API 레벨에서 처리하도록 변경
    // if (user && isProtected) {
    //   try {
    //     await ensureUserExists(user);
    //   } catch (error) {
    //     console.warn('[Middleware] 자동 온보딩 실패', error);
    //     // 온보딩 실패해도 페이지 접근은 허용 (API에서 다시 시도)
    //   }
    // }

    // 🛡️ 보안 헤더 추가
    return addSecurityHeaders(supabaseResponse);
  } catch (error) {
    // 에러 발생 시 기본 응답 반환
    console.error('[Middleware] Error:', error);
    return addSecurityHeaders(supabaseResponse);
  }
}

// === 네이버급 보안 시스템 구현 ===
// Edge Runtime 호환성 문제로 일시적으로 비활성화
// 보안 시스템 코드 제거됨 (process API 사용으로 인한 Edge Runtime 비호환)

/**
 * 네이버급 보안 헤더 추가
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  // 네이버 수준의 보안 헤더
  const securityHeaders: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Powered-By': 'GenToon-Security-System',
    'X-Security-Version': '1.0.0'
  };

  // CSP (Content Security Policy)
  const cspValue = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.vercel.app https://js.tosspayments.com https://pay.toss.im https://*.tosspayments.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "img-src 'self' data: blob: https://*.supabase.co https://*.vercel-storage.com https://storage.googleapis.com https://*.googleusercontent.com https://*.kakaocdn.net http://*.kakaocdn.net https://k.kakaocdn.net http://k.kakaocdn.net https://mud-kage.kakao.com http://mud-kage.kakao.com",
    "connect-src 'self' https://*.supabase.co https://api.tosspayments.com https://log.tosspayments.com https://js.tosspayments.com https://pay.toss.im https://*.tosspayments.com https://generativelanguage.googleapis.com wss://*.supabase.co",
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "frame-src 'self' https://js.tosspayments.com https://pay.toss.im https://*.tosspayments.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');

  securityHeaders['Content-Security-Policy'] = cspValue;

  // CORS 헤더 (개발 환경에서만 관대하게)
  if (process.env.NODE_ENV === 'development') {
    securityHeaders['Access-Control-Allow-Origin'] = '*';
    securityHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    securityHeaders['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
  }

  // 헤더 적용
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * 클라이언트 IP 추출
 */
function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const clientIP = request.headers.get('x-client-ip');

  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  if (realIP) return realIP;
  if (clientIP) return clientIP;

  return '127.0.0.1';
}

// 보안 관련 함수들 제거됨 (Edge Runtime 비호환)

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}