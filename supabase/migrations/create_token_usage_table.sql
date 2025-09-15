-- 토큰 사용량 추적 테이블 생성
CREATE TABLE IF NOT EXISTS token_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID REFERENCES "user"(id) ON DELETE CASCADE,
    service_type VARCHAR(50) NOT NULL CHECK (service_type IN ('text_generation', 'image_generation')),
    model_name VARCHAR(100) NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0, 
    total_tokens INTEGER NOT NULL DEFAULT 0,
    api_cost DECIMAL(10,6) DEFAULT 0.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_token_usage_user_date 
ON token_usage ("userId", created_at DESC);

CREATE INDEX IF NOT EXISTS idx_token_usage_service_type 
ON token_usage (service_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_token_usage_model 
ON token_usage (model_name, created_at DESC);

-- 사용자 토큰 차감 함수 (기존 함수 개선)
CREATE OR REPLACE FUNCTION deduct_user_tokens(user_id UUID, tokens_used INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    current_balance INTEGER;
BEGIN
    -- 현재 잔액 조회 및 업데이트
    UPDATE "user" 
    SET balance = balance - tokens_used,
        "updatedAt" = NOW()
    WHERE id = user_id 
    AND balance >= tokens_used
    RETURNING balance INTO current_balance;
    
    -- 업데이트 성공 여부 확인
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient token balance or user not found';
    END IF;
    
    -- 로그 기록
    INSERT INTO "user_activity" ("userId", activity_type, details, "createdAt")
    VALUES (user_id, 'token_usage', 
           jsonb_build_object('tokens_used', tokens_used, 'remaining_balance', current_balance),
           NOW());
    
    RETURN TRUE;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to deduct tokens: %', SQLERRM;
END;
$$;

-- 사용자별 토큰 통계 함수
CREATE OR REPLACE FUNCTION get_user_token_stats(user_id UUID, days_back INTEGER DEFAULT 30)
RETURNS TABLE (
    service_type VARCHAR(50),
    model_name VARCHAR(100),
    total_requests BIGINT,
    total_tokens BIGINT,
    total_cost DECIMAL(10,6),
    avg_tokens_per_request DECIMAL(10,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tu.service_type,
        tu.model_name,
        COUNT(*)::BIGINT as total_requests,
        SUM(tu.total_tokens)::BIGINT as total_tokens,
        SUM(tu.api_cost)::DECIMAL(10,6) as total_cost,
        ROUND(AVG(tu.total_tokens), 2) as avg_tokens_per_request
    FROM token_usage tu
    WHERE tu."userId" = user_id
    AND tu.created_at >= NOW() - (days_back || ' days')::INTERVAL
    GROUP BY tu.service_type, tu.model_name
    ORDER BY total_tokens DESC;
END;
$$;

-- RLS (Row Level Security) 활성화
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 토큰 사용량만 조회 가능
CREATE POLICY token_usage_user_policy ON token_usage
    FOR SELECT USING (
        "userId" = (SELECT id FROM "user" WHERE "id" = auth.uid())
    );

-- 서비스는 모든 토큰 사용량 기록 가능 (서버에서만)
CREATE POLICY token_usage_service_policy ON token_usage
    FOR INSERT WITH CHECK (true);

-- 코멘트 추가
COMMENT ON TABLE token_usage IS '실제 AI API 토큰 사용량 추적 테이블';
COMMENT ON COLUMN token_usage.service_type IS 'text_generation | image_generation';
COMMENT ON COLUMN token_usage.model_name IS 'Google AI 모델명 (gemini-2.0-flash-exp 등)';
COMMENT ON COLUMN token_usage.prompt_tokens IS 'API 입력 토큰 수';
COMMENT ON COLUMN token_usage.completion_tokens IS 'API 출력 토큰 수';
COMMENT ON COLUMN token_usage.total_tokens IS 'API 총 토큰 수 (실제 차감 기준)';
COMMENT ON COLUMN token_usage.api_cost IS 'Google AI API 실제 비용 ($)';
COMMENT ON COLUMN token_usage.metadata IS '요청 타입, 프롬프트 길이 등 추가 정보';