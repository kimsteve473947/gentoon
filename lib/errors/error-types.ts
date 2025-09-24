/**
 * 사용자 친화적인 에러 타입과 메시지 정의
 * 프로덕션 환경에서 명확하고 도움이 되는 에러 메시지 제공
 */

export enum ErrorCode {
  // 인증 관련
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // 사용자/데이터 관련
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // 구독/결제 관련
  INSUFFICIENT_TOKENS = 'INSUFFICIENT_TOKENS',
  SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  INVALID_PLAN = 'INVALID_PLAN',
  
  // 저장소 관련
  STORAGE_FULL = 'STORAGE_FULL',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  
  // AI 생성 관련
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  GENERATION_TIMEOUT = 'GENERATION_TIMEOUT',
  INVALID_PROMPT = 'INVALID_PROMPT',
  CHARACTER_LIMIT_EXCEEDED = 'CHARACTER_LIMIT_EXCEEDED',
  
  // 네트워크/시스템 관련
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

export interface ErrorDetails {
  code: ErrorCode;
  userMessage: string; // 사용자에게 보여줄 메시지
  developerMessage: string; // 개발자용 메시지
  httpStatus: number;
  actionable?: boolean; // 사용자가 해결할 수 있는 에러인지
  retryable?: boolean; // 재시도 가능한 에러인지
  suggestedAction?: string; // 권장 조치
}

/**
 * 에러 코드별 상세 정보 매핑
 */
export const ERROR_DETAILS: Record<ErrorCode, ErrorDetails> = {
  [ErrorCode.UNAUTHORIZED]: {
    code: ErrorCode.UNAUTHORIZED,
    userMessage: '로그인이 필요합니다. 다시 로그인해주세요.',
    developerMessage: 'User authentication required',
    httpStatus: 401,
    actionable: true,
    retryable: false,
    suggestedAction: '페이지를 새로고침하거나 다시 로그인해주세요.'
  },
  
  [ErrorCode.FORBIDDEN]: {
    code: ErrorCode.FORBIDDEN,
    userMessage: '이 작업을 수행할 권한이 없습니다.',
    developerMessage: 'Insufficient permissions for this operation',
    httpStatus: 403,
    actionable: false,
    retryable: false,
    suggestedAction: '관리자에게 문의하거나 멤버십을 업그레이드하세요.'
  },
  
  [ErrorCode.SESSION_EXPIRED]: {
    code: ErrorCode.SESSION_EXPIRED,
    userMessage: '세션이 만료되었습니다. 다시 로그인해주세요.',
    developerMessage: 'User session has expired',
    httpStatus: 401,
    actionable: true,
    retryable: false,
    suggestedAction: '페이지를 새로고침하여 다시 로그인해주세요.'
  },
  
  [ErrorCode.USER_NOT_FOUND]: {
    code: ErrorCode.USER_NOT_FOUND,
    userMessage: '사용자 정보를 찾을 수 없습니다.',
    developerMessage: 'User not found in database',
    httpStatus: 404,
    actionable: true,
    retryable: false,
    suggestedAction: '계정 설정을 확인하거나 고객지원팀에 문의하세요.'
  },
  
  [ErrorCode.RESOURCE_NOT_FOUND]: {
    code: ErrorCode.RESOURCE_NOT_FOUND,
    userMessage: '요청한 리소스를 찾을 수 없습니다.',
    developerMessage: 'Requested resource not found',
    httpStatus: 404,
    actionable: false,
    retryable: false,
    suggestedAction: '다른 항목을 선택하거나 페이지를 새로고침해주세요.'
  },
  
  [ErrorCode.VALIDATION_ERROR]: {
    code: ErrorCode.VALIDATION_ERROR,
    userMessage: '입력 정보를 다시 확인해주세요.',
    developerMessage: 'Request validation failed',
    httpStatus: 400,
    actionable: true,
    retryable: false,
    suggestedAction: '모든 필드를 올바르게 입력했는지 확인해주세요.'
  },
  
  [ErrorCode.INSUFFICIENT_TOKENS]: {
    code: ErrorCode.INSUFFICIENT_TOKENS,
    userMessage: '토큰이 부족합니다. 멤버십을 업그레이드하거나 토큰을 구매하세요.',
    developerMessage: 'Insufficient tokens for operation',
    httpStatus: 402,
    actionable: true,
    retryable: false,
    suggestedAction: '멤버십 페이지에서 플랜을 업그레이드하세요.'
  },
  
  [ErrorCode.SUBSCRIPTION_EXPIRED]: {
    code: ErrorCode.SUBSCRIPTION_EXPIRED,
    userMessage: '구독이 만료되었습니다. 멤버십을 갱신해주세요.',
    developerMessage: 'User subscription has expired',
    httpStatus: 402,
    actionable: true,
    retryable: false,
    suggestedAction: '멤버십 페이지에서 구독을 갱신하세요.'
  },
  
  [ErrorCode.PAYMENT_FAILED]: {
    code: ErrorCode.PAYMENT_FAILED,
    userMessage: '결제 처리에 실패했습니다. 결제 정보를 확인해주세요.',
    developerMessage: 'Payment processing failed',
    httpStatus: 402,
    actionable: true,
    retryable: true,
    suggestedAction: '결제 정보를 확인하고 다시 시도하거나 다른 결제 방법을 선택하세요.'
  },
  
  [ErrorCode.INVALID_PLAN]: {
    code: ErrorCode.INVALID_PLAN,
    userMessage: '선택한 플랜이 유효하지 않습니다.',
    developerMessage: 'Invalid subscription plan selected',
    httpStatus: 400,
    actionable: true,
    retryable: false,
    suggestedAction: '다른 멤버십 플랜을 선택해주세요.'
  },
  
  [ErrorCode.STORAGE_FULL]: {
    code: ErrorCode.STORAGE_FULL,
    userMessage: '저장 공간이 부족합니다. 파일을 삭제하거나 멤버십을 업그레이드하세요.',
    developerMessage: 'User storage quota exceeded',
    httpStatus: 507,
    actionable: true,
    retryable: false,
    suggestedAction: '불필요한 프로젝트나 파일을 삭제하거나 멤버십을 업그레이드하세요.'
  },
  
  [ErrorCode.FILE_TOO_LARGE]: {
    code: ErrorCode.FILE_TOO_LARGE,
    userMessage: '파일 크기가 너무 큽니다. 더 작은 파일을 업로드해주세요.',
    developerMessage: 'File size exceeds maximum allowed size',
    httpStatus: 413,
    actionable: true,
    retryable: false,
    suggestedAction: '파일 크기를 줄이거나 다른 파일을 선택해주세요.'
  },
  
  [ErrorCode.UPLOAD_FAILED]: {
    code: ErrorCode.UPLOAD_FAILED,
    userMessage: '파일 업로드에 실패했습니다. 네트워크 연결을 확인하고 다시 시도해주세요.',
    developerMessage: 'File upload failed',
    httpStatus: 500,
    actionable: true,
    retryable: true,
    suggestedAction: '네트워크 연결을 확인하고 다시 시도해주세요.'
  },
  
  [ErrorCode.AI_SERVICE_ERROR]: {
    code: ErrorCode.AI_SERVICE_ERROR,
    userMessage: 'AI 서비스에서 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
    developerMessage: 'AI service error occurred',
    httpStatus: 503,
    actionable: true,
    retryable: true,
    suggestedAction: '몇 분 후에 다시 시도하거나, 프롬프트를 다르게 작성해보세요.'
  },
  
  [ErrorCode.GENERATION_TIMEOUT]: {
    code: ErrorCode.GENERATION_TIMEOUT,
    userMessage: '이미지 생성이 시간을 초과했습니다. 더 간단한 프롬프트로 다시 시도해주세요.',
    developerMessage: 'AI generation timed out',
    httpStatus: 408,
    actionable: true,
    retryable: true,
    suggestedAction: '프롬프트를 간소화하고 다시 시도해보세요.'
  },
  
  [ErrorCode.INVALID_PROMPT]: {
    code: ErrorCode.INVALID_PROMPT,
    userMessage: '프롬프트 내용에 문제가 있습니다. 다른 내용으로 다시 시도해주세요.',
    developerMessage: 'Invalid or inappropriate prompt content',
    httpStatus: 400,
    actionable: true,
    retryable: false,
    suggestedAction: '프롬프트 내용을 수정하여 다시 시도해주세요.'
  },
  
  [ErrorCode.CHARACTER_LIMIT_EXCEEDED]: {
    code: ErrorCode.CHARACTER_LIMIT_EXCEEDED,
    userMessage: '캐릭터 생성 개수가 한도를 초과했습니다. 멤버십을 업그레이드하세요.',
    developerMessage: 'Character limit exceeded for current plan',
    httpStatus: 402,
    actionable: true,
    retryable: false,
    suggestedAction: '기존 캐릭터를 삭제하거나 멤버십을 업그레이드하세요.'
  },
  
  [ErrorCode.NETWORK_ERROR]: {
    code: ErrorCode.NETWORK_ERROR,
    userMessage: '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.',
    developerMessage: 'Network connectivity issue',
    httpStatus: 0,
    actionable: true,
    retryable: true,
    suggestedAction: '인터넷 연결을 확인하고 페이지를 새로고침해주세요.'
  },
  
  [ErrorCode.SERVER_ERROR]: {
    code: ErrorCode.SERVER_ERROR,
    userMessage: '서버에서 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
    developerMessage: 'Internal server error',
    httpStatus: 500,
    actionable: true,
    retryable: true,
    suggestedAction: '몇 분 후에 다시 시도하거나 고객지원팀에 문의하세요.'
  },
  
  [ErrorCode.SERVICE_UNAVAILABLE]: {
    code: ErrorCode.SERVICE_UNAVAILABLE,
    userMessage: '서비스가 일시적으로 이용할 수 없습니다. 잠시 후 다시 시도해주세요.',
    developerMessage: 'Service temporarily unavailable',
    httpStatus: 503,
    actionable: true,
    retryable: true,
    suggestedAction: '서비스 상태 페이지를 확인하거나 잠시 후 다시 시도해주세요.'
  },
  
  [ErrorCode.TIMEOUT]: {
    code: ErrorCode.TIMEOUT,
    userMessage: '요청 처리 시간이 초과되었습니다. 다시 시도해주세요.',
    developerMessage: 'Request timeout',
    httpStatus: 408,
    actionable: true,
    retryable: true,
    suggestedAction: '잠시 후 다시 시도하거나 더 간단한 작업으로 나누어 시도해주세요.'
  },
  
  [ErrorCode.RATE_LIMIT_EXCEEDED]: {
    code: ErrorCode.RATE_LIMIT_EXCEEDED,
    userMessage: '요청 횟수가 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
    developerMessage: 'Rate limit exceeded',
    httpStatus: 429,
    actionable: true,
    retryable: true,
    suggestedAction: '몇 분 후에 다시 시도하거나 멤버십을 업그레이드하세요.'
  },
};

/**
 * 에러 코드로 에러 정보 조회
 */
export function getErrorDetails(code: ErrorCode): ErrorDetails {
  return ERROR_DETAILS[code] || ERROR_DETAILS[ErrorCode.SERVER_ERROR];
}

/**
 * HTTP 상태 코드로 적절한 에러 코드 추론
 */
export function inferErrorCode(httpStatus: number): ErrorCode {
  switch (httpStatus) {
    case 400:
      return ErrorCode.VALIDATION_ERROR;
    case 401:
      return ErrorCode.UNAUTHORIZED;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 404:
      return ErrorCode.RESOURCE_NOT_FOUND;
    case 402:
      return ErrorCode.PAYMENT_FAILED;
    case 408:
      return ErrorCode.TIMEOUT;
    case 413:
      return ErrorCode.FILE_TOO_LARGE;
    case 429:
      return ErrorCode.RATE_LIMIT_EXCEEDED;
    case 503:
      return ErrorCode.SERVICE_UNAVAILABLE;
    case 507:
      return ErrorCode.STORAGE_FULL;
    default:
      return ErrorCode.SERVER_ERROR;
  }
}