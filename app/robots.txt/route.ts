import { NextResponse } from 'next/server';

export async function GET() {
  const baseUrl = 'https://gentoon.ai';
  
  const robots = `# 젠툰(GenToon) - AI 웹툰 제작 플랫폼
# https://gentoon.ai

User-agent: *
Allow: /

# 핵심 페이지들 명시적 허용
Allow: /
Allow: /studio
Allow: /pricing
Allow: /features
Allow: /about
Allow: /help
Allow: /blog
Allow: /contact

# 사용자 개인정보 및 관리자 페이지 차단
Disallow: /admin
Disallow: /admin-473947
Disallow: /api
Disallow: /dashboard
Disallow: /projects
Disallow: /profile
Disallow: /_next/
Disallow: /auth/

# 특별 검색봇 설정
User-agent: Googlebot
Allow: /
Crawl-delay: 1

User-agent: Bingbot
Allow: /
Crawl-delay: 1

User-agent: NaverBot
Allow: /
Crawl-delay: 1

User-agent: Yeti
Allow: /
Crawl-delay: 1

User-agent: DaumBot
Allow: /
Crawl-delay: 1

# 사이트맵 위치
Sitemap: ${baseUrl}/sitemap.xml

# 호스트 명시 (네이버 최적화)
Host: gentoon.ai
`;

  return new NextResponse(robots, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400' // 24시간 캐시
    }
  });
}