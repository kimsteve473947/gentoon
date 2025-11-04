import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Header } from "@/components/layout/header";
import "./globals.css";

// Force dynamic rendering for all pages
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://gentoon.ai'),
  title: {
    default: "젠툰(GenToon) - AI 웹툰 제작 플랫폼 | 인스타툰 만들기",
    template: "%s | 젠툰(GenToon) - AI 웹툰 제작 플랫폼"
  },
  description: "젠툰(GenToon)으로 AI를 활용해 쉽고 빠르게 웹툰을 제작하세요. 캐릭터 일관성 유지, 자동 스토리 생성, 인스타그램 웹툰 최적화. 무료 체험 가능!",
  keywords: [
    // 핵심 키워드
    "젠툰", "GenToon", "젠툰ai", "gentoon.ai",
    // 서비스 관련
    "AI 웹툰", "웹툰 제작", "인스타툰", "웹툰 만들기", "AI 만화",
    "인스타그램 웹툰", "웹툰 생성기", "AI 스토리텔링",
    // 기술 관련
    "인공지능 웹툰", "자동 웹툰 생성", "캐릭터 일관성", "AI 그림",
    "웹툰 템플릿", "말풍선 생성", "웹툰 편집기",
    // 타겟 사용자
    "웹툰 작가", "인스타툰 작가", "웹툰 창작", "개인 창작자",
    "기업 마케팅", "소셜미디어 콘텐츠"
  ],
  authors: [
    { name: "젠툰(GenToon)", url: "https://gentoon.ai" },
    { name: "GenToon Team" }
  ],
  creator: "젠툰(GenToon)",
  publisher: "젠툰(GenToon)",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: "https://gentoon.ai",
    languages: {
      'ko-KR': 'https://gentoon.ai',
      'en-US': 'https://gentoon.ai/en'
    }
  },
  verification: {
    google: 'google-site-verification-code', // 실제 구글 서치 콘솔 코드로 교체 필요
    // 네이버는 head 섹션에서 직접 처리
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' }
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ],
    shortcut: '/favicon.ico'
  },
  manifest: '/site.webmanifest',
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://gentoon.ai",
    siteName: "젠툰(GenToon) - AI 웹툰 제작 플랫폼",
    title: "젠툰(GenToon) - AI로 쉽게 만드는 웹툰 제작 플랫폼",
    description: "젠툰(GenToon)으로 AI를 활용해 쉽고 빠르게 웹툰을 제작하세요. 캐릭터 일관성 유지, 자동 스토리 생성, 인스타그램 웹툰 최적화. 무료 체험 가능!",
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: '젠툰(GenToon) - AI 웹툰 제작 플랫폼',
        type: 'image/png'
      },
      {
        url: '/og-image-square.png',
        width: 1200,
        height: 1200,
        alt: '젠툰(GenToon) 로고',
        type: 'image/png'
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@GenToon_AI',
    creator: '@GenToon_AI',
    title: "젠툰(GenToon) - AI 웹툰 제작 플랫폼",
    description: "AI로 쉽고 빠르게 웹툰을 제작하세요. 캐릭터 일관성 유지, 자동 스토리 생성",
    images: ['/twitter-image.png']
  },
  category: 'Technology',
  classification: 'AI Tool, Creative Software, Webtoon Creator',
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'format-detection': 'telephone=no',
    'mobile-web-app-capable': 'yes'
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={inter.variable}>
      <head>
        {/* 기본 SEO 메타태그 */}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        
        {/* 추가 SEO 메타태그 */}
        <meta name="theme-color" content="#8b5cf6" />
        <meta name="color-scheme" content="light dark" />
        <meta name="referrer" content="origin-when-cross-origin" />
        
        {/* Content Security Policy - 개발 환경에서는 비활성화 */}
        {process.env.NODE_ENV !== 'development' && (
          <meta httpEquiv="Content-Security-Policy" content="default-src 'self' https:; script-src 'self' 'unsafe-eval' 'unsafe-inline' https:; connect-src 'self' https: wss:; img-src 'self' data: https: blob:; style-src 'self' 'unsafe-inline' https:; font-src 'self' https:; frame-src 'self' https:; worker-src 'self' blob:; object-src 'none';" />
        )}
        
        {/* 한국 검색엔진 최적화 */}
        <meta name="subject" content="젠툰(GenToon) - AI 웹툰 제작 플랫폼" />
        <meta name="copyright" content="젠툰(GenToon)" />
        <meta name="language" content="Korean" />
        <meta name="distribution" content="global" />
        <meta name="rating" content="general" />
        
        {/* 네이버 검색엔진 최적화 */}
        <meta name="naver-site-verification" content="07f438a0069e0d0734de8b5de4a3e69ed75b2374" />
        <meta property="naverblog" content="false" />
        
        {/* 다음(카카오) 검색엔진 최적화 */}
        <meta property="daumkakao" content="true" />
        
        {/* 구조화된 데이터 (JSON-LD) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "젠툰(GenToon)",
              "alternateName": ["GenToon", "젠툰ai", "gentoon.ai"],
              "description": "AI를 활용한 웹툰 제작 플랫폼. 캐릭터 일관성 유지, 자동 스토리 생성, 인스타그램 웹툰 최적화",
              "url": "https://gentoon.ai",
              "applicationCategory": "DesignApplication",
              "operatingSystem": "Web Browser",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "KRW",
                "priceValidUntil": "2025-12-31",
                "availability": "https://schema.org/InStock"
              },
              "creator": {
                "@type": "Organization",
                "name": "젠툰(GenToon)",
                "url": "https://gentoon.ai"
              },
              "publisher": {
                "@type": "Organization",
                "name": "젠툰(GenToon)",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://gentoon.ai/logo.png"
                }
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.8",
                "ratingCount": "150",
                "bestRating": "5"
              },
              "featureList": [
                "AI 웹툰 제작",
                "캐릭터 일관성 유지",
                "자동 스토리 생성",
                "인스타그램 최적화",
                "무료 체험"
              ]
            })
          }}
        />
        
        {/* 조직 정보 구조화 데이터 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "젠툰(GenToon)",
              "alternateName": ["GenToon", "젠툰ai"],
              "url": "https://gentoon.ai",
              "logo": "https://gentoon.ai/logo.png",
              "description": "AI 기반 웹툰 제작 플랫폼으로 누구나 쉽게 웹툰을 만들 수 있습니다",
              "foundingDate": "2024",
              "areaServed": {
                "@type": "Country",
                "name": "South Korea"
              },
              "knowsLanguage": ["ko", "en"],
              "sameAs": [
                "https://www.instagram.com/gentoon_ai",
                "https://twitter.com/GenToon_AI"
              ]
            })
          }}
        />
        
        {/* 웹사이트 정보 구조화 데이터 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "젠툰(GenToon)",
              "url": "https://gentoon.ai",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://gentoon.ai/search?q={search_term_string}",
                "query-input": "required name=search_term_string"
              },
              "publisher": {
                "@type": "Organization",
                "name": "젠툰(GenToon)"
              }
            })
          }}
        />
        
        {/* Preconnect 최적화 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="preconnect" href="https://js.tosspayments.com" />
        <link rel="preconnect" href="https://api.tosspayments.com" />
        <link rel="preconnect" href="https://log.tosspayments.com" />
        <link rel="preconnect" href="https://pay.toss.im" />
        
        {/* DNS Prefetch */}
        <link rel="dns-prefetch" href="//cdn.jsdelivr.net" />
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//js.tosspayments.com" />
        <link rel="dns-prefetch" href="//api.tosspayments.com" />
        <link rel="dns-prefetch" href="//log.tosspayments.com" />
        <link rel="dns-prefetch" href="//pay.toss.im" />
        
        {/* Toss Payments SDK - payment-sdk 사용으로 스크립트 태그 제거 */}
      </head>
      <body className="min-h-screen bg-background font-sans antialiased flex flex-col" suppressHydrationWarning>
        <Header />
        <main className="flex-grow">
          {children}
        </main>
      </body>
    </html>
  );
}
