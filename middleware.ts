import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ensureUserExists } from '@/lib/supabase/auto-onboarding'

// 네이버급 보안 시스템
import { rateLimiter } from '@/lib/security/rate-limiter'
import { ipProtection } from '@/lib/security/ip-protection'
import { 
  getSecurityConfig, 
  isIPWhitelisted, 
  isDevelopmentMode 
} from '@/lib/security/api-security-config'
import { SecureLogger } from '@/lib/utils/secure-logger'

export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  const { pathname } = new URL(request.url);
  const method = request.method;

  // 🛡️ === 1단계: 네이버급 보안 검사 ===
  const securityResult = await performSecurityCheck(request, pathname, method);
  if (!securityResult.allowed) {
    return securityResult.response;
  }

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
    if (user && isProtected) {
      try {
        await ensureUserExists(user);
      } catch (error) {
        SecureLogger.warn('자동 온보딩 실패', error);
        // 온보딩 실패해도 페이지 접근은 허용 (API에서 다시 시도)
      }
    }

    // 🛡️ 보안 헤더 추가
    return addSecurityHeaders(supabaseResponse);
  } catch (error) {
    // 에러 발생 시 기본 응답 반환
    SecureLogger.error('Middleware error', error)
    return addSecurityHeaders(supabaseResponse);
  }
}

// === 네이버급 보안 시스템 구현 ===

/**
 * 통합 보안 검사 수행
 */
async function performSecurityCheck(
  request: NextRequest,
  pathname: string,
  method: string
): Promise<{ allowed: boolean; response?: NextResponse }> {
  
  // 정적 파일 및 Next.js 내부 경로는 패스
  if (shouldSkipSecurity(pathname)) {
    return { allowed: true };
  }

  // 개발 모드 또는 IP 보호 비활성화 시 보안 완화
  if (isDevelopmentMode() && !pathname.startsWith('/api/')) {
    return { allowed: true };
  }

  // IP 보호 시스템 비활성화 체크
  if (process.env.ENABLE_IP_PROTECTION === 'false') {
    return { allowed: true };
  }

  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';
  
  SecureLogger.security(`${method} ${pathname}`, clientIP);

  try {
    // 보안 설정 조회
    const securityConfig = getSecurityConfig(pathname);
    
    // 1. 기본 보안 검사
    const basicCheck = await performBasicSecurityCheck(
      request, 
      clientIP, 
      userAgent, 
      pathname, 
      method
    );
    
    if (!basicCheck.allowed) {
      return { allowed: false, response: createSecurityResponse(basicCheck) };
    }

    // 2. IP 보호 시스템 (API 경로에만 적용)
    if (pathname.startsWith('/api/')) {
      const ipCheck = await ipProtection.analyzeIP(
        clientIP, 
        userAgent, 
        pathname, 
        method
      );
      
      if (!ipCheck.allowed) {
        return { 
          allowed: false, 
          response: createSecurityResponse({
            allowed: false,
            reason: `IP 차단: ${ipCheck.reason}`,
            statusCode: 403,
            blockUntil: ipCheck.blockUntil
          })
        };
      }

      // 3. IP 화이트리스트 확인
      if (!isIPWhitelisted(clientIP, securityConfig?.ipWhitelist)) {
        logSecurityEvent('IP_NOT_WHITELISTED', {
          ip: clientIP,
          path: pathname,
          whitelist: securityConfig?.ipWhitelist
        });
        
        return { 
          allowed: false, 
          response: createSecurityResponse({
            allowed: false,
            reason: '허용되지 않은 IP 주소',
            statusCode: 403
          })
        };
      }

      // 4. HTTP 메소드 검사
      if (securityConfig && !securityConfig.allowedMethods.includes(method)) {
        return { 
          allowed: false, 
          response: createSecurityResponse({
            allowed: false,
            reason: `허용되지 않은 HTTP 메소드: ${method}`,
            statusCode: 405,
            headers: { 'Allow': securityConfig.allowedMethods.join(', ') }
          })
        };
      }

      // 5. Rate Limiting (개발 모드에서는 완화)
      if (!isDevelopmentMode()) {
        const rateLimitCheck = rateLimiter.checkLimit(
          clientIP,
          securityConfig?.securityLevel || 'NORMAL' as any
        );

        if (!rateLimitCheck.allowed) {
          const rateLimitHeaders = {
            'X-RateLimit-Limit': securityConfig?.customRateLimit?.maxRequests?.toString() || '60',
            'X-RateLimit-Remaining': rateLimitCheck.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitCheck.resetTime).toISOString(),
            'Retry-After': rateLimitCheck.blockUntil ? 
              Math.ceil((rateLimitCheck.blockUntil - Date.now()) / 1000).toString() : '60'
          };

          logSecurityEvent('RATE_LIMIT_EXCEEDED', {
            ip: clientIP,
            path: pathname,
            remaining: rateLimitCheck.remaining,
            resetTime: rateLimitCheck.resetTime
          });

          return { 
            allowed: false, 
            response: createSecurityResponse({
              allowed: false,
              reason: 'API 요청 한도 초과',
              statusCode: 429,
              headers: rateLimitHeaders,
              blockUntil: rateLimitCheck.blockUntil
            })
          };
        }
      }
    }

    return { allowed: true };

  } catch (error) {
    SecureLogger.error('보안 검사 오류', error);
    
    logSecurityEvent('SECURITY_CHECK_ERROR', {
      ip: clientIP,
      path: pathname,
      error: error instanceof Error ? error.message : String(error)
    });

    // 오류 발생 시 안전하게 통과 (서비스 중단 방지)
    return { allowed: true };
  }
}

