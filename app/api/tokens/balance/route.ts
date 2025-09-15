import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tokenManager } from "@/lib/subscription/token-manager";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }
    
    const balance = await tokenManager.getBalance(user.id);
    const isLow = await tokenManager.checkLowBalance(user.id);
    const stats = await tokenManager.getUsageStats(user.id);
    
    return NextResponse.json({
      success: true,
      balance,
      isLowBalance: isLow,
      stats,
    });
  } catch (error) {
    console.error("Get token balance error:", error);
    return NextResponse.json(
      { success: false, error: "토큰 잔액 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}