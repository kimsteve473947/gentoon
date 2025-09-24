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

// GET: 쿠폰 목록 조회 (검색, 필터링, 정렬, 페이지네이션)
export async function GET(request: NextRequest) {
  try {
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

    // 쿼리 파라미터 추출
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const discountType = searchParams.get('discountType') || '';
    const sortBy = searchParams.get('sortBy') || 'createdat';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    const offset = (page - 1) * limit;

    // 기본 쿠폰 쿼리 구성
    let couponQuery = supabase
      .from('coupon')
      .select('*', { count: 'exact' });

    // 검색 필터 적용
    if (search) {
      couponQuery = couponQuery.or(`code.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // 상태 필터 적용
    if (status === 'active') {
      couponQuery = couponQuery.eq('isactive', true);
    } else if (status === 'inactive') {
      couponQuery = couponQuery.eq('isactive', false);
    } else if (status === 'expired') {
      couponQuery = couponQuery.lt('expiresat', new Date().toISOString());
    }

    // 할인 타입 필터 적용
    if (discountType) {
      couponQuery = couponQuery.eq('discounttype', discountType);
    }

    // 정렬 적용
    const ascending = sortOrder === 'asc';
    couponQuery = couponQuery.order(sortBy, { ascending });

    // 페이지네이션 적용
    couponQuery = couponQuery.range(offset, offset + limit - 1);

    const { data: coupons, error: couponsError, count } = await couponQuery;
    
    if (couponsError) {
      throw couponsError;
    }

    // 쿠폰 ID 목록 추출
    const couponIds = (coupons || []).map(coupon => coupon.id);
    
    // 사용 통계 조회
    const { data: usageStats } = await supabase
      .from('user_coupon')
      .select('couponid')
      .in('couponid', couponIds);

    // 사용 통계 매핑
    const usageMap = (usageStats || []).reduce((acc, usage) => {
      acc[usage.couponid] = (acc[usage.couponid] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 데이터 결합 및 상태 계산
    const enrichedCoupons = (coupons || []).map((coupon: any) => {
      const now = new Date();
      const expiresAt = new Date(coupon.expiresat);
      const usageCount = usageMap[coupon.id] || 0;
      
      let status = 'active';
      if (!coupon.isactive) {
        status = 'inactive';
      } else if (expiresAt < now) {
        status = 'expired';
      } else if (coupon.usagelimit > 0 && usageCount >= coupon.usagelimit) {
        status = 'depleted';
      }

      return {
        ...coupon,
        usageCount,
        remainingUses: coupon.usagelimit > 0 ? Math.max(0, coupon.usagelimit - usageCount) : -1,
        status,
        isExpired: expiresAt < now
      };
    });

    return NextResponse.json({
      success: true,
      coupons: enrichedCoupons,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('쿠폰 목록 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '쿠폰 목록 조회 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}

// POST: 새 쿠폰 생성
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const {
      code,
      discount,
      discounttype,
      description,
      usagelimit,
      expiresat,
      isactive = true,
      first_payment_only = false,
      referral_tracking = false,
      referral_reward_tokens = 0
    } = body;

    // 필수 필드 검증
    if (!code || !discount || !discounttype || !expiresat) {
      return NextResponse.json({
        success: false,
        error: '필수 필드가 누락되었습니다 (code, discount, discounttype, expiresat)'
      }, { status: 400 });
    }

    // 쿠폰 코드 중복 검증
    const { data: existingCoupon } = await supabase
      .from('coupon')
      .select('id')
      .eq('code', code.toUpperCase())
      .single();

    if (existingCoupon) {
      return NextResponse.json({
        success: false,
        error: '이미 존재하는 쿠폰 코드입니다'
      }, { status: 409 });
    }

    // 할인 값 검증
    if (discounttype === 'PERCENT' && (discount < 1 || discount > 100)) {
      return NextResponse.json({
        success: false,
        error: '퍼센트 할인은 1-100 사이의 값이어야 합니다'
      }, { status: 400 });
    }

    if (discounttype === 'FIXED' && discount < 100) {
      return NextResponse.json({
        success: false,
        error: '고정 할인은 최소 100원 이상이어야 합니다'
      }, { status: 400 });
    }

    // 쿠폰 생성
    const { data: newCoupon, error: createError } = await supabase
      .from('coupon')
      .insert({
        code: code.toUpperCase(),
        discount,
        discounttype,
        description,
        usagelimit: usagelimit || -1,
        expiresat: new Date(expiresat).toISOString(),
        isactive,
        first_payment_only,
        referral_tracking,
        referral_reward_tokens,
        createdby: user.id
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    // 활동 로그 추가
    await supabase
      .from('user_activities')
      .insert({
        user_id: user.id,
        activity_type: 'coupon_create',
        activity_title: '쿠폰 생성',
        activity_description: `새 쿠폰 '${code}'가 생성되었습니다.`,
        metadata: {
          coupon_id: newCoupon.id,
          coupon_code: code,
          discount_type: discounttype,
          discount_value: discount
        }
      });

    return NextResponse.json({
      success: true,
      coupon: {
        ...newCoupon,
        usageCount: 0,
        remainingUses: newCoupon.usagelimit > 0 ? newCoupon.usagelimit : -1,
        status: 'active',
        isExpired: false
      },
      message: '쿠폰이 생성되었습니다'
    });

  } catch (error) {
    console.error('쿠폰 생성 오류:', error);
    return NextResponse.json({
      success: false,
      error: '쿠폰 생성 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}