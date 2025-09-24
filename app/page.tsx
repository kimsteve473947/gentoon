'use client'

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, Zap, Shield, Star, Users, Check, Coins, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthModal } from "@/components/auth/AuthModal";
import Footer from "@/components/Footer";
import { createBrowserClient } from '@supabase/ssr';

export default function Home() {
  const router = useRouter();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null); // null = loading
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    // 초기 로그인 상태 체크
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
    };

    checkUser();

    // 로그인 상태 변화 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleStartClick = () => {
    if (isLoggedIn) {
      // 이미 로그인된 경우 바로 스튜디오로
      router.push('/studio');
    } else {
      // 로그인 모달 띄우기
      setIsAuthModalOpen(true);
    }
  };
  return (
    <div className="flex flex-col min-h-screen">

      {/* 히어로 섹션 */}
      <section className="relative flex-1 flex items-center justify-center py-20 overflow-hidden">
        {/* 배경 그라데이션 */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 opacity-50" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        
        <div className="container relative mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-100 to-pink-100 px-4 py-1.5 text-sm font-medium mb-8 border border-purple-200">
              <Sparkles className="mr-2 h-4 w-4 text-purple-600" />
              <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-semibold">
                GenT 1.0으로 더 빠르고 정확하게
              </span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              300만원 디자이너는 이제 그만!
              <br />
              <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                무료 AI 디자이너를 고용하세요
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              <strong>마케팅팀:</strong> 인스타 홍보 콘텐츠를 아이디어와 기획만으로 완성하세요<br />
              <strong>개인 창작자:</strong> 당신도 오늘부터 웹툰 작가가 될 수 있습니다
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center mb-12 max-w-2xl mx-auto">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-xl font-semibold px-12 py-6 h-16 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] flex-1"
                onClick={handleStartClick}
                disabled={isLoggedIn === null} // 로딩 중일 때 비활성화
              >
                {isLoggedIn === null ? (
                  "로딩 중..."
                ) : isLoggedIn ? (
                  "제작 스튜디오 열기"
                ) : (
                  "바로 시작하기"
                )}
                <ArrowRight className="ml-3 h-6 w-6" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                asChild 
                className="text-xl font-semibold px-12 py-6 h-16 rounded-2xl border-2 border-purple-200 hover:border-purple-300 hover:bg-purple-50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] flex-1"
              >
                <Link href="/gallery">
                  갤러리 보기
                  <ChevronRight className="ml-3 h-6 w-6" />
                </Link>
              </Button>
            </div>
            
            <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span>비용 97% 절감</span>
              </div>
              <div className="flex items-center gap-1">
                <Coins className="h-4 w-4" />
                <span>5분만에 완성</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* B2B/B2C 가치 제안 섹션 */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              이제 그만 비싼 외주비에 울지 마세요
            </h2>
            <p className="text-muted-foreground text-lg">
              마케팅팀과 개인 창작자 모두를 위한 GenToon AI 솔루션
            </p>
          </div>
          
          {/* B2B/B2C 타겟 섹션 */}
          <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* B2B 섹션 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-purple-100">
              <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <Users className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-gray-900">기업 마케팅팀을 위한</h3>
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-gray-700"><strong>월 300만원</strong> 디자이너 인건비</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-gray-700">콘텐츠 1개당 <strong>2-3일</strong> 소요</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-gray-700">수정 요청할 때마다 <strong>추가 비용</strong></p>
                </div>
              </div>
              <div className="border-t pt-6">
                <h4 className="font-bold text-purple-600 mb-3">✨ GenToon으로 해결</h4>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">• 월 3만원으로 무제한 콘텐츠</p>
                  <p className="text-sm text-gray-600">• 아이디어만 있으면 5분 완성</p>
                  <p className="text-sm text-gray-600">• 무제한 수정 가능</p>
                </div>
              </div>
            </div>

            {/* B2C 섹션 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-pink-100">
              <div className="bg-gradient-to-r from-pink-100 to-purple-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <Sparkles className="h-8 w-8 text-pink-600" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-gray-900">개인 창작자를 위한</h3>
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-gray-700">그림 못 그려서 <strong>포기한 웹툰 꿈</strong></p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-gray-700">아이디어는 있는데 <strong>표현할 방법이 없음</strong></p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-gray-700">디자인 툴 배우기엔 <strong>너무 복잡</strong></p>
                </div>
              </div>
              <div className="border-t pt-6">
                <h4 className="font-bold text-pink-600 mb-3">🎨 당신도 웹툰 작가가 되세요</h4>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">• 스토리만 있으면 웹툰 완성</p>
                  <p className="text-sm text-gray-600">• 캐릭터 일관성 자동 유지</p>
                  <p className="text-sm text-gray-600">• 디자인 실력 불필요</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-center mt-12">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-lg px-12 py-6 rounded-full shadow-xl"
              onClick={handleStartClick}
            >
              💰 97% 비용 절감하고 시작하기
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* 특징 섹션 */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">
            기존 방식 vs GenToon
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            더 이상 비싼 외주비와 복잡한 툴에 시간과 돈을 낭비하지 마세요
          </p>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="flex flex-col items-center text-center">
              <div className="rounded-full bg-green-100 p-3 mb-4">
                <Sparkles className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">💰 비용 97% 절감</h3>
              <p className="text-muted-foreground">
                <span className="line-through text-red-500">월 300만원 디자이너</span> → <span className="text-green-600 font-bold">월 3만원</span><br />
                캐릭터 일관성까지 자동으로 유지됩니다
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="rounded-full bg-blue-100 p-3 mb-4">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">⚡ 시간 95% 단축</h3>
              <p className="text-muted-foreground">
                <span className="line-through text-red-500">2-3일 작업</span> → <span className="text-blue-600 font-bold">5분 완성</span><br />
                아이디어만 있으면 바로 웹툰이 완성됩니다
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="rounded-full bg-purple-100 p-3 mb-4">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">🎨 디자인 실력 불필요</h3>
              <p className="text-muted-foreground">
                <span className="line-through text-red-500">복잡한 툴 학습</span> → <span className="text-purple-600 font-bold">텍스트만 입력</span><br />
                누구나 전문가급 웹툰을 만들 수 있습니다
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 가격 섹션 */}
      <section className="py-20" id="pricing">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">
            🎨 AI 디자이너 고용 비용표
          </h2>
          <p className="text-center text-muted-foreground mb-4">
            <span className="line-through text-red-500">월 300만원 디자이너</span> → <span className="text-green-600 font-bold text-lg">이미지당 단돈 77원</span>
          </p>
          <p className="text-center text-muted-foreground mb-12">
            생성형 AI 기술로 전문가급 퀄리티를 합리적인 가격에
          </p>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/pricing')}>
              <CardHeader>
                <CardTitle>무료 AI 디자이너</CardTitle>
                <CardDescription>🎨 서비스 체험용 - 실력 검증해보세요</CardDescription>
                <div className="text-3xl font-bold mt-4">₩0</div>
                <div className="text-sm text-muted-foreground">이미지 생성 무료 제공</div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">무료 체험용</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">캐릭터 1개 등록</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">무료 AI 디자이너</span>
                  </li>
                </ul>
                <Button 
                  className="w-full mt-6 rounded-full" 
                  variant="outline" 
                  onClick={handleStartClick}
                  disabled={isLoggedIn === null}
                >
                  {isLoggedIn === null ? "로딩 중..." : isLoggedIn ? "제작 스튜디오 열기" : "🎨 무료 AI 디자이너 고용"}
                </Button>
              </CardContent>
            </Card>
            
            <Card className="border-purple-500 relative cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/pricing')}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs px-3 py-1 rounded-full">
                👑 97% 절약
              </div>
              <CardHeader>
                <CardTitle>프로 AI 디자이너</CardTitle>
                <CardDescription>💼 이미지당 77원 - 마케팅팀 최고 선택</CardDescription>
                <div className="text-3xl font-bold mt-4">₩30,000<span className="text-base font-normal">/월</span></div>
                <div className="text-sm text-green-600 font-semibold">월 3만원으로 AI 디자이너 고용</div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">인스타툰 30~40편 생성</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">캐릭터 3개 등록</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">5GB 파일 저장 공간</span>
                  </li>
                </ul>
                <Button className="w-full mt-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-full" asChild>
                  <Link href="/sign-in">💼 프로 AI 디자이너 고용</Link>
                </Button>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/pricing')}>
              <CardHeader>
                <CardTitle>엔터프라이즈 AI 팀</CardTitle>
                <CardDescription>🏢 이미지당 65원 - 하드유저 최고 선택</CardDescription>
                <div className="text-3xl font-bold mt-4">₩100,000<span className="text-base font-normal">/월</span></div>
                <div className="text-sm text-green-600 font-semibold">월 10만원으로 AI 디자인팀 고용</div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">인스타툰 120~160편 생성</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">캐릭터 5개 등록</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">20GB 파일 저장 공간</span>
                  </li>
                </ul>
                <Button className="w-full mt-6 rounded-full" variant="outline" asChild>
                  <Link href="/sign-in">🏢 AI 디자이너팀 구성</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      
      {/* CTA 섹션 */}
      <section className="py-20 bg-gradient-to-r from-purple-600 to-pink-600">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4 text-white">
            🎨 무료 AI 디자이너 vs 300만원 디자이너
          </h2>
          <p className="text-xl text-white/90 mb-2">
            <strong>마케팅팀:</strong> 24시간 일하는 AI 디자이너를 무료로 고용하세요
          </p>
          <p className="text-xl text-white/90 mb-8">
            <strong>개인 창작자:</strong> 재능 넘치는 AI 디자이너가 당신의 아이디어를 웹툰으로
          </p>

          <Button 
            size="lg" 
            variant="secondary" 
            className="rounded-full px-12 py-6 text-lg font-bold shadow-2xl hover:scale-105 transition-transform"
            onClick={handleStartClick}
            disabled={isLoggedIn === null}
          >
            {isLoggedIn === null ? "로딩 중..." : isLoggedIn ? "🎨 AI 디자이너와 작업하기" : "🎨 무료 AI 디자이너 고용하기"}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      <Footer />

      {/* 로그인 모달 - 로그인 안된 사용자에게만 표시 */}
      {!isLoggedIn && (
        <AuthModal 
          isOpen={isAuthModalOpen} 
          onClose={() => setIsAuthModalOpen(false)}
          redirectTo="/studio"
        />
      )}
    </div>
  );
}