-- ========================================
-- USER TABLE RLS POLICIES
-- ========================================
-- Note: Prisma uses 'user' table, but initial migration used 'profiles'
-- This ensures both tables have proper RLS policies

-- Enable RLS on user table
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;

-- Users can view their own user record
CREATE POLICY "Users can view own user record" ON "user"
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own user record
CREATE POLICY "Users can update own user record" ON "user"
  FOR UPDATE USING (auth.uid() = id);

-- Admin users can view all user records (using subscription plan check)
CREATE POLICY "Admin can view all users" ON "user"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM subscription
      WHERE subscription."userId" = auth.uid()
      AND subscription.plan = 'ADMIN'
    )
  );

-- Admin users can update all user records
CREATE POLICY "Admin can update all users" ON "user"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM subscription
      WHERE subscription."userId" = auth.uid()
      AND subscription.plan = 'ADMIN'
    )
  );

-- Service role can bypass RLS entirely (for admin operations)
-- This is handled via createServiceClient() with SUPABASE_SERVICE_ROLE_KEY
