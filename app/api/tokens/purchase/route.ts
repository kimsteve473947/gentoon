import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tokenManager } from "@/lib/subscription/token-manager";

// 토큰 패키지 옵션 (Gemini API 실제 비용 기반)
// 1 이미지 = 10토큰 = 50원
const TOKEN_PACKAGES = {
  small: { tokens: 100, price: 5000, name: "스타터 팩 (10이미지)" },      // 50원/이미지
  medium: { tokens: 500, price: 20000, name: "스탠다드 팩 (50이미지)" }, // 40원/이미지 (20% 할인)
  large: { tokens: 1200, price: 40000, name: "프로 팩 (120이미지)" },    // 33원/이미지 (34% 할인)
  mega: { tokens: 3000, price: 90000, name: "메가 팩 (300이미지)" },    // 30원/이미지 (40% 할인)
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { packageId } = body;
    
    if (!packageId || !TOKEN_PACKAGES[packageId as keyof typeof TOKEN_PACKAGES]) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 패키지입니다" },
        { status: 400 }
      );
    }
    
    const selectedPackage = TOKEN_PACKAGES[packageId as keyof typeof TOKEN_PACKAGES];
    
    // 실제 결제 처리는 Toss Payments 연동 후 진행
    // 여기서는 임시로 토큰만 추가
    await tokenManager.addTokens(user.id, selectedPackage.tokens);
    
    const newBalance = await tokenManager.getBalance(user.id);
    
    return NextResponse.json({
      success: true,
      tokensAdded: selectedPackage.tokens,
      newBalance,
      message: `${selectedPackage.name} 구매가 완료되었습니다`,
    });
  } catch (error) {
    console.error("Token purchase error:", error);
    return NextResponse.json(
      { success: false, error: "토큰 구매 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 토큰 패키지 정보 조회
export async function GET() {
  return NextResponse.json({
    success: true,
    packages: TOKEN_PACKAGES,
  });
}