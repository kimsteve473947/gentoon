import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { 
  tossCashReceiptAPI, 
  CashReceiptKeyType, 
  CashReceiptPurpose,
  CashReceiptUtils 
} from '@/lib/payments/toss-cash-receipt';
import { cashReceiptAutomationService } from '@/lib/payments/cash-receipt-automation';

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

// GET: 현금영수증 목록 조회
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

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const keyType = searchParams.get('keyType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const offset = (page - 1) * limit;

    // 기본 쿼리 구성
    let query = supabase
      .from('cash_receipt')
      .select(`
        *,
        user:user(id, name, email),
        transaction:transaction(id, amount, type, tossPaymentKey, tossOrderId, createdAt)
      `);

    // 필터 적용
    if (status) {
      query = query.eq('status', status);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (keyType) {
      query = query.eq('cash_receipt_key_type', keyType);
    }
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // 페이지네이션과 정렬
    const { data: cashReceipts, error: receiptsError, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (receiptsError) {
      throw receiptsError;
    }

    // 통계 정보 조회
    const { data: stats } = await supabase
      .from('cash_receipt')
      .select('status, cash_receipt_key_type')
      .then(({ data }) => {
        const statusCounts = data?.reduce((acc: any, item) => {
          acc[item.status] = (acc[item.status] || 0) + 1;
          return acc;
        }, {}) || {};

        const typeCounts = data?.reduce((acc: any, item) => {
          acc[item.cash_receipt_key_type] = (acc[item.cash_receipt_key_type] || 0) + 1;
          return acc;
        }, {}) || {};

        return { statusCounts, typeCounts };
      });

    return NextResponse.json({
      success: true,
      data: {
        cashReceipts: cashReceipts?.map(receipt => ({
          ...receipt,
          // 개인정보 마스킹
          cash_receipt_key: CashReceiptUtils.maskCashReceiptKey(
            receipt.cash_receipt_key, 
            receipt.cash_receipt_key_type
          ),
          statusDescription: CashReceiptUtils.getStatusDescription(receipt.status)
        })) || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        },
        stats
      }
    });

  } catch (error) {
    console.error('현금영수증 목록 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '현금영수증 목록 조회 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}

// POST: 현금영수증 수동 발급
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
      transactionId, 
      cashReceiptKey, 
      cashReceiptKeyType, 
      cashReceiptPurpose 
    } = body;

    // 필수 파라미터 검증
    if (!transactionId || !cashReceiptKey || !cashReceiptKeyType || !cashReceiptPurpose) {
      return NextResponse.json({
        success: false,
        error: '필수 파라미터가 누락되었습니다'
      }, { status: 400 });
    }

    // 입력값 유효성 검사
    if (!CashReceiptUtils.validateCashReceiptKey(cashReceiptKey, cashReceiptKeyType)) {
      return NextResponse.json({
        success: false,
        error: '현금영수증 식별자가 유효하지 않습니다'
      }, { status: 400 });
    }

    // 거래 정보 조회
    const { data: transaction, error: transactionError } = await supabase
      .from('transaction')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (transactionError || !transaction) {
      return NextResponse.json({
        success: false,
        error: '거래 정보를 찾을 수 없습니다'
      }, { status: 404 });
    }

    // 현금영수증 발급
    const result = await cashReceiptAutomationService.issueCashReceiptForTransaction(
      transaction,
      cashReceiptKey,
      cashReceiptKeyType as CashReceiptKeyType,
      cashReceiptPurpose as CashReceiptPurpose
    );

    if (result.success) {
      // 관리자 활동 로그 추가
      await supabase
        .from('user_activities')
        .insert({
          user_id: transaction.userId,
          activity_type: 'admin_cash_receipt_issued',
          activity_title: '관리자 현금영수증 발급',
          activity_description: `관리자 ${user.email}에 의해 현금영수증이 수동으로 발급되었습니다.`,
          metadata: {
            transaction_id: transactionId,
            cash_receipt_id: result.cashReceiptId,
            admin_user_id: user.id,
            key_type: cashReceiptKeyType,
            purpose: cashReceiptPurpose
          }
        });

      return NextResponse.json({
        success: true,
        cashReceiptId: result.cashReceiptId,
        message: '현금영수증이 발급되었습니다'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || '현금영수증 발급에 실패했습니다'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('현금영수증 수동 발급 오류:', error);
    return NextResponse.json({
      success: false,
      error: '현금영수증 발급 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}