import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paymentMethodId } = await params;

    // 사용자 인증 확인
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: '로그인이 필요합니다'
      }, { status: 401 });
    }

    // 결제 수단이 해당 사용자 소유인지 확인
    const { data: paymentMethod, error: fetchError } = await supabase
      .from('payment_method')
      .select('*')
      .eq('id', paymentMethodId)
      .eq('userId', user.id)
      .single();

    if (fetchError || !paymentMethod) {
      return NextResponse.json({
        success: false,
        error: '결제 수단을 찾을 수 없습니다'
      }, { status: 404 });
    }

    // 토스페이먼츠에서 빌링키 삭제 (선택사항)
    try {
      await fetch(`https://api.tosspayments.com/v1/billing/${paymentMethod.billingkey}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (tossError) {
      console.warn('토스페이먼츠 빌링키 삭제 실패:', tossError);
      // 토스페이먼츠 삭제 실패는 무시하고 계속 진행
    }

    // Supabase에서 결제 수단 삭제
    const { error: deleteError } = await supabase
      .from('payment_method')
      .delete()
      .eq('id', paymentMethodId)
      .eq('userId', user.id);

    if (deleteError) {
      throw deleteError;
    }

    // 삭제된 결제수단이 기본이었다면, 다른 결제수단을 기본으로 설정
    if (paymentMethod.isdefault) {
      const { data: remainingMethods, error: remainingError } = await supabase
        .from('payment_method')
        .select('id')
        .eq('userId', user.id)
        .limit(1);

      if (!remainingError && remainingMethods && remainingMethods.length > 0) {
        await supabase
          .from('payment_method')
          .update({ isdefault: true })
          .eq('id', remainingMethods[0].id)
          .eq('userId', user.id);
      }
    }

    return NextResponse.json({
      success: true,
      message: '결제 수단이 삭제되었습니다'
    });

  } catch (error) {
    console.error('결제 수단 삭제 오류:', error);
    return NextResponse.json({
      success: false,
      error: '결제 수단 삭제 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}