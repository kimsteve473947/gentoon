import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Sparkles, Zap, Shield, Star, Users, Check, Wand2, Image, MessageSquare, Download, Palette, Bot } from "lucide-react";

export const metadata: Metadata = {
  title: "젠툰(GenToon) 기능 소개 - AI 웹툰 제작의 모든 것",
  description: "젠툰(GenToon)의 강력한 AI 웹툰 제작 기능들을 확인하세요. 캐릭터 일관성 유지, 자동 스토리 생성, 인스타그램 최적화, 무료 템플릿 제공",
  keywords: [
    "젠툰 기능", "GenToon 기능", "AI 웹툰 제작 기능", "웹툰 편집기",
    "캐릭터 일관성", "자동 스토리 생성", "말풍선 템플릿", "인스타툰 제작",
    "웹툰 템플릿", "AI 그림 생성", "웹툰 자동화", "소셜미디어 최적화"
  ],
  openGraph: {
    title: "젠툰(GenToon) 기능 소개 - AI 웹툰 제작의 모든 것",
    description: "젠툰(GenToon)의 강력한 AI 웹툰 제작 기능들을 확인하세요. 캐릭터 일관성 유지, 자동 스토리 생성, 인스타그램 최적화",
    url: "https://gentoon.ai/features",
  },
};

