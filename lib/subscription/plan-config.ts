/**
 * 🎯 멤버십 플랜 중앙 관리 시스템
 * - 모든 멤버십 관련 설정값을 한 곳에서 관리
 * - token-manager.ts 설정값을 기준으로 통일
 */

export interface PlanConfig {
  name: string;
  price: number;                    // 월 요금 (원)
  imageTokens: number;             // 이미지 생성용 토큰
  scriptGenerations: number;       // AI 대본 생성 횟수 (단순 횟수 기반)
  textTokens: number;              // @deprecated - 하위 호환성용
  platformTokens: number;          // @deprecated - 하위 호환성용
  maxCharacters: number;           // 캐릭터 생성 한도
  maxElements: number;             // 요소 생성 한도
  storageLimit: number;            // 스토리지 제한 (바이트)
  features: string[];              // 플랜 특징
}

// 🎯 통일된 멤버십 설정 (새로운 4티어 구조)
export const PLAN_CONFIGS = {
  FREE: {
    name: '무료',
    price: 0,
    imageTokens: 8000,              // 8천 토큰 (8장 이미지)
    scriptGenerations: 15,          // 월 15회 AI 대본 생성 (단순 횟수)
    textTokens: 30000,              // @deprecated - 하위 호환성용
    platformTokens: 8000,           // @deprecated - 하위 호환성
    maxCharacters: 2,                // 캐릭터 2개
    maxElements: 2,                  // 요소 2개
    storageLimit: 300 * 1024 * 1024, // 300MB
    features: [
      '월 8장 이미지 생성',
      '월 15회 AI 대본 생성',
      '캐릭터 2개 등록',
      '요소 2개 등록',
      '300MB 스토리지',
      '기본 템플릿 사용'
    ]
  },
  STARTER: {
    name: '스타터',
    price: 29000,
    imageTokens: 350000,             // 35만 토큰 (270장 이미지)
    scriptGenerations: 100,          // 월 100회 AI 대본 생성 (단순 횟수)
    textTokens: 200000,              // @deprecated - 하위 호환성용
    platformTokens: 350000,          // @deprecated - 하위 호환성
    maxCharacters: 5,                // 캐릭터 5개
    maxElements: 5,                  // 요소 5개
    storageLimit: 3 * 1024 * 1024 * 1024, // 3GB
    features: [
      '월 270장 이미지 생성',
      '월 100회 AI 대본 생성',
      '캐릭터 5개 등록',
      '요소 5개 등록',
      '3GB 스토리지',
      '개인 작업 및 인스타툰 등',
      '개인 사용자에게 적합해요'
    ]
  },
  PRO: {
    name: '프로',
    price: 59000,
    imageTokens: 700000,             // 70만 토큰 (540장 이미지)
    scriptGenerations: 300,          // 월 300회 AI 대본 생성 (단순 횟수)
    textTokens: 600000,              // @deprecated - 하위 호환성용
    platformTokens: 700000,          // @deprecated - 하위 호환성
    maxCharacters: 10,               // 캐릭터 10개
    maxElements: 10,                 // 요소 10개
    storageLimit: 8 * 1024 * 1024 * 1024, // 8GB
    features: [
      '월 540장 이미지 생성',
      '월 300회 AI 대본 생성',
      '캐릭터 10개 등록',
      '요소 10개 등록',
      '8GB 스토리지',
      '고도화된 이미지 작업이 필요한',
      '기업 실무자에게 적합해요'
    ]
  },
  PREMIUM: {
    name: '프리미엄',
    price: 99000,
    imageTokens: 1200000,            // 120만 토큰 (930장 이미지) 
    scriptGenerations: 1000,         // 월 1000회 AI 대본 생성 (단순 횟수)
    textTokens: 2000000,             // @deprecated - 하위 호환성용
    platformTokens: 1200000,         // @deprecated - 하위 호환성
    maxCharacters: 20,               // 캐릭터 20개
    maxElements: 20,                 // 요소 20개
    storageLimit: 20 * 1024 * 1024 * 1024, // 20GB
    features: [
      '월 930장 이미지 생성',
      '월 1000회 AI 대본 생성',
      '캐릭터 20개 등록',
      '요소 20개 등록',
      '20GB 스토리지',
      '대량 작업이 필요한',
      '전문 제작자에게 적합해요'
    ]
  },
  ADMIN: {
    name: '관리자',
    price: 0,
    imageTokens: 999999999,          // 무제한 이미지 토큰
    scriptGenerations: 999999,       // 무제한 AI 대본 생성
    textTokens: 999999999,           // @deprecated - 하위 호환성용
    platformTokens: 999999999,       // @deprecated - 하위 호환성
    maxCharacters: 999,              // 무제한 캐릭터
    maxElements: 999,                // 무제한 요소
    storageLimit: 1000 * 1024 * 1024 * 1024, // 1TB
    features: [
      '무제한 이미지 생성',
      '무제한 대본 생성',
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
    PLAN_CONFIGS.STARTER,
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
  STARTER: PLAN_CONFIGS.STARTER.storageLimit,
  PRO: PLAN_CONFIGS.PRO.storageLimit,
  PREMIUM: PLAN_CONFIGS.PREMIUM.storageLimit,
  ADMIN: PLAN_CONFIGS.ADMIN.storageLimit
} as const;

/**
 * 통합된 구독 플랜 설정 (결제 시스템용)
 */
export const SUBSCRIPTION_PLANS = {
  FREE: {
    id: "FREE" as const,
    name: PLAN_CONFIGS.FREE.name,
    price: PLAN_CONFIGS.FREE.price,
    tokens: PLAN_CONFIGS.FREE.platformTokens,
    characters: PLAN_CONFIGS.FREE.maxCharacters,
    maxElements: PLAN_CONFIGS.FREE.maxElements,
    projects: 3,
    description: PLAN_CONFIGS.FREE.features.join(', '),
  },
  STARTER: {
    id: "STARTER" as const,
    name: PLAN_CONFIGS.STARTER.name,
    price: PLAN_CONFIGS.STARTER.price,
    tokens: PLAN_CONFIGS.STARTER.platformTokens,
    characters: PLAN_CONFIGS.STARTER.maxCharacters,
    maxElements: PLAN_CONFIGS.STARTER.maxElements,
    projects: 10,
    description: PLAN_CONFIGS.STARTER.features.join(', '),
  },
  PRO: {
    id: "PRO" as const,
    name: PLAN_CONFIGS.PRO.name,
    price: PLAN_CONFIGS.PRO.price,
    tokens: PLAN_CONFIGS.PRO.platformTokens,
    characters: PLAN_CONFIGS.PRO.maxCharacters,
    maxElements: PLAN_CONFIGS.PRO.maxElements,
    projects: 25,
    description: PLAN_CONFIGS.PRO.features.join(', '),
  },
  PREMIUM: {
    id: "PREMIUM" as const,
    name: PLAN_CONFIGS.PREMIUM.name,
    price: PLAN_CONFIGS.PREMIUM.price,
    tokens: PLAN_CONFIGS.PREMIUM.platformTokens,
    characters: PLAN_CONFIGS.PREMIUM.maxCharacters,
    maxElements: PLAN_CONFIGS.PREMIUM.maxElements,
    projects: 50,
    description: PLAN_CONFIGS.PREMIUM.features.join(', '),
  },
  ADMIN: {
    id: "ADMIN" as const,
    name: PLAN_CONFIGS.ADMIN.name,
    price: PLAN_CONFIGS.ADMIN.price,
    tokens: PLAN_CONFIGS.ADMIN.platformTokens,
    characters: PLAN_CONFIGS.ADMIN.maxCharacters,
    maxElements: PLAN_CONFIGS.ADMIN.maxElements,
    projects: 999,
    description: PLAN_CONFIGS.ADMIN.features.join(', '),
  }
} as const;