import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ErrorCode, getErrorDetails, inferErrorCode } from '@/lib/errors/error-types';
import { ensureUserExists } from '@/lib/supabase/auto-onboarding';

export interface AuthenticatedRequest extends NextRequest {
  user: {
    id: string;
    email: string;
    user_metadata?: any;
  };
  userData: {
    id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
    role?: string;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: ErrorCode;
  details?: string;
  actionable?: boolean;
  retryable?: boolean;
  suggestedAction?: string;
}

/**
 * 공통 인증 미들웨어
 * API 라우트에서 사용자 인증을 처리하고 표준화된 응답을 제공합니다.
 */
export function withAuth<T = any>(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse<ApiResponse<T>>>
) {
  return async (req: NextRequest): Promise<NextResponse<ApiResponse<T>>> => {
    try {
      // 모든 환경에서 실제 Supabase 인증 사용
      const supabase = await createClient();
      
      // 사용자 인증 확인
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (!user || authError) {
        console.error('Auth error:', authError);
        return ApiResponse.unauthorized(
          authError?.message?.includes('expired') ? '세션이 만료되었습니다. 다시 로그인해주세요.' : undefined
        );
      }

      // 사용자 데이터 조회 (없으면 자동 생성)
      let { data: userData, error: userError } = await supabase
        .from('user')
        .select('id, email, name, avatarUrl, role')
        .eq('id', user.id)
        .single();

      // 사용자가 없으면 자동 온보딩
      if (!userData || userError) {
        console.log('🚀 신규 사용자 자동 온보딩 시작:', user.email);
        const onboardingResult = await ensureUserExists(user);

        if (!onboardingResult.success) {
          console.error('Auto-onboarding failed:', onboardingResult.error);
          return ApiResponse.errorWithCode(ErrorCode.USER_NOT_FOUND, "사용자 생성에 실패했습니다", onboardingResult.error);
        }

        // 다시 사용자 데이터 조회
        const { data: newUserData, error: retryError } = await supabase
          .from('user')
          .select('id, email, name, avatarUrl, role')
          .eq('id', user.id)
          .single();

        if (!newUserData || retryError) {
          console.error('Failed to fetch user after onboarding:', retryError);
          return ApiResponse.errorWithCode(ErrorCode.USER_NOT_FOUND, undefined, retryError?.message);
        }

        userData = newUserData;
        console.log('✅ 신규 사용자 자동 온보딩 완료');
      }

      // 인증된 요청 객체 생성
      const authenticatedReq = Object.assign(req, {
        user,
        userData
      }) as AuthenticatedRequest;

      // 핸들러 실행
      return await handler(authenticatedReq);

    } catch (error) {
      console.error('Authentication middleware error:', error);
      return ApiResponse.errorWithCode(
        ErrorCode.SERVER_ERROR, 
        "인증 처리 중 오류가 발생했습니다", 
        String(error)
      );
    }
  };
}

/**
 * 사용자의 관리자 권한 확인
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: userData, error } = await supabase
      .from('user')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !userData) {
      console.error('Error checking admin status:', error);
      return false;
    }

    return userData.role === 'ADMIN';
  } catch (error) {
    console.error('Error in isUserAdmin:', error);
    return false;
  }
}

/**
 * 관리자 권한 확인 미들웨어
 */
export function withAdminAuth<T = any>(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse<ApiResponse<T>>>
) {
  return withAuth<T>(async (req: AuthenticatedRequest) => {
    // 관리자 권한 확인
    if (req.userData.role !== 'ADMIN') {
      return ApiResponse.forbidden("관리자 권한이 필요합니다");
    }

    return handler(req);
  });
}

/**
 * 프로젝트 소유권 확인 미들웨어
 */
export function withProjectAuth<T = any>(
  handler: (req: AuthenticatedRequest, projectId: string) => Promise<NextResponse<ApiResponse<T>>>,
  getProjectIdFromReq: (req: NextRequest) => string
) {
  return withAuth<T>(async (req: AuthenticatedRequest) => {
    try {
      const projectId = getProjectIdFromReq(req);
      
      if (!projectId) {
        return ApiResponse.badRequest("프로젝트 ID가 필요합니다");
      }

      // 프로젝트 소유권 확인
      const supabase = await createClient();
      const { data: project, error } = await supabase
        .from('project')
        .select('id, userId')
        .eq('id', projectId)
        .eq('userId', req.userData.id)
        .single();

      if (!project || error) {
        return ApiResponse.forbidden("프로젝트에 대한 접근 권한이 없습니다");
      }

      return handler(req, projectId);

    } catch (error) {
      console.error('Project auth middleware error:', error);
      return ApiResponse.errorWithCode(
        ErrorCode.SERVER_ERROR, 
        "프로젝트 권한 확인 중 오류가 발생했습니다", 
        String(error)
      );
    }
  });
}

/**
 * 표준화된 API 응답 헬퍼 (개선된 에러 처리)
 */
export class ApiResponse {
  static success<T>(data: T, status: number = 200): NextResponse<ApiResponse<T>> {
    return NextResponse.json<ApiResponse<T>>({ success: true, data }, { status });
  }

