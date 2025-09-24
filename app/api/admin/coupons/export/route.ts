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

// GET: 쿠폰 데이터 CSV 내보내기
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

    // 모든 쿠폰과 사용 내역 조회
    const { data: coupons, error: couponError } = await supabase
      .from('coupon')
      .select(`
        *,
        user_coupon(
          userId,
          appliedAt,
          isUsed,
          usedAt
        )
      `)
      .order('createdAt', { ascending: false });

    if (couponError) {
      throw couponError;
    }

    // CSV 헤더
    const csvHeaders = [
      '쿠폰코드',
      '할인타입',
      '할인값',
      '설명',
      '만료일',
      '사용제한',
      '현재사용량',
      '활성상태',
      '생성일',
      '수정일'
    ];

    // CSV 데이터 생성
    const csvRows = [csvHeaders.join(',')];
    
    coupons.forEach(coupon => {
      const row = [
        `"${coupon.code}"`,
        coupon.discountType === 'PERCENT' ? '퍼센트' : '고정금액',
        coupon.discountType === 'PERCENT' ? `${coupon.discount}%` : `${coupon.discount}원`,
        `"${coupon.description}"`,
        new Date(coupon.expiresAt).toLocaleDateString('ko-KR'),
        coupon.usageLimit || '무제한',
        coupon.user_coupon?.length || 0,
        coupon.isActive ? '활성' : '비활성',
        new Date(coupon.createdAt).toLocaleDateString('ko-KR'),
        coupon.updatedAt ? new Date(coupon.updatedAt).toLocaleDateString('ko-KR') : '-'
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    
    // CSV 응답 반환
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="coupons_${new Date().toISOString().split('T')[0]}.csv"`,
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('쿠폰 내보내기 오류:', error);
    return NextResponse.json({
      success: false,
      error: '내보내기 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}