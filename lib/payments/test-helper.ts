// 토스페이먼츠 테스트 환경 도구

interface TestPaymentRequest {
  userId: string;
  planId: 'FREE' | 'STARTER' | 'PRO' | 'PREMIUM';
  amount: number;
  useTestCard?: boolean;
}

interface TestResult {
  success: boolean;
  billingKey?: string;
  paymentKey?: string;
  error?: string;
  details?: any;
}

// 테스트 카드 정보
export const TEST_CARDS = {
  // 성공 테스트 카드
  SUCCESS: {
    number: "4900000000000003",
    expiry: "12/25",
    cvc: "123",
    password: "00",
    description: "결제 성공 테스트 카드"
  },
  // 실패 테스트 카드들
  INSUFFICIENT_BALANCE: {
    number: "4900000000000011", 
    expiry: "12/25",
    cvc: "123",
    password: "00",
    description: "잔액 부족으로 결제 실패"
  },
  INVALID_CARD: {
    number: "4900000000000029",
    expiry: "12/25", 
    cvc: "123",
    password: "00",
    description: "유효하지 않은 카드"
  },
  EXPIRED_CARD: {
    number: "4900000000000037",
    expiry: "12/23", // 만료된 날짜
    cvc: "123",
    password: "00",
    description: "만료된 카드"
  }
};

// 테스트 시나리오
export const TEST_SCENARIOS = [
  {
    name: "정상 빌링키 발급 및 첫 결제",
    card: TEST_CARDS.SUCCESS,
    expectedResult: "success",
    description: "정상적인 빌링키 발급과 첫 결제가 성공하는 시나리오"
  },
  {
    name: "잔액 부족으로 인한 결제 실패", 
    card: TEST_CARDS.INSUFFICIENT_BALANCE,
    expectedResult: "payment_failed",
    description: "빌링키는 발급되지만 첫 결제가 실패하는 시나리오"
  },
  {
    name: "유효하지 않은 카드로 빌링키 발급 실패",
    card: TEST_CARDS.INVALID_CARD,
    expectedResult: "billing_key_failed", 
    description: "빌링키 발급 자체가 실패하는 시나리오"
  },
  {
    name: "만료된 카드로 인한 실패",
    card: TEST_CARDS.EXPIRED_CARD,
    expectedResult: "expired_card",
    description: "만료된 카드로 인한 결제 실패"
  }
];

// 환경 검증
export function validateTestEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // 필수 환경변수 확인
  if (!process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY) {
    errors.push("NEXT_PUBLIC_TOSS_CLIENT_KEY 환경변수 누락");
  }
  
  if (!process.env.TOSS_SECRET_KEY) {
    errors.push("TOSS_SECRET_KEY 환경변수 누락");
  }
  
  // 테스트 환경인지 확인
  if (process.env.NODE_ENV === 'production') {
    errors.push("프로덕션 환경에서는 테스트를 실행할 수 없습니다");
  }
  
  // 테스트 키인지 확인 (토스페이먼츠 테스트 키는 특정 패턴을 가짐)
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  if (clientKey && !clientKey.startsWith('test_')) {
    errors.push("테스트용 클라이언트 키를 사용해주세요 (test_로 시작)");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// 테스트 자동결제 시뮬레이션
export async function simulateRecurringPayment(
  billingKey: string,
  customerKey: string,
  amount: number = 29000
): Promise<TestResult> {
  try {
    const { executeAutoBilling } = await import('@/lib/payments/toss-billing-supabase');
    
    console.log("🧪 테스트 자동결제 실행:", { billingKey: billingKey.slice(0, 10) + '...', customerKey, amount });
    
    const result = await executeAutoBilling(
      billingKey,
      customerKey,
      amount,
      "GenToon 테스트 정기결제",
      `test_recurring_${Date.now()}`
    );
    
    return {
      success: true,
      paymentKey: result.paymentKey,
      details: result
    };
  } catch (error: any) {
    console.error("❌ 테스트 자동결제 실패:", error);
    
    return {
      success: false,
      error: error.message || "알 수 없는 오류",
      details: error
    };
  }
}

// 테스트 데이터 정리
export async function cleanupTestData(userId: string): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error("프로덕션 환경에서는 테스트 데이터를 정리할 수 없습니다");
  }
  
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    
    console.log("🧹 테스트 데이터 정리 중:", userId);
    
    // 테스트 트랜잭션 삭제
    await supabase
      .from('transaction')
      .delete()
      .eq('userId', userId)
      .like('description', '%테스트%');
    
    // 테스트 구독 정리 (빌링키만 제거, 구독은 유지)
    await supabase
      .from('subscription')
      .update({ 
        tossBillingKey: null,
        tossCustomerKey: null 
      })
      .eq('userId', userId);
    
    console.log("✅ 테스트 데이터 정리 완료");
  } catch (error) {
    console.error("❌ 테스트 데이터 정리 실패:", error);
    throw error;
  }
}

// 테스트 보고서 생성
export function generateTestReport(results: TestResult[]): string {
  const total = results.length;
  const successful = results.filter(r => r.success).length;
  const failed = total - successful;
  
  let report = `
🧪 토스페이먼츠 자동결제 테스트 보고서
=====================================

📊 테스트 결과 요약:
- 총 테스트: ${total}개
- 성공: ${successful}개 
- 실패: ${failed}개
- 성공률: ${((successful / total) * 100).toFixed(1)}%

📋 상세 결과:
`;

  results.forEach((result, index) => {
    const status = result.success ? "✅ 성공" : "❌ 실패";
    report += `${index + 1}. ${status}`;
    
    if (result.paymentKey) {
      report += ` - 결제키: ${result.paymentKey}`;
    }
    
    if (result.error) {
      report += ` - 오류: ${result.error}`;
    }
    
    report += "\n";
  });

  report += `
💡 권장사항:
- 실패한 테스트의 오류 메시지를 확인하세요
- 프로덕션 배포 전 모든 테스트가 통과하는지 확인하세요  
- 정기결제 재시도 로직이 올바르게 작동하는지 확인하세요
`;

  return report;
}