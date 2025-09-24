/**
 * 프론트엔드 전역 에러 처리 시스템
 * API 응답과 네트워크 에러를 사용자 친화적으로 처리
 */

import { toast } from 'sonner';
import { ErrorCode, getErrorDetails } from './error-types';
import { ApiResponse } from '../auth/api-middleware';

export interface ErrorHandlerOptions {
  showToast?: boolean; // 토스트 메시지 표시 여부
  logToConsole?: boolean; // 콘솔 로그 여부
  customMessage?: string; // 커스텀 메시지
  onRetry?: () => void | Promise<void>; // 재시도 콜백
  onUpgrade?: () => void; // 업그레이드 콜백 (토큰 부족 등)
  onRedirectLogin?: () => void; // 로그인 리디렉션 콜백
}

/**
 * API 에러 처리 메인 함수
 */
export async function handleApiError(
  error: any, 
  options: ErrorHandlerOptions = {}
): Promise<{
  shouldRetry: boolean;
  shouldUpgrade: boolean;
  shouldLogin: boolean;
  userMessage: string;
  actionable: boolean;
}> {
  const {
    showToast = true,
    logToConsole = true,
    customMessage,
    onRetry,
    onUpgrade,
    onRedirectLogin
  } = options;

  let errorCode: ErrorCode;
  let userMessage: string;
  let actionable: boolean = false;
  let retryable: boolean = false;
  let shouldUpgrade: boolean = false;
  let shouldLogin: boolean = false;
  let suggestedAction: string = '';

  try {
    // Response 객체인 경우 JSON 파싱
    if (error instanceof Response) {
      const errorData: ApiResponse = await error.json();
      errorCode = errorData.errorCode || ErrorCode.SERVER_ERROR;
      userMessage = customMessage || errorData.error || '알 수 없는 오류가 발생했습니다';
      actionable = errorData.actionable ?? false;
      retryable = errorData.retryable ?? false;
      suggestedAction = errorData.suggestedAction || '';
      
      if (logToConsole) {
        console.error('API Error:', errorData);
      }
    }
    // 이미 파싱된 API 응답인 경우
    else if (error && typeof error === 'object' && 'errorCode' in error) {
      const errorData = error as ApiResponse;
      errorCode = errorData.errorCode || ErrorCode.SERVER_ERROR;
      userMessage = customMessage || errorData.error || '알 수 없는 오류가 발생했습니다';
      actionable = errorData.actionable ?? false;
      retryable = errorData.retryable ?? false;
      suggestedAction = errorData.suggestedAction || '';
    }
    // 네트워크 에러나 기타 에러
    else if (error instanceof Error) {
      // AbortError (타임아웃)
      if (error.name === 'AbortError') {
        errorCode = ErrorCode.TIMEOUT;
      }
      // TypeError (네트워크 에러)
      else if (error instanceof TypeError && error.message.includes('fetch')) {
        errorCode = ErrorCode.NETWORK_ERROR;
      }
      // 기타 JavaScript 에러
      else {
        errorCode = ErrorCode.SERVER_ERROR;
      }
      
      const errorDetails = getErrorDetails(errorCode);
      userMessage = customMessage || errorDetails.userMessage;
      actionable = errorDetails.actionable;
      retryable = errorDetails.retryable;
      suggestedAction = errorDetails.suggestedAction;
      
      if (logToConsole) {
        console.error('Network/JS Error:', error);
      }
    }
    // 기타 알 수 없는 에러
    else {
      errorCode = ErrorCode.SERVER_ERROR;
      const errorDetails = getErrorDetails(errorCode);
      userMessage = customMessage || errorDetails.userMessage;
      actionable = errorDetails.actionable;
      retryable = errorDetails.retryable;
      suggestedAction = errorDetails.suggestedAction;
      
      if (logToConsole) {
        console.error('Unknown Error:', error);
      }
    }

    // 특수 처리가 필요한 에러 타입들
    switch (errorCode) {
      case ErrorCode.UNAUTHORIZED:
      case ErrorCode.SESSION_EXPIRED:
        shouldLogin = true;
        if (onRedirectLogin) {
          onRedirectLogin();
        }
        break;
        
      case ErrorCode.INSUFFICIENT_TOKENS:
      case ErrorCode.SUBSCRIPTION_EXPIRED:
      case ErrorCode.CHARACTER_LIMIT_EXCEEDED:
      case ErrorCode.STORAGE_FULL:
        shouldUpgrade = true;
        if (onUpgrade) {
          onUpgrade();
        }
        break;
    }

    // 토스트 메시지 표시
    if (showToast) {
      const toastMessage = userMessage + (suggestedAction ? `\n${suggestedAction}` : '');
      
      // 에러 유형에 따른 토스트 스타일
      if (shouldLogin) {
        toast.error(toastMessage, {
          duration: 8000,
          action: onRedirectLogin ? {
            label: '로그인',
            onClick: onRedirectLogin
          } : undefined
        });
      } else if (shouldUpgrade) {
        toast.warning(toastMessage, {
          duration: 8000,
          action: onUpgrade ? {
            label: '업그레이드',
            onClick: onUpgrade
          } : undefined
        });
      } else if (retryable && onRetry) {
        toast.error(toastMessage, {
          duration: 6000,
          action: {
            label: '다시 시도',
            onClick: onRetry
          }
        });
      } else {
        toast.error(toastMessage, {
          duration: actionable ? 6000 : 4000
        });
      }
    }

    return {
      shouldRetry: retryable,
      shouldUpgrade,
      shouldLogin,
      userMessage,
      actionable
    };

  } catch (parsingError) {
    // 에러 파싱 자체가 실패한 경우
    console.error('Error parsing API error:', parsingError);
    const fallbackMessage = customMessage || '예상치 못한 오류가 발생했습니다';
    
    if (showToast) {
      toast.error(fallbackMessage);
    }
    
    return {
      shouldRetry: false,
      shouldUpgrade: false,
      shouldLogin: false,
      userMessage: fallbackMessage,
      actionable: false
    };
  }
}

