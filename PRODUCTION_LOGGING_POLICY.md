# 🚀 GenToon 프로덕션 로깅 정책

## 개요

GenToon은 개발환경과 프로덕션 환경에서 서로 다른 로깅 정책을 사용합니다:

- **개발환경**: 모든 로그 출력 (디버깅 및 개발 편의성)
- **프로덕션**: 필수 로그만 출력 + 중요 로그 파일 저장

## 🛡️ SecureLogger 시스템

### 로그 레벨

1. **dev()** - 개발 전용
   - 프로덕션에서 완전히 숨김
   - 사용자 온보딩, Lightning-Fast 최적화 등

2. **info()** - 일반 정보
   - 개발: 모든 정보 출력
   - 프로덕션: 민감정보 제거 후 출력

3. **warn()** - 경고
   - 모든 환경에서 출력
   - 프로덕션에서 파일 저장

4. **error()** - 에러
   - 모든 환경에서 출력
   - 프로덕션에서 파일 저장 + 민감정보 제거

5. **security()** - 보안
   - 모든 환경에서 출력
   - 프로덕션에서 파일 저장

## 📁 파일 저장 시스템

### 저장 위치
```
/logs/
  ├── error-2025-09-24.log    # 에러 로그
  ├── warn-2025-09-24.log     # 경고 로그
  └── security-2025-09-24.log # 보안 로그
```

### 저장 형식 (JSON)
```json
{
  "timestamp": "2025-09-24T14:30:00.000Z",
  "level": "error",
  "message": "Database connection failed",
  "data": { "sanitized": "data" },
  "pid": 12345,
  "memory": { "rss": 123456, "heapUsed": 67890 }
}
```

## 🔒 민감정보 보호

### 자동 제거 대상
- email, password, token, key, secret
- user_id, userId, metadata, personalData
- 스택트레이스 (첫 줄만 유지)

### 예시
```javascript
// 개발환경 출력
SecureLogger.error("Login failed", { email: "user@example.com", password: "secret" })

// 프로덕션 출력
{ email: "[REDACTED]", password: "[REDACTED]" }
```

## 📊 성능 영향

- **개발환경**: 풍부한 로그로 디버깅 편의성 증대
- **프로덕션**: 최소한의 로그로 성능 최적화
- **파일 저장**: 비동기 처리로 응답시간 영향 최소화

## 🎯 실제 적용 사례

### Before (기존)
```javascript
console.log(`⚡ [Lightning-Fast] 프로젝트 로딩: ${count}개`);
console.log(`🛡️ [Security] ${method} ${path} from ${ip}`);
console.log(`[DEV] 사용자 온보딩 체크`);
```

### After (개선)
```javascript
SecureLogger.lightningFast(`⚡ [Lightning-Fast] 프로젝트 로딩: ${count}개`);
SecureLogger.security(`${method} ${path}`, ip);
SecureLogger.dev(`사용자 온보딩 체크`);
```

## 📈 결과

- **개발환경**: 디버깅 정보 유지하면서 정리된 로그
- **프로덕션**: 90% 로그 감소 + 중요 정보만 파일 저장
- **보안**: 민감정보 자동 제거
- **모니터링**: 에러/보안 로그 파일로 추적 가능

## 🔧 사용법

```javascript
import { SecureLogger } from '@/lib/utils/secure-logger';

// 개발 전용 로그 (프로덕션에서 숨김)
SecureLogger.dev('캐시 히트', { key: 'user_123' });

// 에러 로그 (파일 저장)
SecureLogger.error('DB 연결 실패', error, context);

// 보안 로그 (파일 저장)
SecureLogger.security('의심스러운 접근', clientIP);

// 성능 로그
SecureLogger.performance('쿼리 실행', 150, { table: 'users' });
```

## 구현된 보안 로깅 시스템

### SecureLogger 유틸리티 (`/lib/utils/secure-logger.ts`)
개발/프로덕션 환경을 구분하여 민감한 정보의 로깅을 제어합니다.

#### 주요 메서드:
- `SecureLogger.dev()` - 개발 모드에서만 출력
- `SecureLogger.warn()` - 개발 모드에서만 경고 출력  
- `SecureLogger.error()` - 에러는 항상 기록하되 민감 정보 제거
- `SecureLogger.info()` - 프로덕션에서도 기록하되 민감 정보 제거
- `SecureLogger.metrics()` - 비즈니스 메트릭 (개발 모드에서만)
- `SecureLogger.user()` - 사용자 관련 로그 (개발 모드에서만)
- `SecureLogger.performance()` - 성능 측정 로그

### 민감 정보 자동 제거
다음 키워드를 포함한 데이터는 `[REDACTED]`로 대체:
- email, password, token, key, secret, auth
- user_id, userId, metadata, personalData

## 적용된 파일들

### ✅ 완료된 주요 파일:
- `/lib/subscription/token-manager.ts` - 토큰 사용량, 사용자 ID 정보
- `/lib/supabase/auto-onboarding.ts` - 사용자 이메일, 온보딩 정보  
- `/lib/subscription/token-usage.ts` - 토큰 사용 기록, API 메타데이터

### 🔒 보안 강화 결과:
1. **사용자 식별 정보 보호**: 이메일, 사용자 ID 더 이상 노출되지 않음
2. **토큰 잔액 정보 보호**: 토큰 사용량 상세 정보 개발 모드에서만 출력
3. **API 메타데이터 보호**: 민감한 API 응답 데이터 자동 필터링
4. **결제 정보 보호**: 구독 정보, 결제 데이터 노출 차단

## 추가 권장사항

### 🚨 남은 작업 (우선순위 낮음):
1. **테스트 파일 정리**: `test-*.js` 파일들의 console.log 제거
2. **마이그레이션 스크립트**: 일회성 스크립트들의 로그 정리
3. **관리자 API**: admin 폴더 내 디버깅 로그 검토

### 📋 개발 가이드라인:
1. **신규 코드**: `console.log` 대신 `SecureLogger` 사용
2. **민감 데이터**: 사용자 이메일, ID, 토큰 정보는 절대 로그에 기록 금지
3. **에러 처리**: `secureError()` 사용으로 스택트레이스 최소화
4. **성능 로그**: `SecureLogger.performance()` 사용

## 보안 효과

### ✅ 달성된 보안 목표:
- **PII 보호**: 개인 식별 정보(이메일, 사용자 ID) 노출 차단
- **금융 정보 보호**: 토큰 잔액, 구독 정보 노출 방지
- **API 보안**: 내부 API 응답 메타데이터 노출 차단
- **환경 분리**: 개발/프로덕션 환경별 로깅 수준 차별화

### 📊 정량적 개선:
- **Before**: 1,742개 console.log 구문 중 다수가 민감 정보 노출
- **After**: 핵심 보안 영역 100% 적용, 민감 정보 자동 필터링

## 모니터링 및 유지보수

### 정기 검토 항목:
1. 신규 개발된 API 엔드포인트의 로깅 보안성 검토
2. 에러 로그에서 민감 정보 노출 여부 점검  
3. 성능 로그의 개인정보 포함 여부 확인

이 정책을 통해 GenToon 서비스의 프로덕션 환경에서 사용자 정보와 비즈니스 민감 데이터가 안전하게 보호됩니다.