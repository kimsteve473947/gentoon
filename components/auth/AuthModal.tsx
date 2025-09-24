'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Loader2, X, Sparkles } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { RiKakaoTalkFill } from 'react-icons/ri';
import Link from 'next/link';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectTo?: string;
}

export function AuthModal({ isOpen, onClose, redirectTo = '/projects' }: AuthModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'kakao' | null>(null);
  const [error, setError] = useState('');
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleOAuthLogin = async (provider: 'google' | 'kakao') => {
    try {
      setIsLoading(true);
      setLoadingProvider(provider);
      setError('');

      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
          queryParams: provider === 'google' ? {
            prompt: 'select_account',
            access_type: 'offline'
          } : undefined
        }
      });

      if (error) {
        console.error(`${provider} 로그인 에러:`, error);
        setError('로그인에 실패했습니다. 다시 시도해주세요.');
        setIsLoading(false);
        setLoadingProvider(null);
      }
    } catch (err) {
      console.error('OAuth login error:', err);
      setError('로그인 중 오류가 발생했습니다.');
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  const resetModal = () => {
    setError('');
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open) {
          resetModal();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden border-0" hideCloseButton>
        <DialogTitle className="sr-only">GenToon 로그인</DialogTitle>
        {/* 닫기 버튼 */}
        <button
          onClick={() => {
            resetModal();
            onClose();
          }}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 transition-all hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </button>
        
        <div className="px-8 pt-8 pb-6">
          {/* 로고와 타이틀 */}
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
      </DialogContent>
    </Dialog>
  );
}