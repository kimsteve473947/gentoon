# 🔐 Supabase 인증 시스템 설정 완료

## ✅ 구현 완료 사항

### 1. 인증 시스템 구조
- **Supabase Auth** 기반 소셜 로그인 (Google, Kakao)
- 이메일/비밀번호 로그인 비활성화
- JWT 토큰 기반 세션 관리

### 2. 파일 구조
```
app/
├── sign-in/page.tsx          # 로그인 페이지 (Google, Kakao)
├── auth/callback/route.ts    # OAuth 콜백 핸들러
├── dashboard/page.tsx        # 보호된 대시보드
lib/
├── supabase/
│   ├── client.ts            # 클라이언트 Supabase 인스턴스
│   ├── server.ts            # 서버 Supabase 인스턴스
│   └── auth.ts              # 인증 헬퍼 함수
middleware.ts                 # 라우트 보호 미들웨어
```

### 3. 환경 변수 (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=https://lzxkvtwuatsrczhctsxb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🚀 Supabase 대시보드 설정

### Google OAuth 설정
1. [Supabase Dashboard](https://supabase.com/dashboard/project/lzxkvtwuatsrczhctsxb/auth/providers) 접속
2. **Google** 프로바이더 활성화
3. Google Cloud Console에서 OAuth 2.0 클라이언트 ID 생성
4. 리다이렉트 URI 추가:
   - `https://lzxkvtwuatsrczhctsxb.supabase.co/auth/v1/callback`
5. Client ID와 Secret을 Supabase에 입력

### Kakao OAuth 설정
1. [카카오 개발자](https://developers.kakao.com) 접속
2. 애플리케이션 생성 및 설정
3. **REST API 키** 복사 (Client ID로 사용)
4. **카카오 로그인** 활성화 및 **Client Secret** 생성
5. Redirect URI 추가:
   - `https://lzxkvtwuatsrczhctsxb.supabase.co/auth/v1/callback`
6. 동의 항목 설정:
   - account_email
   - profile_nickname
   - profile_image
7. Supabase Dashboard에서 **Kakao** 프로바이더 활성화
8. Client ID와 Secret 입력

### URL 설정
Authentication > URL Configuration:
- **Site URL**: `http://localhost:3002` (개발) / `https://your-domain.com` (프로덕션)
- **Redirect URLs**:
  - `http://localhost:3002/auth/callback`
  - `https://your-domain.com/auth/callback`

## 🔍 인증 플로우

1. **로그인 시작** (`/sign-in`)
   - Google 또는 Kakao 버튼 클릭
   - `supabase.auth.signInWithOAuth()` 호출

2. **OAuth 리다이렉트**
   - 각 제공자의 로그인 페이지로 이동
   - 사용자 인증 및 권한 동의

3. **콜백 처리** (`/auth/callback`)
   - 인증 코드 수신
   - `exchangeCodeForSession()` 호출
   - 세션 생성 및 쿠키 저장

4. **인증 완료**
   - 대시보드로 리다이렉트
   - 미들웨어가 세션 확인

## 🛡️ 보안 설정

### 미들웨어 보호 경로
```typescript
const protectedPaths = [
  '/dashboard',
  '/studio',
  '/api/ai',
  '/api/payments',
  '/api/subscription'
]
```

### RLS (Row Level Security)
```sql
-- 사용자는 자신의 데이터만 접근 가능
CREATE POLICY "Users can only access own data" ON profiles
  FOR ALL USING (auth.uid() = id);
```

## 🧪 테스트 방법

### 로컬 테스트
```bash
# 개발 서버 실행
npm run dev

# 브라우저에서 접속
http://localhost:3002/sign-in
```

### 인증 플로우 테스트
1. `/sign-in` 페이지 접속
2. Google 또는 Kakao로 로그인
3. 자동으로 `/dashboard`로 리다이렉트 확인
4. 로그아웃 후 보호된 경로 접근 시 로그인 페이지로 리다이렉트 확인

## 🐛 트러블슈팅

### "Invalid API Key" 오류
- `.env.local` 파일의 키 확인
- 서버 재시작

### OAuth 리다이렉트 실패
- Supabase Dashboard의 Redirect URLs 확인
- OAuth 제공자 설정의 콜백 URL 확인

### 카카오 로그인 오류
- 카카오 개발자 콘솔에서 앱 설정 확인
- Client Secret 활성화 상태 확인
- 동의 항목 설정 확인

### 세션 유지 문제
- 브라우저 쿠키 설정 확인
- `supabase.auth.getSession()` 대신 `supabase.auth.getUser()` 사용

## 📝 추가 개발 사항

### 향후 구현 예정
- [ ] 사용자 프로필 페이지
- [ ] 계정 설정 페이지
- [ ] 소셜 계정 연결/해제
- [ ] 회원 탈퇴 기능
- [ ] 이메일 알림 설정

### 프로덕션 배포 전 체크리스트
- [ ] 프로덕션 URL로 환경 변수 변경
- [ ] Supabase Dashboard에 프로덕션 URL 추가
- [ ] OAuth 제공자에 프로덕션 콜백 URL 추가
- [ ] RLS 정책 재검토
- [ ] 에러 로깅 시스템 구축

## 📞 문제 발생 시

1. 브라우저 개발자 도구 콘솔 확인
2. 네트워크 탭에서 API 요청/응답 확인
3. Supabase Dashboard > Authentication > Logs 확인
4. 서버 로그 확인 (`npm run dev` 출력)