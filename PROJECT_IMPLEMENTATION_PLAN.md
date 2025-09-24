# 📋 GenToon SaaS 프로젝트 구현 계획

## 🎯 프로젝트 목표
AI 기반 인스타그램 웹툰 제작 플랫폼을 완성하여 실제 서비스 가능한 수준으로 구현

## 📊 현재 상태 분석

### ✅ 완료된 작업
1. **인증 시스템**
   - Supabase Auth 통합 완료
   - Google/Kakao OAuth 구현
   - 세션 관리 및 미들웨어 구성
   - 사용자 프로필 UI/UX 완성

2. **기본 UI/UX**
   - 랜딩 페이지 디자인
   - 대시보드 레이아웃
   - 헤더 및 네비게이션
   - 로그인 페이지 고급화

3. **데이터베이스 스키마**
   - Prisma 스키마 정의 완료
   - User, Subscription, Project, Character 모델 설계

### 🚧 구현 필요 사항
1. **핵심 기능**
   - 실제 이미지 생성 API 연동
   - 토큰 과금 시스템 활성화
   - 웹툰 제작 스튜디오 구현
   - 캐릭터 일관성 시스템

2. **결제 시스템**
   - Toss Payments 통합
   - 구독 관리 로직
   - 토큰 구매 플로우

3. **백엔드 로직**
   - API 엔드포인트 구현
   - 토큰 사용량 추적
   - 이미지 저장 및 관리

## 🗓️ 구현 로드맵

### Phase 1: 데이터베이스 및 백엔드 기초 (1-2일)

#### 1.1 Supabase 데이터베이스 설정
```sql
-- Users 테이블 (Supabase Auth와 연동)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions 테이블
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  plan TEXT DEFAULT 'FREE',
  tokens_total INTEGER DEFAULT 10,
  tokens_used INTEGER DEFAULT 0,
  max_characters INTEGER DEFAULT 1,
  max_projects INTEGER DEFAULT 3,
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Characters 테이블
CREATE TABLE characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  style_guide TEXT,
  reference_images JSONB,
  thumbnail_url TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects 테이블
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  status TEXT DEFAULT 'DRAFT',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generations 테이블 (AI 생성 기록)
CREATE TABLE generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  image_url TEXT,
  thumbnail_url TEXT,
  model TEXT DEFAULT 'gemini-2.5-flash-image-preview',
  tokens_used INTEGER DEFAULT 2,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 데이터만 접근 가능
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own characters" ON characters FOR SELECT USING (auth.uid() = user_id OR is_public = true);
CREATE POLICY "Users can manage own characters" ON characters FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own projects" ON projects FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own generations" ON generations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create generations" ON generations FOR INSERT WITH CHECK (auth.uid() = user_id);
```

#### 1.2 API 엔드포인트 구현
- `/api/user/profile` - 프로필 조회/수정
- `/api/subscription/status` - 구독 상태 조회
- `/api/tokens/balance` - 토큰 잔액 조회
- `/api/tokens/use` - 토큰 사용
- `/api/characters` - 캐릭터 CRUD
- `/api/projects` - 프로젝트 CRUD
- `/api/generations/create` - 이미지 생성

### Phase 2: Gemini 2.5 Flash (Nano Banana) API 통합 (2-3일)

#### 2.1 실제 이미지 생성 구현
```typescript
// Gemini 2.5 Flash (Nano Banana) API 통합
// 참고: https://github.com/JimmyLv/awesome-nano-banana
interface GenerationRequest {
  prompt: string;
  characterIds?: string[];
  style?: string;
  negativePrompt?: string;
  referenceImages?: string[]; // 캐릭터 일관성을 위한 레퍼런스
}

interface GenerationResponse {
  imageUrl: string;
  thumbnailUrl: string;
  tokensUsed: number;
  generationId: string;
}

// Nano Banana의 고급 기능
// - 3D 공간 이해를 통한 정확한 객체 배치
// - 조명과 반사 자동 재렌더링
// - 스타일 일관성 유지
// - 컨텍스트 인식 이미지 조작
```