/**
 * API fetch 요청을 위한 래퍼 함수 (자동 에러 처리 포함)
 */
export async function fetchWithErrorHandling(
  url: string, 
  options: RequestInit = {}, 
  errorOptions: ErrorHandlerOptions = {}
): Promise<Response> {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      await handleApiError(response, errorOptions);
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response;
  } catch (error) {
    await handleApiError(error, errorOptions);
    throw error;
  }
}

/**
 * 자동 재시도가 포함된 fetch 함수
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  errorOptions: ErrorHandlerOptions = {},
  maxRetries: number = 2,
  retryDelay: number = 1000
): Promise<Response> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.ok) {
        return response;
      }
      
      // 마지막 시도이거나 재시도 불가능한 에러인 경우
      if (attempt === maxRetries) {
        const errorResult = await handleApiError(response, {
          ...errorOptions,
          showToast: attempt === maxRetries // 마지막 시도에만 토스트 표시
        });
        
        if (!errorResult.shouldRetry) {
          throw new Error(`HTTP ${response.status}`);
        }
      }
      
      lastError = response;
      
    } catch (error) {
      lastError = error;
      
      // 마지막 시도이거나 재시도 불가능한 에러인 경우
      if (attempt === maxRetries) {
        const errorResult = await handleApiError(error, {
          ...errorOptions,
          showToast: attempt === maxRetries
        });
        
        if (!errorResult.shouldRetry) {
          throw error;
        }
      }
    }
    
    // 재시도 전 대기
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
    }
  }
  
  throw lastError;
}

/**
 * 토큰 부족 에러 전용 처리 함수
 */
export function handleTokenError(onUpgrade?: () => void) {
  return handleApiError({
    errorCode: ErrorCode.INSUFFICIENT_TOKENS,
    error: getErrorDetails(ErrorCode.INSUFFICIENT_TOKENS).userMessage,
    actionable: true,
    retryable: false,
    suggestedAction: getErrorDetails(ErrorCode.INSUFFICIENT_TOKENS).suggestedAction
  }, {
    onUpgrade,
    showToast: true
  });
}

/**
 * 인증 에러 전용 처리 함수
 */
export function handleAuthError(onRedirectLogin?: () => void) {
  return handleApiError({
    errorCode: ErrorCode.UNAUTHORIZED,
    error: getErrorDetails(ErrorCode.UNAUTHORIZED).userMessage,
    actionable: true,
    retryable: false,
    suggestedAction: getErrorDetails(ErrorCode.UNAUTHORIZED).suggestedAction
  }, {
    onRedirectLogin,
    showToast: true
  });
}