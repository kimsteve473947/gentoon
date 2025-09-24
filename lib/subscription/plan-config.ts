/**
 * 🎯 멤버십 플랜 중앙 관리 시스템
 * - 모든 멤버십 관련 설정값을 한 곳에서 관리
 * - token-manager.ts 설정값을 기준으로 통일
 */

export interface PlanConfig {
  name: string;
  price: number;                    // 월 요금 (원)
  platformTokens: number;          // 플랫폼 토큰 (이미지 생성용)
  maxImages: number;               // 월 이미지 생성 한도
  maxCharacters: number;           // 캐릭터 생성 한도
  maxElements: number;             // 요소 생성 한도
  estimatedCost: number;           // 예상 원가
  profit: number;                  // 수익 마진
  storageLimit: number;            // 스토리지 제한 (바이트)
  features: string[];              // 플랜 특징
}

// 🎯 통일된 멤버십 설정 (token-manager.ts 기준)
export const PLAN_CONFIGS = {
  FREE: {
    name: '무료',
    price: 0,
    platformTokens: 10000,           // 1만 토큰
    maxImages: 8,                    // 약 7-8장 이미지 생성 가능
    maxCharacters: 2,                // 캐릭터 2개
    maxElements: 2,                  // 요소 2개
    estimatedCost: 520,              // 예상 원가 (8 × 65원)
    profit: -520,                    // 무료 플랜
    storageLimit: 300 * 1024 * 1024, // 300MB
    features: [
      '월 8장 이미지 생성',
      '캐릭터 2개 등록',
      '요소 2개 등록',
      '300MB 스토리지',
      '기본 템플릿 사용'
    ]
  },
  PRO: {
    name: '베이직',
    price: 30000,
    platformTokens: 400000,          // 40만 토큰
    maxImages: 310,                  // 약 310장 이미지 생성 가능
    maxCharacters: 7,                // 캐릭터 7개
    maxElements: 7,                  // 요소 7개
    estimatedCost: 16000,            // 예상 원가 (310 × 52원)
    profit: 14000,                   // 수익 마진
    storageLimit: 5 * 1024 * 1024 * 1024, // 5GB
    features: [
      '월 310장 이미지 생성',
      '캐릭터 7개 등록',
      '요소 7개 등록',
      '5GB 스토리지',
      '고급 템플릿 사용',
      '우선 지원'
    ]
  },
  PREMIUM: {
    name: '프로',
    price: 100000,
    platformTokens: 1500000,         // 150만 토큰
    maxImages: 1163,                 // 약 1,163장 이미지 생성 가능
    maxCharacters: 15,               // 캐릭터 15개
    maxElements: 15,                 // 요소 15개
    estimatedCost: 60000,            // 예상 원가 (1163 × 52원)
    profit: 40000,                   // 수익 마진
    storageLimit: 20 * 1024 * 1024 * 1024, // 20GB
    features: [
      '월 1,163장 이미지 생성',
      '캐릭터 15개 등록',
      '요소 15개 등록',
      '20GB 스토리지',
      '전체 템플릿 사용',
      '전용 지원',
      'API 접근'
    ]
  },
  ADMIN: {
    name: '관리자',
    price: 0,
    platformTokens: 999999999,       // 무제한 토큰
    maxImages: 999999999,            // 무제한 이미지 생성
    maxCharacters: 999,              // 무제한 캐릭터
    maxElements: 999,                // 무제한 요소
    estimatedCost: 0,                // 관리자는 비용 없음
    profit: 0,                       // 관리자 계정
    storageLimit: 1000 * 1024 * 1024 * 1024, // 1TB
    features: [
      '무제한 이미지 생성',
      '무제한 캐릭터',
      '무제한 요소',
      '1TB 스토리지',
      '모든 기능 접근',
      '시스템 관리 권한'
    ]
  }
} as const satisfies Record<string, PlanConfig>;

export type PlanType = keyof typeof PLAN_CONFIGS;

/**
 * 플랜 설정 조회
 */
export function getPlanConfig(plan: PlanType): PlanConfig {
  return PLAN_CONFIGS[plan];
}

/**
 * 모든 플랜 목록 조회 (관리자 제외)
 */
export function getPublicPlans(): PlanConfig[] {
  return [
    PLAN_CONFIGS.FREE,
    PLAN_CONFIGS.PRO,
    PLAN_CONFIGS.PREMIUM
  ];
}

/**
 * 플랜 업그레이드 가능한 옵션 조회
 */
export function getUpgradeOptions(currentPlan: PlanType): PlanConfig[] {
  const plans = Object.keys(PLAN_CONFIGS) as PlanType[];
  const currentIndex = plans.indexOf(currentPlan);
  
  if (currentIndex === -1 || currentPlan === 'ADMIN') {
    return [];
  }
  
  return plans.slice(currentIndex + 1)
    .filter(plan => plan !== 'ADMIN')
    .map(plan => PLAN_CONFIGS[plan]);
}

/**
 * 스토리지 제한 조회 (기존 호환성)
 */
export const STORAGE_LIMITS = {
  FREE: PLAN_CONFIGS.FREE.storageLimit,
  PRO: PLAN_CONFIGS.PRO.storageLimit,
  PREMIUM: PLAN_CONFIGS.PREMIUM.storageLimit,
  ADMIN: PLAN_CONFIGS.ADMIN.storageLimit
} as const;