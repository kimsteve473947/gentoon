import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db/prisma";
import { getPaymentHistory } from "@/lib/payments/toss-billing-v2";

// 결제 내역 조회
export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    // 사용자 정보 조회
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser) {
      return NextResponse.json({
        transactions: [],
      });
    }

    // 결제 내역 조회
    const transactions = await getPaymentHistory(dbUser.id, 20);

    return NextResponse.json({
      transactions,
    });
  } catch (error) {
    console.error("Get payment history error:", error);
    return NextResponse.json(
      { error: "결제 내역 조회 실패" },
      { status: 500 }
    );
  }
}