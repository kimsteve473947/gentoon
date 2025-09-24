// API 요청에 대한 타임아웃과 재시도 로직을 제공하는 유틸리티 (개선된 에러 처리 포함)

import { handleApiError, ErrorHandlerOptions } from '@/lib/errors/error-handler';

interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number; // 타임아웃 (밀리초)
  retries?: number; // 재시도 횟수
  retryDelay?: number; // 재시도 간격 (밀리초)
  errorHandler?: ErrorHandlerOptions; // 에러 처리 옵션
  silentRetry?: boolean; // 재시도 중 조용히 처리 (토스트 안보이게)
}

/**
 * 타임아웃과 재시도 기능이 있는 fetch 함수
 */
export async function fetchWithTimeout(
  url: string, 
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { 
    timeout = 300000, // 기본 5분
    retries = 1,
    retryDelay = 1000,
    errorHandler = {},
    silentRetry = true,
    ...fetchOptions 
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      // HTTP 에러 상태에 대한 처리
      if (!response.ok) {
        // 마지막 시도이거나 재시도하지 않는 경우에만 에러 핸들링
        if (attempt === retries) {
          await handleApiError(response, {
            ...errorHandler,
            showToast: errorHandler.showToast !== false, // 기본적으로 토스트 표시
            logToConsole: true
          });
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;

    } catch (error) {
      lastError = error as Error;
      
      // AbortError는 타임아웃을 의미함
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(`API 요청 타임아웃 (${timeout/1000}초): ${url}`);
        lastError = new Error(`요청이 ${timeout/1000}초 내에 완료되지 않았습니다.`);
      }

      // 마지막 시도가 아니면 재시도
      if (attempt < retries) {
        console.log(`재시도 ${attempt + 1}/${retries} (${retryDelay}ms 후): ${url}`);
        
        // 재시도 중에는 조용히 처리 (silentRetry가 true인 경우)
        if (!silentRetry) {
          await handleApiError(lastError, {
            ...errorHandler,
            showToast: false,
            logToConsole: true
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }
      
      // 마지막 시도에서 실패한 경우 에러 핸들링
      await handleApiError(lastError, {
        ...errorHandler,
        showToast: errorHandler.showToast !== false,
        logToConsole: true
      });
      
      break;
    }
  }

  throw lastError || new Error('Unknown fetch error');
}

/**
 * AI 이미지 생성용 특화 fetch (더 긴 타임아웃)
 */
export async function fetchAIGenerate(
  url: string, 
  options: RequestInit = {}, 
  errorHandler: ErrorHandlerOptions = {}
) {
  return fetchWithTimeout(url, {
    ...options,
    timeout: 300000, // 5분
    retries: 0, // AI 생성은 재시도하지 않음 (토큰 중복 소모 방지)
    errorHandler: {
      customMessage: 'AI 이미지 생성 중 오류가 발생했습니다',
      ...errorHandler
    }
  });
}

/**
 * AI 스크립트 생성용 특화 fetch
 */
export async function fetchAIScript(
  url: string, 
  options: RequestInit = {},
  errorHandler: ErrorHandlerOptions = {}
) {
  return fetchWithTimeout(url, {
    ...options,
    timeout: 180000, // 3분
    retries: 1, // 스크립트는 재시도 가능
    retryDelay: 2000,
    errorHandler: {
      customMessage: 'AI 스크립트 생성 중 오류가 발생했습니다',
      ...errorHandler
    }
  });
}

/**
 * 일반 API 요청용 fetch
 */
export async function fetchAPI(
  url: string, 
  options: RequestInit = {},
  errorHandler: ErrorHandlerOptions = {}
) {
  return fetchWithTimeout(url, {
    ...options,
    timeout: 30000, // 30초
    retries: 2,
    retryDelay: 1000,
    silentRetry: true,
    errorHandler
  });
}

/**
 * 데이터 내보내기용 fetch (매우 긴 타임아웃)
 */
export async function fetchExport(
  url: string, 
  options: RequestInit = {},
  errorHandler: ErrorHandlerOptions = {}
) {
  return fetchWithTimeout(url, {
    ...options,
    timeout: 600000, // 10분
    retries: 0, // 내보내기는 재시도하지 않음
    errorHandler: {
      customMessage: '데이터 내보내기 중 오류가 발생했습니다',
      ...errorHandler
    }
  });
}

/**
 * 결제 관련 API용 특화 fetch (높은 신뢰성 필요)
 */
export async function fetchPayment(
  url: string,
  options: RequestInit = {},
  errorHandler: ErrorHandlerOptions = {}
) {
  return fetchWithTimeout(url, {
    ...options,
    timeout: 60000, // 1분
    retries: 3, // 결제는 3번까지 재시도
    retryDelay: 2000,
    silentRetry: false, // 결제 재시도는 사용자에게 알림
    errorHandler: {
      customMessage: '결제 처리 중 오류가 발생했습니다',
      ...errorHandler
    }
  });
}

/**
 * 파일 업로드용 특화 fetch
 */
export async function fetchUpload(
  url: string,
  options: RequestInit = {},
  errorHandler: ErrorHandlerOptions = {}
) {
  return fetchWithTimeout(url, {
    ...options,
    timeout: 120000, // 2분
    retries: 1,
    retryDelay: 3000,
    errorHandler: {
      customMessage: '파일 업로드 중 오류가 발생했습니다',
      ...errorHandler
    }
  });
}