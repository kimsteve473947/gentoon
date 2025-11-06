/**
 * 🔥 SIMPLIFIED MIDDLEWARE FOR VERCEL DEPLOYMENT
 *
 * This minimal middleware avoids Supabase SSR imports that cause
 * "self is not defined" errors during Next.js build on Vercel.
 *
 * Auth checks are moved to page-level and API route-level instead.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request,
  })

  // Add basic security headers only
  addSecurityHeaders(response)

  return response
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  const securityHeaders: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Powered-By': 'GenToon-Security-System',
    'X-Security-Version': '1.0.0'
  }

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
  ].join('; ')

  securityHeaders['Content-Security-Policy'] = cspValue

  // CORS headers (development only)
  if (process.env.NODE_ENV === 'development') {
    securityHeaders['Access-Control-Allow-Origin'] = '*'
    securityHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    securityHeaders['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
  }

  // Apply headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
