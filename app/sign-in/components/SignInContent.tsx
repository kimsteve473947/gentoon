'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { FcGoogle } from 'react-icons/fc'
import { RiKakaoTalkFill } from 'react-icons/ri'
import { useSearchParams } from 'next/navigation'
import { Loader2, Sparkles, X } from 'lucide-react'
import Link from 'next/link'

export default function SignInContent() {
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'kakao' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    // URL 파라미터에서 에러 확인
    const errorParam = searchParams.get('error')
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        'auth_failed': '로그인에 실패했습니다. 다시 시도해주세요.',
        'oauth_error': 'OAuth 인증 중 오류가 발생했습니다.',
        'session_error': '세션 생성에 실패했습니다.',
        'unexpected_error': '예기치 않은 오류가 발생했습니다.',
        'no_code': '인증 코드가 없습니다.',
        'kakao_auth_failed': '카카오 로그인에 실패했습니다.'
      }
      setError(errorMessages[errorParam] || '로그인 중 오류가 발생했습니다.')
    }
  }, [searchParams])

  const handleOAuthLogin = async (provider: 'google' | 'kakao') => {
    try {
      setIsLoading(true)
      setLoadingProvider(provider)
      setError('')

      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent('/projects')}`,
          queryParams: provider === 'google' ? {
            prompt: 'select_account',
            access_type: 'offline'
          } : undefined
        }
      })

      if (error) {
        console.error(`${provider} 로그인 에러:`, error)
        setError('로그인에 실패했습니다. 다시 시도해주세요.')
        setIsLoading(false)
        setLoadingProvider(null)
      }
    } catch (err) {
      console.error('OAuth login error:', err)
      setError('로그인 중 오류가 발생했습니다.')
      setIsLoading(false)
      setLoadingProvider(null)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* 배경 */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
        <div className="absolute inset-0 bg-grid-black/[0.02] bg-[size:20px_20px]" />
      </div>

      {/* 로그인 카드 */}
      <div className="relative z-10 w-full max-w-md">
        <div className="relative overflow-hidden rounded-3xl bg-white/80 p-8 shadow-2xl backdrop-blur-xl">
          {/* 상단 장식 */}
          <div className="absolute -top-1 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600" />
          
          {/* 로고 및 타이틀 */}
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex">
              <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-3">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900">GenToon 로그인</h2>
            <p className="mt-2 text-sm text-gray-600">AI로 쉽고 빠르게 웹툰을 제작하세요</p>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* 로그인 버튼들 */}
          <div className="space-y-4">
            {/* 구글 로그인 */}
            <button
              onClick={() => handleOAuthLogin('google')}
              disabled={isLoading}
              className={`group relative flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-4 text-base font-medium text-gray-800 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                loadingProvider === 'google' ? 'ring-2 ring-purple-500 ring-offset-2' : ''
              }`}
            >
              {loadingProvider === 'google' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                  <span className="text-purple-600">Google 계정 연결 중...</span>
                </>
              ) : (
                <>
                  <FcGoogle className="h-5 w-5" />
                  <span>Google로 로그인</span>
                </>
              )}
            </button>

            {/* 카카오 로그인 */}
            <button
              onClick={() => handleOAuthLogin('kakao')}
              disabled={isLoading}
              className={`group relative flex w-full items-center justify-center gap-3 rounded-xl bg-[#FEE500] px-4 py-4 text-base font-medium text-black shadow-sm transition-all duration-200 hover:bg-[#FDD700] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                loadingProvider === 'kakao' ? 'ring-2 ring-yellow-600 ring-offset-2' : ''
              }`}
            >
              {loadingProvider === 'kakao' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-yellow-800" />
                  <span className="text-yellow-800">카카오 계정 연결 중...</span>
                </>
              ) : (
                <>
                  <RiKakaoTalkFill className="h-5 w-5" />
                  <span>카카오로 로그인</span>
                </>
              )}
            </button>

            {/* 회원가입 및 약관 동의 안내 */}
            <div className="mt-8 text-center">
              <div className="mb-4 flex items-center justify-center text-sm text-gray-500">
                <span className="px-3">아직 회원이 아니신가요?</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                로그인하면 자동으로 회원가입이 완료되며,{' '}
                <Link href="/terms" className="text-purple-600 hover:text-purple-700 underline">
                  이용약관
                </Link>
                {' '}및{' '}
                <Link href="/privacy" className="text-purple-600 hover:text-purple-700 underline">
                  개인정보처리방침
                </Link>
                에 동의하게 됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* 하단 링크 */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm text-gray-600 transition-colors hover:text-purple-600"
          >
            ← 메인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}