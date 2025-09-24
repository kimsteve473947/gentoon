/**
 * API별 보안 수준 설정
 * 네이버급 보안을 위한 세밀한 제어
 */

import { SecurityLevel } from './rate-limiter';

export interface APISecurityConfig {
  securityLevel: SecurityLevel;
  requiresAuth: boolean;
  allowedMethods: string[];
  customRateLimit?: {
    windowMs: number;
    maxRequests: number;
    blockDuration: number;
  };
  ipWhitelist?: string[];  // 특정 IP만 허용 (관리자 API 등)
  geoRestriction?: boolean; // 지역 제한 활성화
  requiresCaptcha?: boolean; // Captcha 필요 여부
  description: string;
}

// API 경로별 보안 설정
export const API_SECURITY_RULES: Record<string, APISecurityConfig> = {
  // ===== CRITICAL: AI 생성 API =====
  '/api/ai/generate': {
    securityLevel: SecurityLevel.CRITICAL,
    requiresAuth: true,
    allowedMethods: ['POST'],
    customRateLimit: {
      windowMs: 60 * 1000,      // 1분
      maxRequests: 2,           // 분당 2회 (더 엄격)
      blockDuration: 20 * 60 * 1000 // 20분 차단
    },
    requiresCaptcha: true,
    description: 'AI 이미지 생성 - 최고 보안'
  },
  '/api/ai/character/generate': {
    securityLevel: SecurityLevel.CRITICAL,
    requiresAuth: true,
    allowedMethods: ['POST'],
    description: 'AI 캐릭터 생성'
  },
  '/api/ai/generate-script': {
    securityLevel: SecurityLevel.CRITICAL,
    requiresAuth: true,
    allowedMethods: ['POST'],
    description: 'AI 스크립트 생성'
  },
  '/api/ai/generate/queue-status': {
    securityLevel: SecurityLevel.HIGH, // 조회는 HIGH로
    requiresAuth: true,
    allowedMethods: ['GET'],
    description: 'AI 생성 큐 상태 조회'
  },

  // ===== HIGH: 관리자 API =====
  '/api/admin/stats': {
    securityLevel: SecurityLevel.HIGH,
    requiresAuth: true,
    allowedMethods: ['GET'],
    ipWhitelist: [
      '118.47.0.0/16',  // 개발팀 사무실 IP 예시
      '127.0.0.1'       // 로컬 개발
    ],
    geoRestriction: true,
    description: '관리자 통계'
  },
  '/api/admin/users': {
    securityLevel: SecurityLevel.HIGH,
    requiresAuth: true,
    allowedMethods: ['GET'],
    description: '사용자 관리'
  },
  '/api/admin/coupons': {
    securityLevel: SecurityLevel.HIGH,
    requiresAuth: true,
    allowedMethods: ['GET', 'POST'],
    description: '쿠폰 관리'
  },

  // ===== HIGH: 결제 API =====
  '/api/payments/subscribe': {
    securityLevel: SecurityLevel.HIGH,
    requiresAuth: true,
    allowedMethods: ['POST'],
    customRateLimit: {
      windowMs: 60 * 1000,
      maxRequests: 5,         // 분당 5회 결제 시도
      blockDuration: 10 * 60 * 1000 // 10분 차단
    },
    description: '구독 결제'
  },
  '/api/payments/webhook': {
    securityLevel: SecurityLevel.HIGH,
    requiresAuth: false, // 토스페이먼츠에서 호출
    allowedMethods: ['POST'],
    ipWhitelist: [
      '52.78.100.19',   // 토스페이먼츠 공식 IP 1
      '52.78.48.223',   // 토스페이먼츠 공식 IP 2  
      '52.78.5.241'     // 토스페이먼츠 공식 IP 3
    ],
    description: '토스페이먼츠 웹훅'
  },

  // ===== MEDIUM: 파일 업로드 =====
  '/api/storage/upload': {
    securityLevel: SecurityLevel.MEDIUM,
    requiresAuth: true,
    allowedMethods: ['POST', 'GET'],
    customRateLimit: {
      windowMs: 60 * 1000,
      maxRequests: 15,        // 분당 15개 파일
      blockDuration: 5 * 60 * 1000 // 5분 차단
    },
    description: '파일 업로드'
  },
  '/api/upload-avatar': {
    securityLevel: SecurityLevel.MEDIUM,
    requiresAuth: true,
    allowedMethods: ['POST'],
    customRateLimit: {
      windowMs: 5 * 60 * 1000,  // 5분
      maxRequests: 3,           // 5분에 3회
      blockDuration: 10 * 60 * 1000
    },
    description: '아바타 업로드'
  },

  // ===== MEDIUM: 프로젝트 관리 =====
  '/api/studio/save-project': {
    securityLevel: SecurityLevel.MEDIUM,
    requiresAuth: true,
    allowedMethods: ['POST'],
    customRateLimit: {
      windowMs: 60 * 1000,
      maxRequests: 30,          // 자주 저장할 수 있도록
      blockDuration: 2 * 60 * 1000
    },
    description: '프로젝트 저장'
  },

  // ===== NORMAL: 일반 API =====
  '/api/dashboard/': {
    securityLevel: SecurityLevel.NORMAL,
    requiresAuth: true,
    allowedMethods: ['GET'],
    description: '대시보드 조회'
  },
  '/api/characters': {
    securityLevel: SecurityLevel.NORMAL,
    requiresAuth: true,
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    description: '캐릭터 관리'
  },
  '/api/webtoon': {
    securityLevel: SecurityLevel.NORMAL,
    requiresAuth: false, // 공개 조회
    allowedMethods: ['GET'],
    description: '웹툰 갤러리'
  },

  // ===== 특별 처리: 개발/테스트 API =====
  '/api/test/': {
    securityLevel: SecurityLevel.NORMAL,
    requiresAuth: false,
    allowedMethods: ['GET', 'POST'],
    description: '테스트 API'
  },
  '/api/health': {
    securityLevel: SecurityLevel.NORMAL,
    requiresAuth: false,
    allowedMethods: ['GET'],
    description: '헬스체크'
  }
};

