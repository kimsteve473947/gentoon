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

// GET: 특정 쿠폰 상세 조회
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

    // 쿠폰 정보 조회
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

    // 사용 통계 조회
    const { data: usageStats } = await supabase
      .from('user_coupon')
      .select('*')
      .eq('couponid', couponId)
      .order('appliedat', { ascending: false });

    // 사용량 계산
    const usageCount = usageStats?.length || 0;
    const now = new Date();
    const expiresAt = new Date(coupon.expiresat);
    
    let status = 'active';
    if (!coupon.isactive) {
      status = 'inactive';
    } else if (expiresAt < now) {
      status = 'expired';
    } else if (coupon.usagelimit > 0 && usageCount >= coupon.usagelimit) {
      status = 'depleted';
    }

    return NextResponse.json({
      success: true,
      coupon: {
        ...coupon,
        usageCount,
        remainingUses: coupon.usagelimit > 0 ? Math.max(0, coupon.usagelimit - usageCount) : -1,
        status,
        isExpired: expiresAt < now,
        usageHistory: usageStats || []
      }
    });

  } catch (error) {
    console.error('쿠폰 상세 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '쿠폰 상세 조회 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}

// PATCH: 쿠폰 정보 수정
export async function PATCH(
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

    // 기존 쿠폰 조회
    const { data: existingCoupon } = await supabase
      .from('coupon')
      .select('*')
      .eq('id', couponId)
      .single();

    if (!existingCoupon) {
      return NextResponse.json({
        success: false,
        error: '쿠폰을 찾을 수 없습니다'
      }, { status: 404 });
    }

    const body = await request.json();
    const {
      code,
      discount,
      discounttype,
      description,
      usagelimit,
      expiresat,
      isactive,
      first_payment_only,
      referral_tracking,
      referral_reward_tokens
    } = body;

    // 업데이트할 필드만 포함
    const updateData: any = { updatedat: new Date().toISOString() };

    if (code !== undefined) {
      // 다른 쿠폰의 코드와 중복 검증
      if (code.toUpperCase() !== existingCoupon.code) {
        const { data: duplicateCoupon } = await supabase
          .from('coupon')
          .select('id')
          .eq('code', code.toUpperCase())
          .neq('id', couponId)
          .single();

        if (duplicateCoupon) {
          return NextResponse.json({
            success: false,
            error: '이미 존재하는 쿠폰 코드입니다'
          }, { status: 409 });
        }
      }
      updateData.code = code.toUpperCase();
    }

    if (discount !== undefined) {
      const currentDiscountType = discounttype || existingCoupon.discounttype;
      
      if (currentDiscountType === 'PERCENT' && (discount < 1 || discount > 100)) {
        return NextResponse.json({
          success: false,
          error: '퍼센트 할인은 1-100 사이의 값이어야 합니다'
        }, { status: 400 });
      }

      if (currentDiscountType === 'FIXED' && discount < 100) {
        return NextResponse.json({
          success: false,
          error: '고정 할인은 최소 100원 이상이어야 합니다'
        }, { status: 400 });
      }

      updateData.discount = discount;
    }

    if (discounttype !== undefined) updateData.discounttype = discounttype;
    if (description !== undefined) updateData.description = description;
    if (usagelimit !== undefined) updateData.usagelimit = usagelimit;
    if (expiresat !== undefined) updateData.expiresat = new Date(expiresat).toISOString();
    if (isactive !== undefined) updateData.isactive = isactive;
    if (first_payment_only !== undefined) updateData.first_payment_only = first_payment_only;
    if (referral_tracking !== undefined) updateData.referral_tracking = referral_tracking;
    if (referral_reward_tokens !== undefined) updateData.referral_reward_tokens = referral_reward_tokens;

    // 쿠폰 업데이트
    const { data: updatedCoupon, error: updateError } = await supabase
      .from('coupon')
      .update(updateData)
      .eq('id', couponId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // 활동 로그 추가
    await supabase
      .from('user_activities')
      .insert({
        user_id: user.id,
        activity_type: 'coupon_update',
        activity_title: '쿠폰 수정',
        activity_description: `쿠폰 '${updatedCoupon.code}'의 정보가 수정되었습니다.`,
        metadata: {
          coupon_id: couponId,
          coupon_code: updatedCoupon.code,
          updated_fields: Object.keys(updateData).filter(key => key !== 'updatedat')
        }
      });

    // 사용량 조회
    const { data: usageStats } = await supabase
      .from('user_coupon')
      .select('couponid')
      .eq('couponid', couponId);

    const usageCount = usageStats?.length || 0;
    const now = new Date();
    const expiresAt = new Date(updatedCoupon.expiresat);
    
    let status = 'active';
    if (!updatedCoupon.isactive) {
      status = 'inactive';
    } else if (expiresAt < now) {
      status = 'expired';
    } else if (updatedCoupon.usagelimit > 0 && usageCount >= updatedCoupon.usagelimit) {
      status = 'depleted';
    }

    return NextResponse.json({
      success: true,
      coupon: {
        ...updatedCoupon,
        usageCount,
        remainingUses: updatedCoupon.usagelimit > 0 ? Math.max(0, updatedCoupon.usagelimit - usageCount) : -1,
        status,
        isExpired: expiresAt < now
      },
      message: '쿠폰 정보가 수정되었습니다'
    });

  } catch (error) {
    console.error('쿠폰 수정 오류:', error);
    return NextResponse.json({
      success: false,
      error: '쿠폰 수정 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}

// DELETE: 쿠폰 삭제
export async function DELETE(
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

    // 기존 쿠폰 조회
    const { data: existingCoupon } = await supabase
      .from('coupon')
      .select('*')
      .eq('id', couponId)
      .single();

    if (!existingCoupon) {
      return NextResponse.json({
        success: false,
        error: '쿠폰을 찾을 수 없습니다'
      }, { status: 404 });
    }

    // 쿠폰 사용 내역 확인
    const { data: usageHistory } = await supabase
      .from('user_coupon')
      .select('id')
      .eq('couponid', couponId)
      .limit(1);

    if (usageHistory && usageHistory.length > 0) {
      // 사용 내역이 있으면 비활성화만 가능
      const { error: deactivateError } = await supabase
        .from('coupon')
        .update({ 
          isactive: false,
          updatedat: new Date().toISOString()
        })
        .eq('id', couponId);

      if (deactivateError) {
        throw deactivateError;
      }

      // 활동 로그 추가
      await supabase
        .from('user_activities')
        .insert({
          user_id: user.id,
          activity_type: 'coupon_deactivate',
          activity_title: '쿠폰 비활성화',
          activity_description: `사용 내역이 있는 쿠폰 '${existingCoupon.code}'가 비활성화되었습니다.`,
          metadata: {
            coupon_id: couponId,
            coupon_code: existingCoupon.code,
            reason: 'has_usage_history'
          }
        });

      return NextResponse.json({
        success: true,
        message: '사용 내역이 있어 쿠폰이 비활성화되었습니다'
      });
    } else {
      // 사용 내역이 없으면 완전 삭제
      const { error: deleteError } = await supabase
        .from('coupon')
        .delete()
        .eq('id', couponId);

      if (deleteError) {
        throw deleteError;
      }

      // 활동 로그 추가
      await supabase
        .from('user_activities')
        .insert({
          user_id: user.id,
          activity_type: 'coupon_delete',
          activity_title: '쿠폰 삭제',
          activity_description: `쿠폰 '${existingCoupon.code}'가 삭제되었습니다.`,
          metadata: {
            coupon_id: couponId,
            coupon_code: existingCoupon.code,
            deleted_data: existingCoupon
          }
        });

      return NextResponse.json({
        success: true,
        message: '쿠폰이 삭제되었습니다'
      });
    }

  } catch (error) {
    console.error('쿠폰 삭제 오류:', error);
    return NextResponse.json({
      success: false,
      error: '쿠폰 삭제 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}