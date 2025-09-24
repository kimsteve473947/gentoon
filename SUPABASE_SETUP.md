# Supabase 설정 가이드

## 1. Supabase 프로젝트 생성

1. [Supabase](https://app.supabase.com) 에 접속하여 로그인
2. "New Project" 클릭
3. 프로젝트 정보 입력:
   - Name: instatoon
   - Database Password: 강력한 비밀번호 생성
   - Region: Northeast Asia (Seoul)

## 2. 환경 변수 설정

프로젝트 생성 후 Settings > API 에서 다음 키들을 복사:

```bash
# .env.local 파일에 추가
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 3. Google OAuth 설정

### Supabase 대시보드에서:
1. Authentication > Providers > Google 활성화
2. Client ID와 Client Secret 입력 필요

### Google Cloud Console에서:
1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. APIs & Services > Credentials
4. Create Credentials > OAuth client ID
5. Application type: Web application
6. Authorized redirect URIs 추가:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   ```
7. Client ID와 Client Secret을 Supabase에 입력

## 4. Kakao OAuth 설정

### Kakao Developers에서:
1. [Kakao Developers](https://developers.kakao.com) 접속
2. 내 애플리케이션 > 애플리케이션 추가하기
3. 앱 설정:
   - 앱 이름: GenToon
   - 사업자명: 개인 또는 회사명
4. 앱 키 > REST API 키 복사
5. 카카오 로그인 > 활성화
6. Redirect URI 등록:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   ```

### Supabase에 Kakao 설정:
1. Authentication > Providers
2. 맨 아래 "Custom Provider" 추가
3. 설정:
   ```
   Provider Name: kakao
   Client ID: [Kakao REST API 키]
   Client Secret: [Kakao Client Secret]
   Authorization URL: https://kauth.kakao.com/oauth/authorize
   Token URL: https://kauth.kakao.com/oauth/token
   User Info URL: https://kapi.kakao.com/v2/user/me
   ```

## 5. 데이터베이스 테이블 생성

SQL Editor에서 다음 쿼리 실행:

```sql
-- 사용자 프로필 테이블
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 사용자 가입 시 자동으로 프로필 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS (Row Level Security) 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 프로필만 볼 수 있음
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- 사용자는 자신의 프로필만 수정할 수 있음
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
```

## 6. 테스트

1. 로컬 서버 실행:
   ```bash
   npm run dev
   ```

2. http://localhost:3000/sign-in 접속

3. Google 또는 Kakao로 로그인 테스트

## 문제 해결

### "Invalid API Key" 오류
- .env.local 파일의 키가 올바른지 확인
- 서버 재시작 필요

### OAuth 리다이렉트 오류
- Redirect URI가 정확히 일치하는지 확인
- Supabase 프로젝트 URL이 올바른지 확인

### 로그인 후 대시보드로 이동하지 않음
- /auth/callback 라우트가 제대로 설정되어 있는지 확인
- 미들웨어가 올바르게 작동하는지 확인