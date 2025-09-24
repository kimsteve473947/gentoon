# 토큰 사용량 계산 가이드

## 📊 토큰 계산 원칙

### ⚠️ **중요: 실제 API 토큰 사용량 기반 계산**
- **절대 임의의 숫자(+1, +2) 사용 금지**
- **Google AI API에서 반환하는 실제 토큰 사용량만 사용**
- **사용자별 누적 계산**
- **모델별 분리 계산**

## 🎯 토큰 계산 구조

### 1. **Google AI API 응답 구조**
```javascript
const response = await model.generateContent(prompt);
const usage = response.response.usageMetadata;

// 실제 사용량
{
  promptTokenCount: 150,      // 입력 토큰
  candidatesTokenCount: 300,  // 출력 토큰
  totalTokenCount: 450        // 총 토큰
}
```

### 2. **데이터베이스 스키마**
```sql
-- 사용자별 토큰 사용량 테이블
CREATE TABLE token_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID REFERENCES user(id),
  service_type VARCHAR(50) NOT NULL, -- 'text_generation' | 'image_generation'
  model_name VARCHAR(100) NOT NULL,  -- 'gemini-2.0-flash-exp' | 'gemini-2-5-flash-image-preview'
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  api_cost DECIMAL(10,6),           -- API 실제 비용 (선택사항)
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB                    -- 추가 정보 (프롬프트 길이, 요청 타입 등)
);

-- 사용자별 토큰 잔액 테이블 (기존)
-- balance 필드는 실제 구매한 토큰 수
-- used_tokens는 실제 API에서 소모된 토큰의 누적값
```

### 3. **모델별 분리 계산**

#### A. **텍스트 생성 (대본 생성)**
- **모델**: `gemini-2.0-flash-exp`
- **서비스**: `text_generation`
- **계산**: API 응답의 `usageMetadata.totalTokenCount`

#### B. **이미지 생성**
- **모델**: `gemini-2-5-flash-image-preview` (또는 사용 중인 모델)
- **서비스**: `image_generation`
- **계산**: API 응답의 실제 토큰 사용량

## 🔧 구현 가이드

### 1. **토큰 사용량 기록 함수**
```typescript
// lib/subscription/token-usage.ts
export async function recordTokenUsage({
  userId,
  serviceType,
  modelName,
  promptTokens,
  completionTokens,
  totalTokens,
  metadata = {}
}) {
  const supabase = await createClient();
  
  // 1. 토큰 사용량 기록
  await supabase.from('token_usage').insert({
    userId,
    service_type: serviceType,
    model_name: modelName,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    metadata
  });
  
  // 2. 사용자 잔액에서 차감
  await supabase.rpc('deduct_user_tokens', {
    user_id: userId,
    tokens_used: totalTokens
  });
}
```

### 2. **API 호출 시 토큰 추출**
```typescript
// AI 대본 생성 API 예시
const response = await geminiClient.generateContent(prompt);
const usage = response.response.usageMetadata;

// 실제 토큰 사용량 기록
await recordTokenUsage({
  userId,
  serviceType: 'text_generation',
  modelName: 'gemini-2.0-flash-exp',
  promptTokens: usage.promptTokenCount,
  completionTokens: usage.candidatesTokenCount,
  totalTokens: usage.totalTokenCount,
  metadata: {
    requestType: 'script_generation',
    panelCount,
    storyLength: storyPrompt.length
  }
});
```

### 3. **이미지 생성 API 예시**
```typescript
// 이미지 생성 시
const imageResponse = await imageModel.generateImage(prompt);
const imageUsage = imageResponse.response.usageMetadata;

await recordTokenUsage({
  userId,
  serviceType: 'image_generation', 
  modelName: 'gemini-2-5-flash-image-preview',
  promptTokens: imageUsage.promptTokenCount,
  completionTokens: imageUsage.candidatesTokenCount,
  totalTokens: imageUsage.totalTokenCount,
  metadata: {
    requestType: 'panel_generation',
    aspectRatio,
    hasCharacterReference: selectedCharacters.length > 0
  }
});
```

## 📈 토큰 추적 및 분석

### 1. **사용자별 토큰 사용량 조회**
```sql
-- 전체 사용량
SELECT 
  service_type,
  model_name,
  SUM(total_tokens) as total_used,
  COUNT(*) as request_count,
  AVG(total_tokens) as avg_tokens_per_request
FROM token_usage 
WHERE userId = $1 
GROUP BY service_type, model_name;

-- 일별 사용량
SELECT 
  DATE(created_at) as date,
  service_type,
  SUM(total_tokens) as daily_tokens
FROM token_usage 
WHERE userId = $1 
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), service_type
ORDER BY date DESC;
```

### 2. **비용 분석**
```typescript
// 모델별 토큰 비용 (Google AI Pricing 기준)
const TOKEN_COSTS = {
  'gemini-2.0-flash-exp': {
    input: 0.000075,   // per 1K tokens
    output: 0.0003     // per 1K tokens
  },
  'gemini-2-5-flash-image-preview': {
    input: 0.0025,     // per 1K tokens (이미지 생성)
    output: 0.01       // per 1K tokens
  }
};
```

## ⚠️ 주의사항

### 1. **절대 금지사항**
```typescript
// ❌ 절대 하지 말 것
await tokenManager.useTokensForImage(userId, 1, options); // 임의의 숫자

// ✅ 올바른 방법
const usage = response.response.usageMetadata;
await recordTokenUsage({
  userId,
  totalTokens: usage.totalTokenCount, // 실제 API 응답값
  // ... 기타 정보
});
```

### 2. **에러 처리**
- API 호출 실패 시 토큰 차감하지 않음
- 토큰 사용량 기록 실패 시 알림
- 잔액 부족 시 사전 체크

### 3. **모니터링**
- 비정상적인 토큰 사용량 감지
- 모델별 평균 사용량 추적
- 사용자별 패턴 분석

## 🚀 마이그레이션 계획

1. **토큰 사용량 테이블 생성**
2. **기존 토큰 계산 로직 제거**
3. **실제 API 응답 기반 계산으로 교체**
4. **모델별 분리된 계산 구현**
5. **대시보드에 상세 사용량 표시**

---

**❗ 핵심: Google AI API의 실제 토큰 사용량만 사용하고, 절대 임의의 숫자를 더하지 말 것!**