import { NextRequest, NextResponse } from "next/server";
import { 
  validateTestEnvironment, 
  simulateRecurringPayment, 
  cleanupTestData,
  generateTestReport,
  TEST_CARDS,
  TEST_SCENARIOS
} from "@/lib/payments/test-helper";

// 개발 환경에서만 사용 가능한 테스트 API
export async function POST(req: NextRequest) {
  // 프로덕션 환경에서는 접근 차단
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: "프로덕션 환경에서는 사용할 수 없습니다" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { action, userId, billingKey, customerKey, amount } = body;

    console.log("🧪 테스트 API 호출:", { action, userId });

    switch (action) {
      case "validate_environment":
        return handleValidateEnvironment();
        
      case "simulate_recurring":
        return handleSimulateRecurring(billingKey, customerKey, amount);
        
      case "cleanup_test_data":
        return handleCleanupTestData(userId);
        
      case "get_test_cards":
        return handleGetTestCards();
        
      case "get_test_scenarios": 
        return handleGetTestScenarios();
        
      default:
        return NextResponse.json(
          { error: "알 수 없는 액션입니다" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("테스트 API 오류:", error);
    return NextResponse.json(
      { 
        error: "테스트 실행 중 오류가 발생했습니다",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// 환경 검증
async function handleValidateEnvironment() {
  const validation = validateTestEnvironment();
  
  return NextResponse.json({
    success: true,
    validation,
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasClientKey: !!process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY,
      hasSecretKey: !!process.env.TOSS_SECRET_KEY,
      clientKeyPrefix: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY?.substring(0, 5) + "...",
    }
  });
}

// 자동결제 시뮬레이션
async function handleSimulateRecurring(
  billingKey: string, 
  customerKey: string, 
  amount: number = 29000
) {
  if (!billingKey || !customerKey) {
    return NextResponse.json(
      { error: "billingKey와 customerKey가 필요합니다" },
      { status: 400 }
    );
  }

  const result = await simulateRecurringPayment(billingKey, customerKey, amount);
  
  return NextResponse.json({
    success: true,
    result,
    timestamp: new Date().toISOString()
  });
}

// 테스트 데이터 정리
async function handleCleanupTestData(userId: string) {
  if (!userId) {
    return NextResponse.json(
      { error: "userId가 필요합니다" },
      { status: 400 }
    );
  }

  try {
    await cleanupTestData(userId);
    
    return NextResponse.json({
      success: true,
      message: "테스트 데이터가 정리되었습니다",
      userId
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: "테스트 데이터 정리 실패",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// 테스트 카드 정보 반환
async function handleGetTestCards() {
  return NextResponse.json({
    success: true,
    testCards: TEST_CARDS,
    note: "이 카드들은 토스페이먼츠 테스트 환경에서만 사용 가능합니다"
  });
}

// 테스트 시나리오 반환
async function handleGetTestScenarios() {
  return NextResponse.json({
    success: true,
    testScenarios: TEST_SCENARIOS,
    note: "각 시나리오는 다른 결제 상황을 시뮬레이션합니다"
  });
}

// GET 요청으로 테스트 정보 조회
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: "프로덕션 환경에서는 사용할 수 없습니다" },
      { status: 403 }
    );
  }

  const validation = validateTestEnvironment();
  
  return NextResponse.json({
    success: true,
    message: "토스페이먼츠 자동결제 테스트 API",
    validation,
    availableActions: [
      "validate_environment",
      "simulate_recurring", 
      "cleanup_test_data",
      "get_test_cards",
      "get_test_scenarios"
    ],
    testCards: Object.keys(TEST_CARDS),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      isTestEnvironment: validation.valid
    }
  });
}