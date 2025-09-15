# 🎨 GenToon SaaS - AI 기반 웹툰 제작 플랫폼

<div align="center">
  
  [![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8?logo=tailwind-css)](https://tailwindcss.com/)
  [![GenT AI](https://img.shields.io/badge/GenT-1.0-4285F4?logo=google)](https://ai.google.dev/)
  
  **독자적 GenT 1.0 AI로 쉽고 빠르게 웹툰을 제작하는 SaaS 플랫폼**
  
  [데모 보기](https://gentoon-saas.vercel.app) · [문서](./docs) · [이슈 제보](https://github.com/yourusername/gentoon-saas/issues)
</div>

## ✨ 주요 기능

### 🤖 AI 기반 이미지 생성
- **GenT 1.0** 독자적 AI 모델 
- 프롬프트 기반 웹툰 패널 생성
- 캐릭터 일관성 유지 시스템

### 🎭 캐릭터 레퍼런스 시스템
- 최대 5개 캐릭터 동시 관리
- 드래그 앤 드롭 이미지 업로드
- 캐릭터별 스타일 가이드 설정

### 💰 토큰 기반 과금 시스템
- 사용량 기반 공정한 과금
- 실시간 토큰 추적
- 다양한 구독 플랜 (무료/개인/헤비유저/기업)

### 🎨 웹툰 스튜디오
- 직관적인 패널 편집기
- 일괄 생성 기능
- 소셜미디어 최적화 출력

### 💳 통합 결제 시스템
- Toss Payments 연동
- 안전한 구독 관리
- 자동 갱신 및 취소

## 🚀 시작하기

### 필수 요구사항

- Node.js 18.0 이상
- npm 또는 yarn
- Supabase 계정
- GenT AI API 키
- Toss Payments API 키 (선택)

### 설치

1. **리포지토리 클론**
```bash
git clone https://github.com/yourusername/gentoon-saas.git
cd gentoon-saas
```

2. **의존성 설치**
```bash
npm install
# 또는
yarn install
```

3. **환경 변수 설정**
`.env.example`을 `.env.local`로 복사하고 필요한 값을 입력:
```bash
cp .env.example .env.local
```

```env
# GenT AI
GENT_AI_API_KEY=your_gent_ai_api_key

# Supabase
DATABASE_URL=your_database_url
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Toss Payments (선택)
TOSS_CLIENT_KEY=your_toss_client_key
TOSS_SECRET_KEY=your_toss_secret_key
```

4. **데이터베이스 설정**
```bash
npx prisma generate
npx prisma migrate dev
```

5. **개발 서버 실행**
```bash
npm run dev
# 또는
yarn dev
```

http://localhost:3000 에서 애플리케이션을 확인할 수 있습니다.

## 🏗 기술 스택

### Frontend
- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [Shadcn/ui](https://ui.shadcn.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Form Handling**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)

### Backend
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Authentication**: [Clerk](https://clerk.com/) (임시 비활성화)
- **File Storage**: [Vercel Blob](https://vercel.com/storage/blob)

### AI & Payments
- **AI**: GenT 1.0 독자적 AI 모델
- **Payments**: [Toss Payments](https://www.tosspayments.com/)

### DevOps
- **Hosting**: [Vercel](https://vercel.com/)
- **Monitoring**: [Sentry](https://sentry.io/)
- **Analytics**: [Vercel Analytics](https://vercel.com/analytics)

## 📁 프로젝트 구조

```
gentoon-saas/
├── app/                      # Next.js App Router
│   ├── (auth)/              # 인증 관련 페이지
│   ├── (marketing)/         # 랜딩, 가격 페이지
│   ├── dashboard/           # 사용자 대시보드
│   ├── api/                 # API 라우트
│   └── studio/             # 웹툰 제작 스튜디오
├── components/
│   ├── ui/                 # Shadcn 컴포넌트
│   ├── studio/            # 제작 도구 컴포넌트
│   └── dashboard/         # 대시보드 컴포넌트
├── lib/
│   ├── ai/               # AI 서비스 로직
│   ├── db/               # 데이터베이스 유틸
│   ├── payments/         # 결제 로직
│   └── storage/          # 파일 스토리지
├── prisma/
│   └── schema.prisma     # 데이터베이스 스키마
├── hooks/                # Custom React hooks
├── types/               # TypeScript 타입 정의
└── utils/              # 유틸리티 함수
```

## 💰 구독 플랜

| 플랜 | 가격 | 토큰 | 캐릭터 | 프로젝트 |
|------|------|------|--------|----------|
| 무료 | ₩0 | 10/월 | 1개 | 3개 |
| 개인 | ₩30,000/월 | 50만/월 | 3개 | 무제한 |
| 헤비유저 | ₩100,000/월 | 200만/월 | 5개 | 무제한 |
| 기업 | ₩200,000/월 | 500만/월 | 무제한 | 무제한 |

## 🔧 스크립트

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm run start

# 코드 린팅
npm run lint

# Prisma 마이그레이션
npx prisma migrate dev

# Prisma Studio (DB 관리)
npx prisma studio
```

## 🤝 기여하기

기여는 언제나 환영합니다! 다음 단계를 따라주세요:

1. 프로젝트 포크
2. 기능 브랜치 생성 (`git checkout -b feature/AmazingFeature`)
3. 변경사항 커밋 (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치 푸시 (`git push origin feature/AmazingFeature`)
5. Pull Request 오픈

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 👥 팀

- **개발자**: Nano Banana Team

## 📞 문의

- **GitHub Issues**: [https://github.com/yourusername/gentoon-saas/issues](https://github.com/yourusername/gentoon-saas/issues)

## 🙏 감사의 말

- [Next.js](https://nextjs.org/) 팀
- [Vercel](https://vercel.com/) 팀
- GenT AI 개발팀
- [Shadcn](https://ui.shadcn.com/) 커뮤니티

---

<div align="center">
  Made with ❤️ by Nano Banana Team
  
  ⭐ 이 프로젝트가 도움이 되었다면 스타를 눌러주세요!
</div>