-- 🚀 사용자별 스토리지 사용량 추적 테이블 생성
-- Canva/Miro 스타일의 실시간 DB 사용량 관리

CREATE TABLE "user_storage" (
    "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "user_id" UUID UNIQUE NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "used_bytes" BIGINT DEFAULT 0,
    "file_count" INTEGER DEFAULT 0,
    "max_bytes" BIGINT DEFAULT 1073741824, -- 기본 1GB (1 * 1024 * 1024 * 1024)
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX "user_storage_user_id_idx" ON "user_storage"("user_id");
CREATE INDEX "user_storage_used_bytes_idx" ON "user_storage"("used_bytes");

-- 업데이트 트리거 적용
CREATE TRIGGER update_user_storage_updated_at 
BEFORE UPDATE ON "user_storage" 
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 기존 사용자들에 대해 기본 스토리지 레코드 생성
INSERT INTO "user_storage" ("user_id", "used_bytes", "file_count", "max_bytes")
SELECT 
    "id",
    0,
    0,
    1073741824 -- 1GB
FROM "user"
ON CONFLICT ("user_id") DO NOTHING;