export default function FeaturesPage() {
  const features = [
    {
      icon: <Wand2 className="h-8 w-8" />,
      title: "AI 자동 웹툰 생성",
      description: "고급 AI 기술로 몇 분 만에 전문적인 웹툰을 자동 생성합니다.",
      details: [
        "Google Vertex AI 기반 고품질 이미지 생성",
        "자연스러운 한국어 스토리 자동 생성",
        "장면별 캐릭터 자동 배치 및 선택",
        "감정 표현 및 동작 자동 조절"
      ]
    },
    {
      icon: <Users className="h-8 w-8" />,
      title: "캐릭터 일관성 유지",
      description: "등장인물의 외모와 스타일을 일관되게 유지하여 전문적인 웹툰을 제작합니다.",
      details: [
        "비율별 캐릭터 레퍼런스 이미지 지원 (1:1, 4:5)",
        "캐릭터별 고유 특징 자동 보존",
        "멀티 캐릭터 동시 관리 (플랜별 2-20개)",
        "캐릭터 감정 및 포즈 변화 자동 적용"
      ]
    },
    {
      icon: <MessageSquare className="h-8 w-8" />,
      title: "스마트 말풍선 시스템",
      description: "12가지 동적 SVG 말풍선 템플릿으로 다양한 감정과 상황을 표현합니다.",
      details: [
        "12가지 전문 디자인 말풍선 템플릿",
        "텍스트 길이에 따른 자동 크기 조절",
        "감정별 말풍선 스타일 자동 추천",
        "드래그 앤 드롭으로 쉬운 편집"
      ]
    },
    {
      icon: <Palette className="h-8 w-8" />,
      title: "인스타그램 최적화",
      description: "인스타그램 피드에 완벽하게 맞는 1:1, 4:5 비율로 웹툰을 제작합니다.",
      details: [
        "인스타그램 표준 비율 (1:1, 4:5) 지원",
        "모바일 환경 최적화된 UI/UX",
        "소셜 미디어 공유 원클릭 기능",
        "해시태그 자동 생성 및 추천"
      ]
    },
    {
      icon: <Bot className="h-8 w-8" />,
      title: "AI 스토리 생성",
      description: "창의적이고 흥미로운 웹툰 스토리를 AI가 자동으로 생성해드립니다.",
      details: [
        "장르별 맞춤 스토리 생성 (로맨스, 코미디, 드라마 등)",
        "캐릭터 성격에 맞는 대화 자동 생성",
        "한국어 자연어 처리 기술 적용",
        "스토리 길이 및 분위기 조절 가능"
      ]
    },
    {
      icon: <Download className="h-8 w-8" />,
      title: "다양한 내보내기 옵션",
      description: "완성된 웹툰을 다양한 형태로 내보내어 어디서든 사용할 수 있습니다.",
      details: [
        "고해상도 PNG/JPG 이미지 다운로드",
        "인스타그램 직접 공유 기능",
        "PDF 형태 웹툰집 생성",
        "워터마크 제거 옵션 (유료 플랜)"
      ]
    }
  ];

  const planFeatures = [
    {
      plan: "무료",
      price: "₩0",
      features: [
        "월 8장 이미지 생성",
        "캐릭터 2개 등록",
        "요소 2개 등록",
        "300MB 스토리지",
        "기본 템플릿 사용"
      ]
    },
    {
      plan: "스타터",
      price: "₩29,000",
      features: [
        "월 270장 이미지 생성",
        "캐릭터 5개 등록",
        "요소 5개 등록",
        "3GB 스토리지",
        "개인 작업에 적합"
      ]
    },
    {
      plan: "프로",
      price: "₩59,000",
      features: [
        "월 540장 이미지 생성",
        "캐릭터 10개 등록",
        "요소 10개 등록",
        "8GB 스토리지",
        "기업 실무자에게 적합"
      ]
    },
    {
      plan: "프리미엄",
      price: "₩99,000",
      features: [
        "월 930장 이미지 생성",
        "캐릭터 20개 등록",
        "요소 20개 등록",
        "20GB 스토리지",
        "전문 제작자에게 적합"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      {/* 헤더 섹션 */}
      <section className="container mx-auto px-4 pt-20 pb-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-6">
            젠툰(GenToon) 
            <br />AI 웹툰 제작 기능
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            최첨단 AI 기술로 누구나 쉽게 전문적인 웹툰을 제작할 수 있습니다. 
            <br />캐릭터 일관성부터 스토리 생성까지, 모든 것이 자동화되어 있습니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
              <Link href="/studio" className="flex items-center">
                무료로 시작하기
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline">
              <Link href="/pricing">
                요금제 보기
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 핵심 기능 섹션 */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            젠툰의 강력한 AI 기능들
          </h2>
          <p className="text-xl text-gray-600">
            전문 웹툰 작가 수준의 퀄리티를 AI로 구현합니다
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center justify-center text-white mb-4">
                  {feature.icon}
                </div>
                <CardTitle className="text-xl font-bold">{feature.title}</CardTitle>
                <CardDescription className="text-gray-600">
                  {feature.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {feature.details.map((detail, detailIndex) => (
                    <li key={detailIndex} className="flex items-start">
                      <Check className="h-4 w-4 text-green-500 mt-1 mr-2 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{detail}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 요금제 비교 섹션 */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            플랜별 기능 비교
          </h2>
          <p className="text-xl text-gray-600">
            필요에 맞는 플랜을 선택하여 젠툰의 모든 기능을 활용하세요
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {planFeatures.map((plan, index) => (
            <Card key={index} className={`border-2 ${index === 1 ? 'border-purple-600 shadow-lg scale-105' : 'border-gray-200'} hover:shadow-xl transition-all duration-300`}>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold text-gray-900">{plan.plan}</CardTitle>
                <div className="text-3xl font-bold text-purple-600">{plan.price}</div>
                {plan.price !== "₩0" && (
                  <p className="text-sm text-gray-500">월 구독</p>
                )}
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center">
                      <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  className={`w-full mt-6 ${index === 1 ? 'bg-gradient-to-r from-purple-600 to-pink-600' : ''}`}
                  variant={index === 1 ? "default" : "outline"}
                >
                  <Link href={plan.price === "₩0" ? "/studio" : "/pricing"}>
                    {plan.price === "₩0" ? "무료 시작" : "선택하기"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-8 md:p-16 text-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            지금 바로 젠툰으로 웹툰 제작을 시작하세요!
          </h2>
          <p className="text-xl mb-8 opacity-90">
            무료 체험으로 AI 웹툰 제작의 놀라운 경험을 해보세요
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="bg-white text-purple-600 hover:bg-gray-100">
              <Link href="/studio" className="flex items-center">
                무료로 시작하기
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-purple-600">
              <Link href="/contact">
                문의하기
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}