/**
 * 경로 매칭을 통한 보안 설정 조회
 */
export function getSecurityConfig(path: string): APISecurityConfig | null {
  // 정확한 매칭 우선
  if (API_SECURITY_RULES[path]) {
    return API_SECURITY_RULES[path];
  }

  // 패턴 매칭 (우선순위: 구체적인 것부터)
  const sortedRules = Object.keys(API_SECURITY_RULES)
    .sort((a, b) => b.length - a.length);

  for (const pattern of sortedRules) {
    // 와일드카드 매칭
    if (pattern.endsWith('/') && path.startsWith(pattern)) {
      return API_SECURITY_RULES[pattern];
    }
    
    // 동적 경로 매칭 (/api/admin/users/[id] 형태)
    const dynamicPattern = pattern.replace(/\[.*?\]/g, '[^/]+');
    const regex = new RegExp(`^${dynamicPattern.replace(/\//g, '\\/')}$`);
    if (regex.test(path)) {
      return API_SECURITY_RULES[pattern];
    }
  }

  // 기본 설정
  return {
    securityLevel: SecurityLevel.NORMAL,
    requiresAuth: false,
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    description: '기본 API'
  };
}

/**
 * 개발 환경에서의 보안 완화
 */
export function isDevelopmentMode(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * IP 화이트리스트 확인
 */
export function isIPWhitelisted(ip: string, whitelist?: string[]): boolean {
  if (!whitelist || whitelist.length === 0) return true;
  
  // 로컬 IP는 항상 허용
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.')) {
    return true;
  }

  // 화이트리스트 확인 (CIDR 표기법 지원)
  return whitelist.some(allowed => {
    if (allowed.includes('/')) {
      // CIDR 범위 확인 (간단 구현)
      const [network, prefixLen] = allowed.split('/');
      // 실제 구현에서는 CIDR 계산 라이브러리 사용 권장
      return ip.startsWith(network.split('.').slice(0, 2).join('.'));
    } else {
      return ip === allowed;
    }
  });
}

/**
 * 보안 통계 조회
 */
export function getSecurityStats(): {
  totalEndpoints: number;
  criticalEndpoints: number;
  highEndpoints: number;
  mediumEndpoints: number;
  normalEndpoints: number;
} {
  const rules = Object.values(API_SECURITY_RULES);
  
  return {
    totalEndpoints: rules.length,
    criticalEndpoints: rules.filter(r => r.securityLevel === SecurityLevel.CRITICAL).length,
    highEndpoints: rules.filter(r => r.securityLevel === SecurityLevel.HIGH).length,
    mediumEndpoints: rules.filter(r => r.securityLevel === SecurityLevel.MEDIUM).length,
    normalEndpoints: rules.filter(r => r.securityLevel === SecurityLevel.NORMAL).length
  };
}