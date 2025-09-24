import { NextRequest, NextResponse } from 'next/server';
import { createClient } from "@/lib/supabase/server";
import { getAllUsersTokenStats, getSimpleTokenStats } from '@/lib/subscription/simple-token-usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 관리자 권한 확인
async function checkAdminAccess(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user || user.email !== 'kimjh473947@gmail.com') {
    return NextResponse.json(
      { success: false, error: "관리자 권한이 필요합니다" },
      { status: 403 }
    );
  }
  
  return null;
}

/**
 * 🎯 간단한 토큰 통계 API - Auth ID 직접 사용
 */
export async function GET(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const adminCheck = await checkAdminAccess(request);
    if (adminCheck) return adminCheck;

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const userId = searchParams.get('userId'); // 특정 사용자 조회
    
    console.log(`📊 관리자 토큰 통계 조회 (${days}일, userId: ${userId || 'all'})`);

    const supabase = await createClient();
    
    if (userId) {
      // 특정 사용자 토큰 통계
      const userStats = await getSimpleTokenStats(userId, days);
      
      // 사용자 정보도 함께 조회
      const { data: authUsersData } = await supabase.auth.admin.listUsers();
      const authUser = authUsersData?.users?.find(u => u.id === userId);
      
      return NextResponse.json({
        success: true,
        userStats: {
          ...userStats,
          authId: userId,
          email: authUser?.email,
          lastSignIn: authUser?.last_sign_in_at,
          createdAt: authUser?.created_at
        },
        period: `${days}일`,
        timestamp: new Date().toISOString()
      });
    } else {
      // 모든 사용자 토큰 통계
      const allStats = await getAllUsersTokenStats(days);
      
      // Auth 사용자 정보 조회
      const { data: authUsersData } = await supabase.auth.admin.listUsers();
      const authUsers = authUsersData?.users || [];
      
      // 사용자 정보와 통계 결합
      const enrichedStats = Object.values(allStats).map((stat: any) => {
        const authUser = authUsers.find(u => u.id === stat.authId);
        return {
          ...stat,
          email: authUser?.email || 'Unknown',
          lastSignIn: authUser?.last_sign_in_at,
          createdAt: authUser?.created_at,
          // 비용 정보 (KRW 환산)
          totalCostKRW: Math.round(stat.totalCost * 1330), // USD to KRW
          estimatedImages: Math.floor(stat.totalTokens / 1290) // Gemini 토큰 기준
        };
      });

      // 토큰 사용량순 정렬
      enrichedStats.sort((a, b) => b.totalTokens - a.totalTokens);

      // 전체 통계 계산
      const totalStats = enrichedStats.reduce((acc, user) => ({
        totalUsers: acc.totalUsers + 1,
        totalTokens: acc.totalTokens + user.totalTokens,
        totalCostUSD: acc.totalCostUSD + user.totalCost,
        totalRequests: acc.totalRequests + user.totalRequests,
        totalImages: acc.totalImages + user.estimatedImages
      }), {
        totalUsers: 0,
        totalTokens: 0,
        totalCostUSD: 0,
        totalRequests: 0,
        totalImages: 0
      });

      return NextResponse.json({
        success: true,
        stats: enrichedStats,
        summary: {
          ...totalStats,
          totalCostKRW: Math.round(totalStats.totalCostUSD * 1330),
          period: `${days}일`,
          avgTokensPerUser: Math.round(totalStats.totalTokens / totalStats.totalUsers || 0),
          avgCostPerUserKRW: Math.round((totalStats.totalCostUSD * 1330) / totalStats.totalUsers || 0)
        },
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error("Token stats API error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "토큰 통계 조회 중 오류가 발생했습니다",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 🔧 토큰 통계 재계산 (POST)
 */
export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const adminCheck = await checkAdminAccess(request);
    if (adminCheck) return adminCheck;

    const body = await request.json();
    const { action, userId, days = 30 } = body;

    console.log(`🔧 관리자 토큰 통계 액션: ${action}`);

    if (action === 'recalculate') {
      // 토큰 통계 재계산 (캐시 무효화 등)
      const supabase = await createClient();
      
      // 최근 토큰 사용량 다시 조회
      const { data: recentUsage } = await supabase
        .from('token_usage')
        .select('userId, total_tokens, api_cost, created_at')
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      const recalculatedStats = {
        totalRecords: recentUsage?.length || 0,
        uniqueUsers: new Set(recentUsage?.map(u => u.userId)).size,
        totalTokens: recentUsage?.reduce((sum, u) => sum + u.total_tokens, 0) || 0,
        totalCost: recentUsage?.reduce((sum, u) => sum + (u.api_cost || 0), 0) || 0
      };

      return NextResponse.json({
        success: true,
        action: 'recalculate',
        result: recalculatedStats,
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({
      success: false,
      error: "지원되지 않는 액션입니다"
    }, { status: 400 });

  } catch (error) {
    console.error("Token stats action error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "토큰 통계 액션 중 오류가 발생했습니다",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}