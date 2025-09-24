import { NextRequest, NextResponse } from "next/server";

// 빌링키 발급 실패 처리
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const message = searchParams.get("message");
    
    console.error(`Billing authorization failed: ${code} - ${message}`);
    
    // 실패 페이지로 리다이렉트
    return NextResponse.redirect(
      new URL(`/pricing/error?code=${code}&message=${encodeURIComponent(message || "카드 등록에 실패했습니다")}`, req.nextUrl.origin)
    );
  } catch (error) {
    console.error("Billing fail error:", error);
    
    return NextResponse.redirect(
      new URL("/pricing/error?message=처리 중 오류가 발생했습니다", req.nextUrl.origin)
    );
  }
}