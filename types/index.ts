// 사용자 관련 타입
export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  referralCode: string;
  referredBy?: string;
}

// 구독 관련 타입 (새로운 4티어 구조)
export enum SubscriptionPlan {
  FREE = "FREE",
  STARTER = "STARTER",
  PRO = "PRO",
  PREMIUM = "PREMIUM",
  ADMIN = "ADMIN",
}

export interface Subscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  tokensTotal: number;
  tokensUsed: number;
  maxCharacters: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

// 캐릭터 관련 타입
export interface Character {
  id: string;
  userId: string;
  name: string;
  description: string;
  styleGuide?: string;
  referenceImages: string[];
  thumbnailUrl?: string;
  isPublic: boolean;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 프로젝트 관련 타입
export enum ProjectStatus {
  DRAFT = "DRAFT",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
}

export interface Project {
  id: string;
  userId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  status: ProjectStatus;
  isPublic: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

// 패널 관련 타입
export interface Panel {
  id: string;
  projectId: string;
  order: number;
  prompt: string;
  imageUrl?: string;
  editData?: {
    bubbles?: SpeechBubble[];
    effects?: TextEffect[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface SpeechBubble {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style: "normal" | "thought" | "shout";
}

export interface TextEffect {
  id: string;
  text: string;
  x: number;
  y: number;
  style: string;
  fontSize: number;
}

// AI 생성 관련 타입
export interface Generation {
  id: string;
  userId: string;
  projectId?: string;
  panelId?: string;
  characterId?: string;
  prompt: string;
  negativePrompt?: string;
  imageUrl: string;
  thumbnailUrl?: string;
  model: string;
  tokensUsed: number;
  generationTime?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// 거래 관련 타입
export enum TransactionType {
  SUBSCRIPTION = "SUBSCRIPTION",
  TOKEN_PURCHASE = "TOKEN_PURCHASE",
  REFUND = "REFUND",
  REFERRAL_REWARD = "REFERRAL_REWARD",
}

export enum TransactionStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  tokens?: number;
  tossPaymentKey?: string;
  tossOrderId?: string;
  status: TransactionStatus;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// API 응답 타입
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 프롬프트 관련 타입
export interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  variables: string[];
  category: string;
}

// 이미지 생성 요청 타입
export interface GenerateImageRequest {
  prompt: string;
  negativePrompt?: string;
  characterIds?: string[];
  projectId?: string;
  panelId?: string;
  settings?: {
    style?: string;
    aspectRatio?: string;
    quality?: "standard" | "high";
  };
}

// 이미지 생성 응답 타입
export interface GenerateImageResponse {
  imageUrl: string;
  thumbnailUrl: string;
  tokensUsed: number;
  generationId: string;
}