#### 2.2 토큰 과금 시스템
- Gemini API 호출 시 토큰 차감
- 토큰 부족 시 생성 차단
- 사용 내역 기록

#### 2.3 이미지 저장
- Supabase Storage 통합 활용
- 썸네일 자동 생성
- CDN 최적화

### Phase 3: 웹툰 스튜디오 구현 (3-4일)

#### 3.1 스튜디오 UI 구성
- **프로젝트 생성 플로우**
  - 제목, 설명 입력
  - 캐릭터 선택
  - 스타일 설정

- **패널 편집기**
  - 드래그 앤 드롭 패널 순서 변경
  - 프롬프트 입력 인터페이스
  - 실시간 미리보기
  - 일괄 생성 기능

- **캐릭터 관리**
  - 레퍼런스 이미지 업로드
  - 캐릭터 설명 입력
  - 스타일 가이드 설정

#### 3.2 핵심 기능
```typescript
// 캐릭터 일관성 시스템
class CharacterConsistencySystem {
  - 레퍼런스 이미지 분석
  - 특징 추출 및 저장
  - 프롬프트 자동 보강
  - 일관성 검증
}

// 프롬프트 최적화
class PromptOptimizer {
  - 캐릭터 설명 자동 삽입
  - 스타일 가이드 적용
  - 네거티브 프롬프트 관리
}
```

### Phase 4: 결제 시스템 구현 (2-3일)

#### 4.1 Toss Payments 통합
```typescript
// 결제 플로우
1. 플랜 선택
2. Toss Payments 결제창 호출
3. 결제 완료 콜백 처리
4. 구독 정보 업데이트
5. 토큰 충전

// Webhook 처리
- 결제 성공/실패
- 구독 갱신
- 환불 처리
```

#### 4.2 구독 관리
- 플랜 업그레이드/다운그레이드
- 자동 갱신
- 구독 취소
- 결제 내역 조회

### Phase 5: 최적화 및 마무리 (2-3일)

#### 5.1 성능 최적화
- 이미지 lazy loading
- API 응답 캐싱
- 데이터베이스 쿼리 최적화
- CDN 활용

#### 5.2 사용자 경험 개선
- 로딩 상태 개선
- 에러 처리 고도화
- 툴팁 및 가이드 추가
- 반응형 디자인 완성

#### 5.3 보안 강화
- API Rate Limiting
- Input Validation
- CORS 설정
- 환경 변수 관리

## 🔧 기술적 구현 상세

### 토큰 시스템 백엔드 로직
```typescript
// /lib/services/token-service.ts
export class TokenService {
  async useTokens(userId: string, amount: number) {
    // 1. 잔액 확인
    const balance = await getTokenBalance(userId);
    if (balance < amount) {
      throw new InsufficientTokensError();
    }
    
    // 2. 토큰 차감
    await deductTokens(userId, amount);
    
    // 3. 사용 내역 기록
    await recordUsage(userId, amount, 'image_generation');
    
    // 4. 알림 체크 (잔액 부족 경고)
    if (balance - amount < 10) {
      await sendLowBalanceNotification(userId);
    }
  }
}
```

