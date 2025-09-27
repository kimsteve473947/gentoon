import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminChangePlan } from "@/lib/subscription/subscription-manager";
import { type PlanType } from "@/lib/subscription/plan-config";

/**
 * 관리자 전용 구독 플랜 변경 API
 * POST /api/admin-473947/subscriptions/[userId]/change-plan
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = await createClient();
    
    // 관리자 권한 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }
    
    // 관리자 확인 (userId가 특정 관리자 ID이거나 role이 admin인지 확인)
    const { data: adminUser } = await supabase
      .from('user')
      .select('id, email')
      .eq('id', user.id)
      .single();
    
    // 간단한 관리자 체크 (실제로는 더 정교한 권한 시스템이 필요)
    const isAdmin = adminUser?.email === 'kimjh473947@gmail.com' || adminUser?.id === '4e10fdf1-dc5e-423c-a303-8731be910168';
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다" },
        { status: 403 }
      );
    }
    
    const { userId } = params;
    const body = await req.json();
    const { newPlan, reason } = body;
    
    console.log(`👨‍💼 관리자 플랜 변경 요청:`, {
      adminId: user.id,
      targetUserId: userId,
      newPlan,
      reason
    });
    
    if (!newPlan || !['FREE', 'STARTER', 'PRO', 'PREMIUM', 'ADMIN'].includes(newPlan)) {
      return NextResponse.json(
        { error: "유효하지 않은 플랜입니다" },
        { status: 400 }
      );
    }
    
    // 대상 사용자 확인
    const { data: targetUser, error: userError } = await supabase
      .from('user')
      .select('id, email, name')
      .eq('id', userId)
      .single();
    
    if (userError || !targetUser) {
      return NextResponse.json(
        { error: "사용자를 찾을 수 없습니다" },
        { status: 404 }
      );
    }
    
    // 관리자 플랜 변경 실행
    const result = await adminChangePlan(userId, newPlan as PlanType, reason);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "플랜 변경에 실패했습니다" },
        { status: 500 }
      );
    }
    
    console.log(`✅ 관리자 플랜 변경 완료:`, {
      targetUser: { id: targetUser.id, email: targetUser.email, name: targetUser.name },
      changeType: result.changeType,
      previousPlan: result.previousPlan,
      newPlan: result.newPlan,
      reason
    });
    
    return NextResponse.json({
      success: true,
      result: {
        userId: targetUser.id,
        userName: targetUser.name,
        userEmail: targetUser.email,
        changeType: result.changeType,
        previousPlan: result.previousPlan,
        newPlan: result.newPlan,
        subscriptionId: result.subscriptionId,
        reason,
        changedBy: adminUser.email,
        changedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error("관리자 플랜 변경 오류:", error);
    
    return NextResponse.json(
      { 
        error: "플랜 변경 중 오류가 발생했습니다",
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * 사용자 구독 상태 조회 (관리자용)
 * GET /api/admin-473947/subscriptions/[userId]/change-plan
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = await createClient();
    
    // 관리자 권한 확인 (POST와 동일한 로직)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }
    
    const { data: adminUser } = await supabase
      .from('user')
      .select('id, email')
      .eq('id', user.id)
      .single();
    
    const isAdmin = adminUser?.email === 'kimjh473947@gmail.com' || adminUser?.id === '4e10fdf1-dc5e-423c-a303-8731be910168';
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다" },
        { status: 403 }
      );
    }
    
    const { userId } = params;
    
    // 사용자 정보 조회
    const { data: targetUser, error: userError } = await supabase
      .from('user')
      .select('id, email, name, createdAt')
      .eq('id', userId)
      .single();
    
    if (userError || !targetUser) {
      return NextResponse.json(
        { error: "사용자를 찾을 수 없습니다" },
        { status: 404 }
      );
    }
    
    // 구독 정보 조회
    const { data: subscription } = await supabase
      .from('subscription')
      .select('*')
      .eq('userId', userId)
      .single();
    
    // 최근 결제 내역 조회
    const { data: recentTransactions } = await supabase
      .from('transaction')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false })
      .limit(5);
    
    return NextResponse.json({
      success: true,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        createdAt: targetUser.createdAt
      },
      subscription: subscription ? {
        id: subscription.id,
        plan: subscription.plan,
        tokensTotal: subscription.tokensTotal,
        tokensUsed: subscription.tokensUsed,
        maxCharacters: subscription.maxCharacters,
        maxProjects: subscription.maxProjects,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        paymentMethod: subscription.paymentMethod,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt
      } : null,
      recentTransactions: recentTransactions || []
    });
    
  } catch (error) {
    console.error("사용자 구독 정보 조회 오류:", error);
    
    return NextResponse.json(
      { 
        error: "구독 정보 조회 중 오류가 발생했습니다",
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}