/**
 * 기본 보안 검사
 */
async function performBasicSecurityCheck(
  request: NextRequest,
  ip: string,
  userAgent: string,
  path: string,
  method: string
): Promise<{ allowed: boolean; reason?: string; statusCode?: number }> {
  
  // 악성 경로 패턴 검사
  const maliciousPatterns = [
    /\.\./,           // Path traversal
    /script>/i,       // XSS 시도
    /union.*select/i, // SQL Injection
    /%00/,            // Null byte
    /eval\(/i,        // Code injection
    /<iframe/i        // HTML injection
  ];

  for (const pattern of maliciousPatterns) {
    if (pattern.test(path) || pattern.test(new URL(request.url).search)) {
      logSecurityEvent('MALICIOUS_PATTERN_DETECTED', {
        ip,
        path,
        pattern: pattern.source,
        userAgent
      });
      
      return {
        allowed: false,
        reason: '악성 요청 패턴 탐지',
        statusCode: 400
      };
    }
  }

  // 요청 크기 제한 (10MB)
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
    return {
      allowed: false,
      reason: '요청 크기 초과',
      statusCode: 413
    };
  }

  return { allowed: true };
}

/**
 * 보안 응답 생성
 */
function createSecurityResponse(result: { 
  allowed: boolean; 
  reason?: string; 
  statusCode?: number; 
  headers?: Record<string, string>; 
  blockUntil?: number;
}): NextResponse {
  const response = NextResponse.json(
    {
      success: false,
      error: result.reason || '접근이 거부되었습니다',
      code: 'SECURITY_BLOCK',
      ...(result.blockUntil && {
        blockUntil: new Date(result.blockUntil).toISOString(),
        retryAfter: Math.ceil((result.blockUntil - Date.now()) / 1000)
      })
    },
    { status: result.statusCode || 403 }
  );

  // 추가 헤더 설정
  if (result.headers) {
    Object.entries(result.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return addSecurityHeaders(response);
}

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
  if (isDevelopmentMode()) {
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

/**
 * 보안 검사 제외 경로
 */
function shouldSkipSecurity(pathname: string): boolean {
  const skipPatterns = [
    '/_next/',
    '/favicon.ico', 
    '/robots.txt',
    '/.well-known/',
    '/api/health'
  ];

  return skipPatterns.some(pattern => pathname.startsWith(pattern));
}

/**
 * 보안 이벤트 로깅
 */
function logSecurityEvent(event: string, data: any): void {
  SecureLogger.warn(`[SecurityEvent] ${event}`, {
    timestamp: new Date().toISOString(),
    ...data
  });

  // 실시간 모니터링 시스템에 이벤트 전송
  try {
    const { securityMonitor } = require('./lib/security/security-monitor');
    
    let eventType: any = 'SUSPICIOUS_ACTIVITY';
    let severity: any = 'MEDIUM';

    // 이벤트 타입에 따른 분류
    if (event.includes('MALICIOUS')) {
      eventType = 'MALICIOUS_PATTERN';
      severity = 'HIGH';
    } else if (event.includes('RATE_LIMIT')) {
      eventType = 'RATE_LIMIT_EXCEEDED';
      severity = 'MEDIUM';
    } else if (event.includes('ADMIN')) {
      eventType = 'ADMIN_ACCESS_ATTEMPT';
      severity = 'HIGH';
    } else if (event.includes('WHITELIST')) {
      eventType = 'SECURITY_BYPASS_ATTEMPT';
      severity = 'HIGH';
    }

    securityMonitor.recordEvent(
      eventType,
      severity,
      data.ip || 'unknown',
      data,
      data.path,
      data.userAgent
    );
  } catch (error) {
    console.debug('모니터링 시스템 연동 오류:', error);
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}