### Gemini 2.5 Flash (Nano Banana) API 실제 통합
```typescript
// /lib/ai/nano-banana-service.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

export class NanoBananaService {
  private genAI: GoogleGenerativeAI;
  
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  }
  
  async generateWebtoonPanel(
    prompt: string, 
    options?: {
      referenceImages?: string[];
      characterDescriptions?: Map<string, string>;
      style?: string;
    }
  ) {
    // 1. Gemini 2.5 Flash 모델 초기화
    const model = this.genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash" // Nano Banana 모델
    });
    
    // 2. 프롬프트 최적화 (3D 이해 및 컨텍스트 강화)
    const optimizedPrompt = this.buildNanoBananaPrompt(prompt, options);
    
    // 3. 이미지 생성 요청
    const parts = [];
    
    // 텍스트 프롬프트 추가
    parts.push({ text: optimizedPrompt });
    
    // 레퍼런스 이미지가 있는 경우 추가
    if (options?.referenceImages) {
      for (const imageUrl of options.referenceImages) {
        const imageData = await this.fetchImageData(imageUrl);
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: imageData
          }
        });
      }
    }
    
    const result = await model.generateContent({
      contents: [{ parts }]
    });
    
    // 4. 응답 처리
    const response = await result.response;
    const generatedContent = response.text();
    
    // 5. 이미지 저장 및 URL 반환
    const { imageUrl, thumbnailUrl } = await this.saveGeneratedImage(generatedContent);
    
    return {
      imageUrl,
      thumbnailUrl,
      tokensUsed: this.calculateTokenUsage(prompt, options?.referenceImages?.length || 0)
    };
  }
  
  private buildNanoBananaPrompt(prompt: string, options?: any): string {
    let enhancedPrompt = `
    [Webtoon Panel Generation with Nano Banana]
    Style: Korean webtoon, Instagram optimized (1:1 ratio)
    
    Scene Description: ${prompt}
    `;
    
    if (options?.style) {
      enhancedPrompt += `\nArt Style: ${options.style}`;
    }
    
    if (options?.characterDescriptions) {
      enhancedPrompt += `\n\n[Character Consistency Requirements]`;
      options.characterDescriptions.forEach((desc, name) => {
        enhancedPrompt += `\n- ${name}: ${desc}`;
      });
    }
    
    enhancedPrompt += `
    
    [Nano Banana Advanced Features]
    - Apply deep 3D understanding for proper object placement
    - Maintain lighting consistency with environment
    - Ensure character consistency across panels
    - Use context-aware rendering for natural integration
    `;
    
    return enhancedPrompt;
  }
  
  private calculateTokenUsage(prompt: string, referenceImageCount: number): number {
    // 기본 토큰: 2
    // 긴 프롬프트: +1
    // 레퍼런스 이미지당: +1
    let tokens = 2;
    if (prompt.length > 200) tokens += 1;
    tokens += referenceImageCount;
    return tokens;
  }
}
```

## 📝 체크리스트

### 필수 구현 사항
- [ ] Supabase 데이터베이스 마이그레이션
- [ ] 사용자 프로필 초기화 로직
- [ ] 토큰 시스템 API 엔드포인트
- [ ] Gemini API 실제 연동
- [ ] 이미지 저장 시스템
- [ ] 웹툰 스튜디오 기본 UI
- [ ] 캐릭터 업로드 기능
- [ ] 프로젝트 생성 플로우
- [ ] 패널 생성 및 편집
- [ ] Toss Payments 기본 통합
- [ ] 구독 플랜 선택 UI
- [ ] 토큰 구매 플로우

### 선택 구현 사항
- [ ] 소셜 공유 기능
- [ ] 갤러리 페이지
- [ ] 커뮤니티 기능
- [ ] 추천인 시스템
- [ ] 분석 대시보드
- [ ] 관리자 패널

## 🚀 즉시 실행 가능한 작업

1. **Supabase 데이터베이스 설정**
   - SQL 스크립트 실행
   - RLS 정책 적용
   - 초기 데이터 삽입

2. **API 라우트 생성**
   - 기본 CRUD 엔드포인트
   - 인증 미들웨어 적용
   - 에러 핸들링

3. **토큰 시스템 활성화**
   - 사용자 가입 시 초기 토큰 부여
   - 토큰 사용 로직 구현
   - 잔액 표시 UI

## 💡 주의사항

1. **Gemini API 제한**
   - Rate Limiting 고려
   - 에러 재시도 로직
   - 비용 최적화

2. **이미지 저장**
   - 용량 제한 설정
   - 포맷 검증
   - CDN 캐싱

3. **보안**
   - API 키 노출 방지
   - SQL Injection 방지
   - XSS 방지

## 📊 예상 일정

- **총 소요 기간**: 10-15일
- **MVP 완성**: 7-10일
- **프로덕션 준비**: 3-5일

## 🎯 다음 단계

1. Supabase 데이터베이스 마이그레이션 실행
2. 토큰 시스템 API 구현
3. Gemini API 테스트 및 통합
4. 웹툰 스튜디오 UI 구현 시작

---

**작성일**: 2024-01-07
**작성자**: Nano Banana Team
**버전**: 1.0.0