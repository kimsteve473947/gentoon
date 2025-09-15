import { createClient } from "@/lib/supabase/server";

// 간단한 토큰 추적 시스템 - Auth ID 직접 사용
interface SimpleTokenUsage {
  authId: string; // Supabase auth.uid() 직접 사용
  serviceType: 'text_generation' | 'image_generation';
  modelName: string;
  totalTokens: number;
  apiCost?: number;
  metadata?: Record<string, any>;
}

// Google AI API 모델 정보
export const AI_MODELS = {
  TEXT_GENERATION: 'gemini-2.0-flash-exp',
  IMAGE_GENERATION: 'gemini-2-5-flash-image-preview'
} as const;

// 토큰 비용 계산
export const TOKEN_COSTS = {
  [AI_MODELS.TEXT_GENERATION]: {
    input: 0.000075,
    output: 0.0003
  },
  [AI_MODELS.IMAGE_GENERATION]: {
    input: 0.0025,
    output: 0.01
  }
} as const;

/**
 * 🎯 간단한 토큰 사용량 기록 - Auth ID 직접 사용
 */
export async function recordSimpleTokenUsage({
  authId,
  serviceType,
  modelName,
  totalTokens,
  apiCost = 0,
  metadata = {}
}: SimpleTokenUsage) {
  const supabase = await createClient();
  
  try {
    console.log(`📊 간단한 토큰 사용량 기록:`, {
      authId: authId.substring(0, 8) + '...',
      serviceType,
      modelName,
      totalTokens
    });

    // 1. token_usage 테이블에 직접 기록 (Auth ID 사용)
    const { error: usageError } = await supabase
      .from('token_usage')
      .insert({
        userId: authId, // Auth ID를 userId 필드에 직접 저장
        service_type: serviceType,
        model_name: modelName,
        prompt_tokens: Math.floor(totalTokens * 0.7), // 추정값
        completion_tokens: Math.floor(totalTokens * 0.3), // 추정값
        total_tokens: totalTokens,
        api_cost: apiCost,
        metadata,
        created_at: new Date().toISOString()
      });

    if (usageError) {
      console.error('❌ 토큰 사용량 기록 실패:', usageError);
      throw usageError;
    }

    console.log(`✅ 토큰 사용량 기록 성공: ${totalTokens} 토큰`);
    
    return {
      success: true,
      tokensUsed: totalTokens,
      cost: apiCost
    };

  } catch (error) {
    console.error('❌ 간단한 토큰 사용량 기록 실패:', error);
    throw new Error('토큰 사용량 기록 실패');
  }
}

/**
 * 🔍 사용자별 토큰 통계 조회 - Auth ID 직접 사용
 */
export async function getSimpleTokenStats(authId: string, days: number = 30) {
  const supabase = await createClient();
  
  const { data: stats } = await supabase
    .from('token_usage')
    .select(`
      service_type,
      model_name,
      total_tokens,
      api_cost,
      created_at
    `)
    .eq('userId', authId) // Auth ID로 직접 조회
    .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  if (!stats) return null;

  // 서비스별 통계 계산
  const textGeneration = stats.filter(s => s.service_type === 'text_generation');
  const imageGeneration = stats.filter(s => s.service_type === 'image_generation');

  return {
    totalRequests: stats.length,
    totalTokens: stats.reduce((sum, s) => sum + s.total_tokens, 0),
    totalCost: stats.reduce((sum, s) => sum + (s.api_cost || 0), 0),
    textGeneration: {
      requests: textGeneration.length,
      tokens: textGeneration.reduce((sum, s) => sum + s.total_tokens, 0),
      cost: textGeneration.reduce((sum, s) => sum + (s.api_cost || 0), 0)
    },
    imageGeneration: {
      requests: imageGeneration.length,
      tokens: imageGeneration.reduce((sum, s) => sum + s.total_tokens, 0),
      cost: imageGeneration.reduce((sum, s) => sum + (s.api_cost || 0), 0)
    },
    dailyStats: groupByDay(stats)
  };
}

/**
 * 📊 관리자용 - 모든 사용자 토큰 통계
 */
export async function getAllUsersTokenStats(days: number = 30) {
  const supabase = await createClient();
  
  const { data: stats } = await supabase
    .from('token_usage')
    .select(`
      userId,
      service_type,
      model_name,
      total_tokens,
      api_cost,
      created_at
    `)
    .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  if (!stats) return {};

  // 사용자별로 그룹화
  const userStats = stats.reduce((acc, stat) => {
    const authId = stat.userId;
    
    if (!acc[authId]) {
      acc[authId] = {
        authId,
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        textGeneration: { requests: 0, tokens: 0, cost: 0 },
        imageGeneration: { requests: 0, tokens: 0, cost: 0 }
      };
    }

    const user = acc[authId];
    user.totalRequests += 1;
    user.totalTokens += stat.total_tokens;
    user.totalCost += stat.api_cost || 0;

    if (stat.service_type === 'text_generation') {
      user.textGeneration.requests += 1;
      user.textGeneration.tokens += stat.total_tokens;
      user.textGeneration.cost += stat.api_cost || 0;
    } else {
      user.imageGeneration.requests += 1;
      user.imageGeneration.tokens += stat.total_tokens;
      user.imageGeneration.cost += stat.api_cost || 0;
    }

    return acc;
  }, {} as Record<string, any>);

  return userStats;
}

/**
 * 일별 통계 그룹화
 */
function groupByDay(stats: any[]) {
  const dailyMap = new Map();
  
  stats.forEach(stat => {
    const date = stat.created_at.split('T')[0];
    
    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        date,
        textTokens: 0,
        imageTokens: 0,
        totalTokens: 0,
        requests: 0
      });
    }
    
    const day = dailyMap.get(date);
    day.requests++;
    day.totalTokens += stat.total_tokens;
    
    if (stat.service_type === 'text_generation') {
      day.textTokens += stat.total_tokens;
    } else {
      day.imageTokens += stat.total_tokens;
    }
  });
  
  return Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * 🎯 Free 사용자 기본 한도 체크
 */
export async function checkFreeUserLimits(authId: string) {
  const supabase = await createClient();
  
  // 오늘 사용량 조회
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { data: todayUsage } = await supabase
    .from('token_usage')
    .select('total_tokens')
    .eq('userId', authId)
    .gte('created_at', today.toISOString());

  // 이번 달 사용량 조회
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  const { data: monthlyUsage } = await supabase
    .from('token_usage')
    .select('total_tokens')
    .eq('userId', authId)
    .gte('created_at', startOfMonth.toISOString());

  const todayTokens = (todayUsage || []).reduce((sum, u) => sum + u.total_tokens, 0);
  const monthlyTokens = (monthlyUsage || []).reduce((sum, u) => sum + u.total_tokens, 0);

  // Free 사용자 한도 (Gemini 기준)
  const FREE_LIMITS = {
    dailyTokens: 3870, // 3장 × 1290토큰
    monthlyTokens: 10320 // 8장 × 1290토큰
  };

  return {
    dailyUsed: todayTokens,
    dailyLimit: FREE_LIMITS.dailyTokens,
    dailyRemaining: Math.max(0, FREE_LIMITS.dailyTokens - todayTokens),
    monthlyUsed: monthlyTokens,
    monthlyLimit: FREE_LIMITS.monthlyTokens,
    monthlyRemaining: Math.max(0, FREE_LIMITS.monthlyTokens - monthlyTokens),
    canGenerate: todayTokens < FREE_LIMITS.dailyTokens && monthlyTokens < FREE_LIMITS.monthlyTokens
  };
}