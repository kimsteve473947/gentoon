# 🧾 현금영수증 자동화 시스템 구현 완료

토스페이먼츠 API를 기반으로 한 완전 자동화된 현금영수증 시스템이 구현되었습니다.

## ✅ 구현된 기능

### 1. 🔧 핵심 서비스
- **TossCashReceiptAPI**: 토스페이먼츠 현금영수증 API 클라이언트
- **CashReceiptAutomationService**: 자동 발급/취소 처리
- **CashReceiptBatchService**: 배치 작업 (상태 업데이트, 재시도)

### 2. 🗄️ 데이터베이스 스키마
- **CashReceipt**: 현금영수증 정보 및 상태 관리
- **UserCashReceiptSettings**: 사용자별 자동 발급 설정
- **Enums**: CashReceiptKeyType, CashReceiptPurpose, CashReceiptStatus

### 3. 🔄 자동화 플로우
1. **결제 완료** → 자동 현금영수증 발급 (조건 충족 시)
2. **환불 처리** → 자동 현금영수증 취소
3. **상태 동기화** → 주기적 토스페이먼츠 상태 확인
4. **실패 재시도** → 자동 재발급 시도

### 4. 📡 API 엔드포인트

#### 사용자용 API
```
GET  /api/cash-receipts           # 현금영수증 목록 조회
POST /api/cash-receipts           # 자동 발급 설정 저장
```

#### 관리자용 API  
```
GET    /api/admin-473947/cash-receipts     # 전체 현금영수증 관리
POST   /api/admin-473947/cash-receipts     # 수동 발급
GET    /api/admin-473947/cash-receipts/[id] # 상세 조회
PATCH  /api/admin-473947/cash-receipts/[id] # 상태 업데이트/취소
DELETE /api/admin-473947/cash-receipts/[id] # 레코드 삭제
```

#### 배치 작업 API
```
POST /api/cron/cash-receipt-batch  # 배치 처리 (상태 업데이트/재시도)
```

## 🛠️ 설정 및 사용법

### 1. 환경변수 설정
```env
# 기존 토스페이먼츠 키 사용
TOSS_SECRET_KEY=test_sk_*** 또는 live_sk_***

# 배치 작업 보안 (선택사항)
CRON_SECRET=your-secure-random-string
```

### 2. 자동 발급 조건
- 결제 상태: COMPLETED
- 최소 금액: 10,000원 이상 (설정 가능)
- 구독 결제: 활성화 (설정 가능)  
- 토스페이먼츠 결제 토큰 존재
- 사용자 자동 발급 설정 활성화

### 3. 사용자 설정 플로우
```javascript
// 1. 사용자가 현금영수증 정보 입력
const settings = {
  cashReceiptKey: "01012345678",        // 휴대폰번호
  cashReceiptKeyType: "PHONE",          // PHONE, CORPORATE, CARD
  cashReceiptPurpose: "DEDUCTION",      // DEDUCTION(소득공제), EVIDENCE(지출증빙)
  autoIssue: true                       // 자동 발급 활성화
};

// 2. 설정 저장
fetch('/api/cash-receipts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(settings)
});

// 3. 다음 결제부터 자동으로 현금영수증 발급됨
```

### 4. 관리자 수동 발급
```javascript
// 특정 거래에 대해 수동 발급
fetch('/api/admin-473947/cash-receipts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    transactionId: "transaction-uuid",
    cashReceiptKey: "01012345678",
    cashReceiptKeyType: "PHONE", 
    cashReceiptPurpose: "DEDUCTION"
  })
});
```

### 5. 배치 작업 설정 (Vercel Cron)
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/cash-receipt-batch",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

## 🔍 현금영수증 상태 흐름

```
PENDING → REQUESTED → IN_PROGRESS → ISSUE_COMPLETE
                                  ↘ ISSUE_FAILED → 재시도
                    ↘ REVOKED (환불 시)
```

1. **PENDING**: 발급 대기
2. **REQUESTED**: 발급 요청됨
3. **IN_PROGRESS**: 국세청 전송 중 (2-3일 소요)
4. **ISSUE_COMPLETE**: 발급 완료
5. **ISSUE_FAILED**: 발급 실패 (자동 재시도)
6. **REVOKED**: 취소됨 (환불 시)

## 🚨 주의사항

### 1. 개인정보 보호
- 현금영수증 식별자는 자동으로 마스킹 처리됨
- 로그에서도 민감 정보는 숨김 처리
- 데이터베이스 저장 시 암호화 권장

### 2. API 제한
- 토스페이먼츠 API 호출 제한 준수
- 배치 작업 시 딜레이 적용 (500ms~1s)
- 실패 재시도는 1시간 간격으로 제한

### 3. 비즈니스 규칙
- 현금영수증은 결제 완료 후에만 발급 가능
- 환불 시 자동으로 현금영수증도 취소됨
- 하나의 거래당 하나의 현금영수증만 발급 가능

## 🔧 커스터마이징

### 자동 발급 조건 변경
```typescript
// lib/payments/cash-receipt-automation.ts
export const DEFAULT_AUTOMATION_CONFIG: CashReceiptAutomationConfig = {
  enabled: true,
  autoIssueForSubscriptions: true,
  autoIssueThreshold: 5000,  // 5천원으로 변경
  defaultPurpose: CashReceiptPurpose.DEDUCTION,
  retryAttempts: 5,          // 재시도 횟수 증가
  retryDelayHours: 2         // 재시도 간격 2시간으로 변경
};
```

### 알림 기능 추가
```typescript
// 현금영수증 발급 완료 시 이메일/SMS 알림
await sendNotification(userId, 'cash_receipt_issued', {
  amount: transaction.amount,
  receiptUrl: popupUri
});
```

## 📊 모니터링 및 분석

### 관리자 대시보드에서 확인 가능한 정보
- 현금영수증 발급률
- 실패 사유별 통계
- 사용자별 설정 현황
- 상태별 현황 (진행중, 완료, 실패)

### 로그 모니터링
```bash
# 현금영수증 관련 로그 확인
grep "🧾" logs/application.log
grep "현금영수증" logs/application.log
```

## 🎯 테스트 시나리오

### 1. 기본 플로우 테스트
1. 사용자 현금영수증 설정 저장
2. 결제 진행 및 완료
3. 자동 현금영수증 발급 확인
4. 환불 처리 및 현금영수증 취소 확인

### 2. 에지 케이스 테스트
- 잘못된 휴대폰 번호로 설정
- API 실패 시 재시도 로직
- 중복 발급 방지
- 부분 환불 시 현금영수증 처리

### 3. 관리자 기능 테스트
- 수동 발급
- 상태 업데이트
- 현금영수증 취소
- 팝업 URI 생성

## 📈 향후 개선 사항

1. **AI 기반 사기 탐지**: 이상한 현금영수증 발급 패턴 감지
2. **OCR 연동**: 현금영수증 이미지에서 정보 자동 추출
3. **다양한 PG 지원**: 다른 결제 대행사 현금영수증 API 연동
4. **모바일 앱 연동**: 푸시 알림을 통한 발급 완료 알림
5. **세무 연동**: 세무 관리 시스템과의 자동 연동

---

✅ **현금영수증 자동화 시스템이 완전히 구현되었습니다!**

이제 비즈니스 운영에 필요한 모든 현금영수증 기능이 자동화되어, 고객 만족도 향상과 관리 효율성을 크게 개선할 수 있습니다.