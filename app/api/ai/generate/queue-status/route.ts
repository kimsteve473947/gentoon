import { NextRequest, NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest, ApiResponse } from "@/lib/auth/api-middleware";
import { generationQueue } from "@/lib/ai/generation-queue";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * AI 생성 큐 상태 조회 API
 * 개발 및 모니터링용
 */
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const userId = request.user.id;

    // 관리자 액션들
    if (action === "clear" && process.env.NODE_ENV === 'development') {
      generationQueue.clear();
      return ApiResponse.success({ message: "큐가 초기화되었습니다" });
    }

    if (action === "cancel") {
      const canceledCount = generationQueue.cancelUserRequests(userId);
      return ApiResponse.success({ 
        message: `${canceledCount}개의 요청이 취소되었습니다`,
        canceledCount 
      });
    }

    if (action === "setConcurrent") {
      const maxConcurrent = parseInt(searchParams.get("max") || "3");
      generationQueue.setMaxConcurrent(maxConcurrent);
      return ApiResponse.success({ 
        message: `동시 처리 한도가 ${maxConcurrent}으로 설정되었습니다`,
        maxConcurrent 
      });
    }

    // 기본 상태 조회
    const status = generationQueue.getStatus();
    
    return ApiResponse.success({
      status,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    });

  } catch (error) {
    console.error("Queue status error:", error);
    return ApiResponse.error("큐 상태 조회 중 오류가 발생했습니다");
  }
});