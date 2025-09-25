# Vercel 배포 가이드

## 🚀 배포 준비 완료 상태

현재 프로젝트는 **코드 수정 없이** Vercel에 바로 배포 가능합니다.

## 📋 필수 환경변수 설정

Vercel 대시보드에서 다음 환경변수들을 설정해주세요:

### 🔐 AI & Google Cloud
```
GOOGLE_AI_API_KEY=AQ.Ab8RN6JQGT9k4VGVixzY4JUhxnSQ9IA-nQup6ez9Tpfh5lzoCw
GOOGLE_CLOUD_PROJECT_ID=instatoon-471416
GOOGLE_CLOUD_LOCATION=global
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account","project_id":"instatoon-471416"...}
```

### 🗄️ Supabase
```
NEXT_PUBLIC_SUPABASE_URL=https://lzxkvtwuatsrczhctsxb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 💳 Toss Payments
```
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_Poxy1XQL8RJo12Y4P0eN87nO5Wml
TOSS_SECRET_KEY=test_sk_XZYkKL4MrjBP5P6aMPpAr0zJwlEW
TOSS_WEBHOOK_SECRET=be106b79b09a5ef91b069639164018012ce5090fde964be775de08c1370d920b
```

### 🌐 App Configuration
```
NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
NEXT_PUBLIC_ADMIN_EMAIL=kimjh473947@gmail.com
ADMIN_EMAIL=kimjh473947@gmail.com
```

### 🛡️ Security (선택사항)
```
ENABLE_IP_PROTECTION=false
CRON_SECRET=your-cron-secret
ADMIN_SECRET=your-admin-secret
```

## 🔧 배포 단계

### 1. GitHub 연결
```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

### 2. Vercel 프로젝트 생성
1. [Vercel 대시보드](https://vercel.com) 접속
2. "New Project" 클릭
3. GitHub 저장소 선택
4. 프로젝트 설정:
   - **Framework Preset**: Next.js
   - **Root Directory**: ./ (기본값)
   - **Build Command**: npm run build (자동 감지)
   - **Output Directory**: .next (자동 감지)

### 3. 환경변수 설정
1. 프로젝트 → Settings → Environment Variables
2. 위의 모든 환경변수를 Production/Preview/Development 환경에 추가

### 4. 도메인 설정
1. Settings → Domains
2. `gentoon.ai` 커스텀 도메인 연결

## ✅ 배포 후 확인사항

- [ ] AI 이미지 생성 정상 작동
- [ ] Supabase 데이터베이스 연결
- [ ] Toss 결제 시스템 작동
- [ ] 파일 업로드/다운로드 기능
- [ ] 사용자 인증 및 권한 관리

## 🚨 주의사항

### Vertex AI 인증
- 로컬: 파일 경로 방식 (`vertex-ai-key.json`)
- Vercel: 환경변수 방식 (`GOOGLE_APPLICATION_CREDENTIALS_JSON`)
- **코드 수정 불필요** - 자동으로 환경 감지

### Edge Functions 호환성
- 모든 API 라우트가 Vercel Edge Functions와 호환됩니다
- Canvas 및 Sharp 라이브러리 정상 작동 확인됨

### 메모리 한도
- Vercel Pro 플랜 권장 (Hobby 플랜은 메모리 제한으로 AI 생성 실패 가능)

## 🔄 자동 배포 설정

`vercel.json`에 cron job이 이미 설정되어 있습니다:
```json
{
  "crons": [
    {
      "path": "/api/cron/reset-tokens",
      "schedule": "0 2 * * *"
    }
  ]
}
```

## 📞 배포 후 테스트

1. **기본 기능**: 로그인, 프로젝트 생성
2. **AI 생성**: 스튜디오에서 이미지 생성
3. **결제**: 구독 플랜 업그레이드
4. **관리자**: 어드민 대시보드 접근