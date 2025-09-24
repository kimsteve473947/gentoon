-- Add token reset tracking fields to subscription table
ALTER TABLE "subscription"
ADD COLUMN "tokensResetDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "nextTokensReset" TIMESTAMP(3);

-- Update existing subscriptions to have initial token reset dates
UPDATE "subscription" 
SET "nextTokensReset" = "currentPeriodStart" + INTERVAL '30 days'
WHERE "nextTokensReset" IS NULL;

-- Make nextTokensReset column required
ALTER TABLE "subscription" 
ALTER COLUMN "nextTokensReset" SET NOT NULL;