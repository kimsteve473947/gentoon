-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 구독 플랜 enum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PERSONAL', 'HEAVY', 'ENTERPRISE');

-- 프로젝트 상태 enum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'PUBLISHED', 'ARCHIVED');

-- 거래 유형 enum
CREATE TYPE "TransactionType" AS ENUM ('SUBSCRIPTION', 'TOKEN_PURCHASE', 'REFUND', 'REFERRAL_REWARD');

-- 거래 상태 enum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- 사용자 테이블 (Supabase Auth와 연동)
CREATE TABLE "user" (
    "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "id" UUID UNIQUE NOT NULL, -- Supabase Auth의 user.id
    "email" TEXT UNIQUE NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "referralCode" UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    "referredBy" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 구독 테이블
CREATE TABLE "subscription" (
    "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "userId" UUID UNIQUE NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "plan" "SubscriptionPlan" DEFAULT 'FREE',
    "tokensTotal" INTEGER DEFAULT 0,
    "tokensUsed" INTEGER DEFAULT 0,
    "maxCharacters" INTEGER DEFAULT 1,
    "maxProjects" INTEGER DEFAULT 3,
    "tossBillingKey" TEXT,
    "tossCustomerKey" TEXT,
    "tossCustomerId" TEXT,
    "tossSubscriptionId" TEXT,
    "currentPeriodStart" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "currentPeriodEnd" TIMESTAMP WITH TIME ZONE NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN DEFAULT FALSE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 캐릭터 테이블
CREATE TABLE "character" (
    "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "userId" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "styleGuide" TEXT,
    "referenceImages" JSONB NOT NULL, -- URL 배열
    "thumbnailUrl" TEXT,
    "isPublic" BOOLEAN DEFAULT FALSE,
    "isFavorite" BOOLEAN DEFAULT FALSE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 프로젝트 테이블
CREATE TABLE "project" (
    "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "userId" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "status" "ProjectStatus" DEFAULT 'DRAFT',
    "isPublic" BOOLEAN DEFAULT FALSE,
    "metadata" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "publishedAt" TIMESTAMP WITH TIME ZONE
);

-- 프로젝트-캐릭터 관계 테이블
CREATE TABLE "project_character" (
    "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "projectId" UUID NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
    "characterId" UUID NOT NULL REFERENCES "character"("id") ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE("projectId", "characterId")
);

-- 패널 테이블 (웹툰의 각 컷)
CREATE TABLE "panel" (
    "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "projectId" UUID NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
    "order" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "imageUrl" TEXT,
    "editData" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE("projectId", "order")
);

-- AI 생성 기록 테이블
CREATE TABLE "generation" (
    "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "userId" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "projectId" UUID REFERENCES "project"("id") ON DELETE SET NULL,
    "panelId" UUID UNIQUE REFERENCES "panel"("id") ON DELETE SET NULL,
    "characterId" UUID REFERENCES "character"("id") ON DELETE SET NULL,
    "prompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "model" TEXT DEFAULT 'gemini-2-5-flash-image-preview',
    "tokensUsed" INTEGER DEFAULT 2,
    "generationTime" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 거래 내역 테이블
CREATE TABLE "transaction" (
    "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "userId" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "type" "TransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "tokens" INTEGER,
    "tossPaymentKey" TEXT,
    "tossOrderId" TEXT,
    "status" "TransactionStatus" DEFAULT 'PENDING',
    "description" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 추천인 보상 기록 테이블
CREATE TABLE "referral_reward" (
    "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "referrerId" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "referredId" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "tokensRewarded" INTEGER DEFAULT 50,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE("referrerId", "referredId")
);

-- 인덱스 생성
CREATE INDEX "user_id_idx" ON "user"("id");
CREATE INDEX "user_email_idx" ON "user"("email");
CREATE INDEX "subscription_userId_idx" ON "subscription"("userId");
CREATE INDEX "character_userId_idx" ON "character"("userId");
CREATE INDEX "project_userId_idx" ON "project"("userId");
CREATE INDEX "project_status_idx" ON "project"("status");
CREATE INDEX "Projectcharacter_projectId_idx" ON "project_character"("projectId");
CREATE INDEX "Projectcharacter_characterId_idx" ON "project_character"("characterId");
CREATE INDEX "panel_projectId_idx" ON "panel"("projectId");
CREATE INDEX "generation_userId_idx" ON "generation"("userId");
CREATE INDEX "generation_projectId_idx" ON "generation"("projectId");
CREATE INDEX "transaction_userId_idx" ON "transaction"("userId");
CREATE INDEX "transaction_status_idx" ON "transaction"("status");
CREATE INDEX "referral_reward_referrerId_idx" ON "referral_reward"("referrerId");
CREATE INDEX "referral_reward_referredId_idx" ON "referral_reward"("referredId");

-- 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 업데이트 트리거 적용
CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "user" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_subscription_updated_at BEFORE UPDATE ON "subscription" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_character_updated_at BEFORE UPDATE ON "character" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_project_updated_at BEFORE UPDATE ON "project" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_panel_updated_at BEFORE UPDATE ON "panel" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_transaction_updated_at BEFORE UPDATE ON "transaction" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();