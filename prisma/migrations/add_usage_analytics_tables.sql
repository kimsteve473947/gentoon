-- 사용량 통계를 위한 최적화된 테이블 추가

-- 일일 사용량 집계 테이블 (성능 최적화)
CREATE TABLE IF NOT EXISTS "daily_usage_stats" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "tokens_used" INTEGER NOT NULL DEFAULT 0,
  "images_generated" INTEGER NOT NULL DEFAULT 0,
  "characters_created" INTEGER NOT NULL DEFAULT 0,
  "projects_created" INTEGER NOT NULL DEFAULT 0,
  "storage_bytes_added" BIGINT NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 사용자별 현재 사용량 캐시 테이블 (빠른 조회를 위한)
CREATE TABLE IF NOT EXISTS "user_usage_cache" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL UNIQUE,
  "current_month_tokens" INTEGER NOT NULL DEFAULT 0,
  "current_month_images" INTEGER NOT NULL DEFAULT 0,
  "total_characters" INTEGER NOT NULL DEFAULT 0,
  "total_projects" INTEGER NOT NULL DEFAULT 0,
  "storage_used_bytes" BIGINT NOT NULL DEFAULT 0,
  "storage_limit_bytes" BIGINT NOT NULL DEFAULT 1073741824,
  "last_calculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS "daily_usage_stats_user_date_idx" ON "daily_usage_stats"("user_id", "date" DESC);
CREATE INDEX IF NOT EXISTS "daily_usage_stats_date_idx" ON "daily_usage_stats"("date" DESC);
CREATE INDEX IF NOT EXISTS "user_usage_cache_user_id_idx" ON "user_usage_cache"("user_id");
CREATE INDEX IF NOT EXISTS "user_usage_cache_last_calculated_idx" ON "user_usage_cache"("last_calculated" DESC);

-- 외래 키 추가
ALTER TABLE "daily_usage_stats" ADD CONSTRAINT "daily_usage_stats_user_id_fkey" 
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_usage_cache" ADD CONSTRAINT "user_usage_cache_user_id_fkey" 
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 중복 방지를 위한 unique constraint
ALTER TABLE "daily_usage_stats" ADD CONSTRAINT "daily_usage_stats_user_date_unique" 
  UNIQUE ("user_id", "date");

-- 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_daily_usage_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Generation 테이블 변경 시 일일 통계 업데이트
  IF TG_TABLE_NAME = 'generation' THEN
    INSERT INTO daily_usage_stats (user_id, date, tokens_used, images_generated)
    VALUES (NEW.user_id, NEW.created_at::date, NEW.tokens_used, 1)
    ON CONFLICT (user_id, date)
    DO UPDATE SET
      tokens_used = daily_usage_stats.tokens_used + NEW.tokens_used,
      images_generated = daily_usage_stats.images_generated + 1,
      updated_at = CURRENT_TIMESTAMP;
    
    -- 사용자 캐시 업데이트
    INSERT INTO user_usage_cache (user_id, current_month_tokens, current_month_images)
    SELECT NEW.user_id, 
           COALESCE(SUM(tokens_used), 0) as tokens,
           COALESCE(SUM(images_generated), 0) as images
    FROM daily_usage_stats 
    WHERE user_id = NEW.user_id 
      AND date >= date_trunc('month', CURRENT_DATE)
    ON CONFLICT (user_id)
    DO UPDATE SET
      current_month_tokens = EXCLUDED.current_month_tokens,
      current_month_images = EXCLUDED.current_month_images,
      last_calculated = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_daily_usage_stats ON generation;
CREATE TRIGGER trigger_update_daily_usage_stats
  AFTER INSERT ON generation
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_usage_stats();

-- 초기 데이터 마이그레이션 (기존 generation 데이터로부터 통계 생성)
INSERT INTO daily_usage_stats (user_id, date, tokens_used, images_generated, created_at, updated_at)
SELECT 
  user_id,
  created_at::date as date,
  SUM(tokens_used) as tokens_used,
  COUNT(*) as images_generated,
  MIN(created_at) as created_at,
  MAX(created_at) as updated_at
FROM generation
GROUP BY user_id, created_at::date
ON CONFLICT (user_id, date) DO NOTHING;

-- 초기 사용자 캐시 데이터 생성
INSERT INTO user_usage_cache (
  user_id, 
  current_month_tokens, 
  current_month_images, 
  total_characters, 
  total_projects,
  storage_used_bytes,
  storage_limit_bytes
)
SELECT 
  u.id as user_id,
  COALESCE(monthly_stats.tokens, 0) as current_month_tokens,
  COALESCE(monthly_stats.images, 0) as current_month_images,
  COALESCE(character_count.total, 0) as total_characters,
  COALESCE(project_count.total, 0) as total_projects,
  COALESCE(storage.used_bytes, 0) as storage_used_bytes,
  COALESCE(storage.max_bytes, 1073741824) as storage_limit_bytes
FROM "user" u
LEFT JOIN (
  SELECT 
    user_id,
    SUM(tokens_used) as tokens,
    SUM(images_generated) as images
  FROM daily_usage_stats
  WHERE date >= date_trunc('month', CURRENT_DATE)
  GROUP BY user_id
) monthly_stats ON u.id = monthly_stats.user_id
LEFT JOIN (
  SELECT user_id, COUNT(*) as total
  FROM character
  GROUP BY user_id
) character_count ON u.id = character_count.user_id
LEFT JOIN (
  SELECT user_id, COUNT(*) as total
  FROM project
  WHERE deleted_at IS NULL
  GROUP BY user_id
) project_count ON u.id = project_count.user_id
LEFT JOIN user_storage storage ON u.id = storage.userId
ON CONFLICT (user_id) DO UPDATE SET
  current_month_tokens = EXCLUDED.current_month_tokens,
  current_month_images = EXCLUDED.current_month_images,
  total_characters = EXCLUDED.total_characters,
  total_projects = EXCLUDED.total_projects,
  storage_used_bytes = EXCLUDED.storage_used_bytes,
  storage_limit_bytes = EXCLUDED.storage_limit_bytes,
  last_calculated = CURRENT_TIMESTAMP,
  updated_at = CURRENT_TIMESTAMP;