  /**
   * 에러 코드를 사용한 표준화된 에러 응답
   */
  static errorWithCode(errorCode: ErrorCode, customMessage?: string, details?: string): NextResponse<ApiResponse> {
    const errorDetails = getErrorDetails(errorCode);
    
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: customMessage || errorDetails.userMessage,
      errorCode: errorCode,
      details: process.env.NODE_ENV === 'development' ? (details || errorDetails.developerMessage) : undefined,
      actionable: errorDetails.actionable,
      retryable: errorDetails.retryable,
      suggestedAction: errorDetails.suggestedAction
    }, { status: errorDetails.httpStatus });
  }

  /**
   * 기존 호환성을 위한 일반 에러 응답
   */
  static error(message: string, status: number = 500, details?: string): NextResponse<ApiResponse> {
    const errorCode = inferErrorCode(status);
    const errorDetails = getErrorDetails(errorCode);
    
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: message,
      errorCode: errorCode,
      details: process.env.NODE_ENV === 'development' ? details : undefined,
      actionable: errorDetails.actionable,
      retryable: errorDetails.retryable,
      suggestedAction: errorDetails.suggestedAction
    }, { status });
  }

  // 특정 에러 타입별 편의 메서드들
  static unauthorized(customMessage?: string): NextResponse<ApiResponse> {
    return this.errorWithCode(ErrorCode.UNAUTHORIZED, customMessage);
  }

  static forbidden(customMessage?: string): NextResponse<ApiResponse> {
    return this.errorWithCode(ErrorCode.FORBIDDEN, customMessage);
  }

  static notFound(resource: string = "리소스"): NextResponse<ApiResponse> {
    return this.errorWithCode(ErrorCode.RESOURCE_NOT_FOUND, `${resource}를 찾을 수 없습니다`);
  }

  static badRequest(customMessage?: string): NextResponse<ApiResponse> {
    return this.errorWithCode(ErrorCode.VALIDATION_ERROR, customMessage);
  }

  static insufficientStorage(customMessage?: string): NextResponse<ApiResponse> {
    return this.errorWithCode(ErrorCode.STORAGE_FULL, customMessage);
  }

  static paymentRequired(customMessage?: string): NextResponse<ApiResponse> {
    return this.errorWithCode(ErrorCode.INSUFFICIENT_TOKENS, customMessage);
  }

  static tooManyRequests(customMessage?: string): NextResponse<ApiResponse> {
    return this.errorWithCode(ErrorCode.RATE_LIMIT_EXCEEDED, customMessage);
  }

  static aiServiceError(customMessage?: string): NextResponse<ApiResponse> {
    return this.errorWithCode(ErrorCode.AI_SERVICE_ERROR, customMessage);
  }

  static generationTimeout(customMessage?: string): NextResponse<ApiResponse> {
    return this.errorWithCode(ErrorCode.GENERATION_TIMEOUT, customMessage);
  }

  static uploadFailed(customMessage?: string): NextResponse<ApiResponse> {
    return this.errorWithCode(ErrorCode.UPLOAD_FAILED, customMessage);
  }

  static subscriptionExpired(customMessage?: string): NextResponse<ApiResponse> {
    return this.errorWithCode(ErrorCode.SUBSCRIPTION_EXPIRED, customMessage);
  }
}