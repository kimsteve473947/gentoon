import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { 
  CashReceiptKeyType, 
  CashReceiptPurpose, 
  CashReceiptUtils 
} from '@/lib/payments/toss-cash-receipt';

// GET: 사용자 현금영수증 목록 조회
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

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // 사용자의 현금영수증 목록 조회
    const { data: cashReceipts, error: receiptsError, count } = await supabase
      .from('cash_receipt')
      .select(`
        id,
        cash_receipt_key,
        cash_receipt_key_type,
        cash_receipt_purpose,
        status,
        issue_status,
        total_amount,
        supply_cost,
        tax,
        service_fee,
        customer_name,
        item_name,
        auto_issue,
        issued_at,
        revoked_at,
        popup_uri,
        created_at,
        transaction:transaction(
          id, amount, type, description, createdAt
        )
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (receiptsError) {
      throw receiptsError;
    }

    // 개인정보 마스킹 처리
    const maskedReceipts = cashReceipts?.map(receipt => ({
      ...receipt,
      cash_receipt_key: CashReceiptUtils.maskCashReceiptKey(
        receipt.cash_receipt_key, 
        receipt.cash_receipt_key_type
      ),
      statusDescription: CashReceiptUtils.getStatusDescription(receipt.status)
    }));

    return NextResponse.json({
      success: true,
      data: {
        cashReceipts: maskedReceipts || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
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

// POST: 현금영수증 설정 저장 (자동 발급용)
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

    const body = await request.json();
    const { 
      cashReceiptKey, 
      cashReceiptKeyType, 
      cashReceiptPurpose, 
      autoIssue = true 
    } = body;

    // 필수 파라미터 검증
    if (!cashReceiptKey || !cashReceiptKeyType || !cashReceiptPurpose) {
      return NextResponse.json({
        success: false,
        error: '필수 파라미터가 누락되었습니다'
      }, { status: 400 });
    }

    // 입력값 유효성 검사
    if (!Object.values(CashReceiptKeyType).includes(cashReceiptKeyType)) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 현금영수증 식별자 타입입니다'
      }, { status: 400 });
    }

    if (!Object.values(CashReceiptPurpose).includes(cashReceiptPurpose)) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 현금영수증 용도입니다'
      }, { status: 400 });
    }

    if (!CashReceiptUtils.validateCashReceiptKey(cashReceiptKey, cashReceiptKeyType)) {
      return NextResponse.json({
        success: false,
        error: '현금영수증 식별자가 유효하지 않습니다'
      }, { status: 400 });
    }

    // 사용자 현금영수증 설정 저장 (임시 레코드로)
    const { data: setting, error: settingError } = await supabase
      .from('user_cash_receipt_settings')
      .upsert({
        user_id: user.id,
        cash_receipt_key: cashReceiptKey,
        cash_receipt_key_type: cashReceiptKeyType,
        cash_receipt_purpose: cashReceiptPurpose,
        auto_issue: autoIssue,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id',
        returning: 'minimal'
      })
      .select()
      .single();

    if (settingError) {
      console.error('현금영수증 설정 저장 오류:', settingError);
      return NextResponse.json({
        success: false,
        error: '현금영수증 설정 저장에 실패했습니다'
      }, { status: 500 });
    }

    // 사용자 활동 로그 추가
    await supabase
      .from('user_activities')
      .insert({
        user_id: user.id,
        activity_type: 'cash_receipt_settings_updated',
        activity_title: '현금영수증 설정 변경',
        activity_description: `현금영수증 자동 발급 설정이 ${autoIssue ? '활성화' : '비활성화'}되었습니다.`,
        metadata: {
          key_type: cashReceiptKeyType,
          purpose: cashReceiptPurpose,
          auto_issue: autoIssue
        }
      });

    return NextResponse.json({
      success: true,
      message: '현금영수증 설정이 저장되었습니다',
      data: {
        autoIssue,
        keyType: cashReceiptKeyType,
        purpose: cashReceiptPurpose,
        maskedKey: CashReceiptUtils.maskCashReceiptKey(cashReceiptKey, cashReceiptKeyType)
      }
    });

  } catch (error) {
    console.error('현금영수증 설정 저장 오류:', error);
    return NextResponse.json({
      success: false,
      error: '현금영수증 설정 저장 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}