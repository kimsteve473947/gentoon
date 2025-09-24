import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
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
      .select('id')
      .eq('id', paymentMethodId)
      .eq('userId', user.id)
      .single();

    if (fetchError || !paymentMethod) {
      return NextResponse.json({
        success: false,
        error: '결제 수단을 찾을 수 없습니다'
      }, { status: 404 });
    }

    // 트랜잭션으로 처리 - 모든 결제수단을 기본이 아니도록 하고, 선택된 것을 기본으로 설정
    const { error: updateError } = await supabase.rpc('set_default_payment_method', {
      user_id: user.id,
      payment_method_id: paymentMethodId
    });

    if (updateError) {
      // RPC가 없다면 수동으로 처리
      console.log('RPC 실행 실패, 수동 처리:', updateError);
      
      // 1. 모든 결제수단을 기본이 아니도록 설정
      await supabase
        .from('payment_method')
        .update({ isdefault: false })
        .eq('userId', user.id);

      // 2. 선택된 결제수단을 기본으로 설정
      const { error: setDefaultError } = await supabase
        .from('payment_method')
        .update({ isdefault: true })
        .eq('id', paymentMethodId)
        .eq('userId', user.id);

      if (setDefaultError) {
        throw setDefaultError;
      }
    }

    return NextResponse.json({
      success: true,
      message: '기본 결제 수단이 설정되었습니다'
    });

  } catch (error) {
    console.error('기본 결제 수단 설정 오류:', error);
    return NextResponse.json({
      success: false,
      error: '기본 결제 수단 설정 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}