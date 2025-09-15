# 🔐 Supabase 인증 시스템 완성 가이드

## ✅ 현재 구현 상태

### 완료된 작업:
1. ✅ Supabase 클라이언트 설정 (`/lib/supabase/client.ts`, `/lib/supabase/server.ts`)
2. ✅ 로그인 페이지 (`/app/sign-in/page.tsx`)
3. ✅ OAuth 콜백 핸들러 (`/app/auth/callback/route.ts`)
4. ✅ 미들웨어 인증 체크 (`/middleware.ts`)
5. ✅ 환경 변수 설정 (`.env.local`)
6. ✅ 테스트 페이지 (`/app/test-auth/page.tsx`)
7. ✅ 사용자 메뉴 컴포넌트 (`/components/auth/user-menu.tsx`)
8. ✅ 데이터베이스 스키마 (`/supabase/setup.sql`)

## 🚀 인증 플로우

1. **로그인 시도** → `/sign-in`
2. **OAuth 제공자 선택** → Google 또는 Kakao
3. **Supabase OAuth 리다이렉트** → 제공자 로그인 페이지
4. **콜백 처리** → `/auth/callback`
5. **세션 생성** → 쿠키에 저장
6. **대시보드 리다이렉트** → `/dashboard`

## 📝 Supabase 대시보드 설정

### 1. Google OAuth 설정
1. [Supabase Dashboard](https://app.supabase.com) 접속
2. Authentication > Providers > Google 활성화
3. Site URL 설정: `http://localhost:3002`
4. Redirect URLs에 추가:
   - `http://localhost:3002/auth/callback`
   - `https://lzxkvtwuatsrczhctsxb.supabase.co/auth/v1/callback`

### 2. Kakao OAuth 설정 (커스텀 제공자)
현재 Kakao는 Supabase에서 기본 지원하지 않으므로:
1. Google 로그인으로 대체 중
2. 향후 커스텀 OAuth 구현 가능

### 3. 데이터베이스 설정
SQL Editor에서 `/supabase/setup.sql` 내용 실행:
```sql
-- 파일 내용 전체를 SQL Editor에서 실행
```

## 🧪 테스트 방법

### 1. 기본 테스트
```bash
# 서버 실행
npm run dev

# 브라우저에서 접속
http://localhost:3002/test-auth
```

### 2. 로그인 플로우 테스트
1. http://localhost:3002/sign-in 접속
2. "구글로 시작하기" 클릭
3. Google 계정으로 로그인
4. 자동으로 `/dashboard`로 리다이렉트

### 3. 인증 상태 확인
- 로그인 상태: `/dashboard` 접근 가능
- 비로그인 상태: `/sign-in`으로 자동 리다이렉트

## 🐛 문제 해결

### "Invalid API Key" 오류
- `.env.local` 파일의 키가 올바른지 확인
- 서버 재시작: `npm run dev`

### OAuth 리다이렉트 실패
- Supabase Dashboard > Authentication > URL Configuration 확인
- Site URL: `http://localhost:3002`
- Redirect URLs에 `/auth/callback` 추가

### 로그인 후 대시보드로 이동하지 않음
- 브라우저 콘솔에서 에러 확인
- 네트워크 탭에서 `/auth/callback` 응답 확인

## 📊 현재 API 키 정보

```env
NEXT_PUBLIC_SUPABASE_URL=https://lzxkvtwuatsrczhctsxb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🔍 디버깅 도구

### 1. 테스트 페이지
http://localhost:3002/test-auth
- 연결 상태 확인
- 사용자 정보 표시
- 로그인/로그아웃 테스트

### 2. Supabase Dashboard
- Authentication > Users: 가입된 사용자 목록
- Authentication > Logs: 인증 로그 확인
- SQL Editor: 데이터베이스 쿼리

### 3. 브라우저 개발자 도구
- Console: JavaScript 에러 확인
- Network: API 요청 확인
- Application > Cookies: 세션 쿠키 확인

## 🎯 다음 단계

1. **프로덕션 배포 전**:
   - 프로덕션 URL로 환경 변수 변경
   - Supabase Dashboard에서 프로덕션 URL 추가
   - RLS 정책 재검토

2. **추가 기능**:
   - 이메일 인증
   - 비밀번호 재설정
   - 프로필 수정
   - 소셜 계정 연결

## 📞 지원

문제가 지속되면:
1. Supabase Dashboard > Support 확인
2. 브라우저 콘솔 로그 확인
3. `/test-auth` 페이지에서 상세 디버깅