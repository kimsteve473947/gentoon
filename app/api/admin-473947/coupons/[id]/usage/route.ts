import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 관리자 권한 확인
async function checkAdminAccess(supabase: any, user: any) {
  if (!user) return false;
  
  const { data: subscription } = await supabase
    .from('subscription')
    .select('plan')
    .eq('userId', user.id)
    .single();
  
  return subscription?.plan === 'ADMIN';
}

// GET: 특정 쿠폰의 사용 내역 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: couponId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: '로그인이 필요합니다'
      }, { status: 401 });
    }

    // 관리자 권한 확인
    const hasAdminAccess = await checkAdminAccess(supabase, user);
    if (!hasAdminAccess) {
      return NextResponse.json({
        success: false,
        error: '관리자 권한이 필요합니다'
      }, { status: 403 });
    }

    // 쿠폰 존재 확인
    const { data: coupon, error: couponError } = await supabase
      .from('coupon')
      .select('*')
      .eq('id', couponId)
      .single();

    if (couponError || !coupon) {
      return NextResponse.json({
        success: false,
        error: '쿠폰을 찾을 수 없습니다'
      }, { status: 404 });
    }

    // 쿠폰 사용 내역 조회 (사용자 정보 포함)
    const { data: usage, error: usageError } = await supabase
      .from('user_coupon')
      .select(`
        *,
        users:auth.users!inner(
          id,
          email,
          raw_user_meta_data
        )
      `)
      .eq('couponId', couponId)
      .order('appliedAt', { ascending: false });

    if (usageError) {
      console.error('Usage query error:', usageError);
      // Fallback: auth.users 테이블에 직접 접근이 안될 경우 기본 정보만 조회
      const { data: fallbackUsage, error: fallbackError } = await supabase
        .from('user_coupon')
        .select('*')
        .eq('couponId', couponId)
        .order('appliedAt', { ascending: false });

      if (fallbackError) {
        throw fallbackError;
      }

      // 사용자 정보 별도 조회
      const userIds = fallbackUsage.map(u => u.userId);
      const userInfos: { [key: string]: any } = {};

      for (const userId of userIds) {
        const { data: userProfile } = await supabase
          .from('user_profile')
          .select('name, email')
          .eq('user_id', userId)
          .single();
        
        if (userProfile) {
          userInfos[userId] = userProfile;
        }
      }

      const usageWithUserInfo = fallbackUsage.map(usage => ({
        ...usage,
        userEmail: userInfos[usage.userId]?.email || '정보 없음',
        userName: userInfos[usage.userId]?.name || '정보 없음'
      }));

      return NextResponse.json({
        success: true,
        coupon,
        usage: usageWithUserInfo
      });
    }

    // 사용자 정보와 함께 사용 내역 포맷팅
    const usageWithUserInfo = usage.map(item => ({
      id: item.id,
      userId: item.userId,
      userEmail: item.users?.email || '정보 없음',
      userName: item.users?.raw_user_meta_data?.name || item.users?.raw_user_meta_data?.full_name || '정보 없음',
      appliedAt: item.appliedAt,
      isUsed: item.isUsed,
      usedAt: item.usedAt
    }));

    return NextResponse.json({
      success: true,
      coupon,
      usage: usageWithUserInfo
    });

  } catch (error) {
    console.error('쿠폰 사용 내역 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '사용 내역 조회 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}