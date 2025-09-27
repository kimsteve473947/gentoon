import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST: 환불 처리
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 1. 인증 및 관리자 권한 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: '로그인이 필요합니다'
      }, { status: 401 });
    }

    const { data: subscription } = await supabase
      .from('subscription')
      .select('plan')
      .eq('userId', user.id)
      .single();
    
    if (subscription?.plan !== 'ADMIN') {
      return NextResponse.json({
        success: false,
        error: '관리자 권한이 필요합니다'
      }, { status: 403 });
    }

    // 2. 요청 데이터 파싱
    const body = await request.json();
    const {
      userId,
      transactionId,
      refundAmount,
      refundType = 'FULL',
      reason,
      adminNote
    } = body;

    if (!userId || !transactionId || !refundAmount || !reason) {
      return NextResponse.json({
        success: false,
        error: '필수 정보가 누락되었습니다'
      }, { status: 400 });
    }

    // 3. 거래 정보 확인
    const { data: transaction, error: transactionError } = await supabase
      .from('transaction')
      .select('*')
      .eq('id', transactionId)
      .eq('userId', userId)
      .single();

    if (transactionError || !transaction) {
      return NextResponse.json({
        success: false,
        error: '거래 정보를 찾을 수 없습니다'
      }, { status: 404 });
    }

    // 4. 이미 환불된 거래인지 확인
    const { data: existingRefund } = await supabase
      .from('refund')
      .select('id')
      .eq('transaction_id', transactionId)
      .single();

    if (existingRefund) {
      return NextResponse.json({
        success: false,
        error: '이미 환불 처리된 거래입니다'
      }, { status: 400 });
    }

    // 5. 구독 정보 확인
    const { data: userSubscription } = await supabase
      .from('subscription')
      .select('id')
      .eq('userId', userId)
      .single();

    // 6. 고유한 환불 번호 생성
    const refundNo = `refund_${Date.now()}_${userId.slice(-8)}`;

    // 7. 환불 레코드 생성
    const { data: refund, error: refundError } = await supabase
      .from('refund')
      .insert({
        user_id: userId,
        subscription_id: userSubscription?.id || null,
        transaction_id: transactionId,
        pay_token: transaction.tossPaymentKey || '',
        refund_no: refundNo,
        refund_amount: refundAmount,
        refund_type: refundType,
        reason: reason,
        status: 'PENDING',
        processed_by: user.email,
        admin_note: adminNote || null,
        toss_data: null
      })
      .select()
      .single();

    if (refundError) {
      console.error('환불 레코드 생성 오류:', refundError);
      return NextResponse.json({
        success: false,
        error: '환불 처리 중 오류가 발생했습니다'
      }, { status: 500 });
    }

    // 8. 토스페이먼츠 환불 API 호출
    let tossRefundResult;
    let refundStatus = 'FAILED';
    
    try {
      // 토스페이먼츠 환불 API 호출
      const cancelResponse = await fetch(`https://api.tosspayments.com/v1/payments/${transaction.tossPaymentKey}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString('base64')}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': refundNo // 중복 요청 방지
        },
        body: JSON.stringify({
          cancelReason: reason,
          ...(refundType === 'PARTIAL' && { cancelAmount: refundAmount })
        })
      });

      tossRefundResult = await cancelResponse.json();
      
      if (cancelResponse.ok) {
        refundStatus = 'COMPLETED';
        console.log('✅ 토스페이먼츠 환불 성공:', tossRefundResult);
      } else {
        console.error('❌ 토스페이먼츠 환불 실패:', tossRefundResult);
        refundStatus = 'FAILED';
        
        // 환불 실패 시 데이터베이스 업데이트
        await supabase
          .from('refund')
          .update({
            status: 'FAILED',
            processed_at: new Date().toISOString(),
            toss_data: tossRefundResult
          })
          .eq('id', refund.id);

        return NextResponse.json({
          success: false,
          error: tossRefundResult.message || '토스페이먼츠 환불 처리에 실패했습니다'
        }, { status: 400 });
      }
    } catch (tossError) {
      console.error('💥 토스페이먼츠 API 호출 오류:', tossError);
      refundStatus = 'FAILED';
      
      // API 호출 실패 시 데이터베이스 업데이트
      await supabase
        .from('refund')
        .update({
          status: 'FAILED',
          processed_at: new Date().toISOString(),
          toss_data: {
            error: tossError instanceof Error ? tossError.message : '알 수 없는 오류',
            timestamp: new Date().toISOString()
          }
        })
        .eq('id', refund.id);

      return NextResponse.json({
        success: false,
        error: '환불 처리 중 시스템 오류가 발생했습니다'
      }, { status: 500 });
    }

    // 환불 성공 시 데이터베이스 업데이트
    const { error: updateError } = await supabase
      .from('refund')
      .update({
        status: refundStatus,
        processed_at: new Date().toISOString(),
        toss_data: tossRefundResult
      })
      .eq('id', refund.id);

    if (updateError) {
      console.error('환불 상태 업데이트 오류:', updateError);
    }

    // 9. 거래 상태 업데이트
    await supabase
      .from('transaction')
      .update({
        status: 'REFUNDED',
        updatedAt: new Date().toISOString()
      })
      .eq('id', transactionId);

    // 10. 구독 취소 처리 (전액 환불의 경우)
    if (refundType === 'FULL' && userSubscription) {
      await supabase
        .from('subscription')
        .update({
          cancelAtPeriodEnd: true,
          updatedAt: new Date().toISOString()
        })
        .eq('id', userSubscription.id);
    }

    return NextResponse.json({
      success: true,
      refund: {
        id: refund.id,
        refundNo: refund.refund_no,
        refundAmount: refund.refund_amount,
        status: refundStatus,
        processedAt: new Date().toISOString(),
        tossTransactionKey: tossRefundResult?.cancels?.[0]?.transactionKey || null
      },
      message: '환불이 성공적으로 처리되었습니다',
      tossPaymentsResponse: tossRefundResult
    });

  } catch (error) {
    console.error('환불 처리 오류:', error);
    return NextResponse.json({
      success: false,
      error: '환불 처리 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}

// GET: 환불 내역 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 1. 인증 및 관리자 권한 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: '로그인이 필요합니다'
      }, { status: 401 });
    }

    const { data: subscription } = await supabase
      .from('subscription')
      .select('plan')
      .eq('userId', user.id)
      .single();
    
    if (subscription?.plan !== 'ADMIN') {
      return NextResponse.json({
        success: false,
        error: '관리자 권한이 필요합니다'
      }, { status: 403 });
    }

    // 2. 쿼리 파라미터 처리
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || '';
    
    const offset = (page - 1) * limit;

    // 3. 환불 내역 조회
    let refundQuery = supabase
      .from('refund')
      .select(`
        *,
        user:user_id (
          id,
          email,
          name
        ),
        transaction:transaction_id (
          id,
          amount,
          tossPaymentKey,
          createdAt
        )
      `, { count: 'exact' });

    if (status) {
      refundQuery = refundQuery.eq('status', status);
    }

    refundQuery = refundQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: refunds, error: refundsError, count } = await refundQuery;

    if (refundsError) {
      throw refundsError;
    }

    return NextResponse.json({
      success: true,
      refunds: refunds || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('환불 내역 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '환불 내역 조회 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}