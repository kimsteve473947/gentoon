import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tossCashReceiptAPI } from '@/lib/payments/toss-cash-receipt';
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

// GET: 현금영수증 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cashReceiptId } = await params;
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

    // 현금영수증 상세 정보 조회
    const { data: cashReceipt, error: receiptError } = await supabase
      .from('cash_receipt')
      .select(`
        *,
        user:user(id, name, email),
        transaction:transaction(
          id, amount, type, tossPaymentKey, tossOrderId, 
          status, description, createdAt, updatedAt
        )
      `)
      .eq('id', cashReceiptId)
      .single();

    if (receiptError || !cashReceipt) {
      return NextResponse.json({
        success: false,
        error: '현금영수증을 찾을 수 없습니다'
      }, { status: 404 });
    }

    // 토스페이먼츠에서 최신 상태 조회
    let tossInfo = null;
    if (cashReceipt.pay_token) {
      try {
        const infoResponse = await tossCashReceiptAPI.getCashReceiptInfo(cashReceipt.pay_token);
        if (infoResponse.success) {
          tossInfo = infoResponse;
        }
      } catch (error) {
        console.error('토스페이먼츠 현금영수증 정보 조회 오류:', error);
      }
    }

    // 팝업 URI 생성
    let popupUri = cashReceipt.popup_uri;
    if (!popupUri && cashReceipt.pay_token) {
      try {
        const popupResponse = await tossCashReceiptAPI.getCashReceiptPopupUri(cashReceipt.pay_token);
        if (popupResponse.success && popupResponse.popupUri) {
          popupUri = popupResponse.popupUri;
          
          // 팝업 URI를 데이터베이스에 저장
          await supabase
            .from('cash_receipt')
            .update({ popup_uri: popupResponse.popupUri })
            .eq('id', cashReceiptId);
        }
      } catch (error) {
        console.error('현금영수증 팝업 URI 생성 오류:', error);
      }
    }

    return NextResponse.json({
      success: true,
      cashReceipt: {
        ...cashReceipt,
        popup_uri: popupUri,
        toss_info: tossInfo
      }
    });

  } catch (error) {
    console.error('현금영수증 상세 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '현금영수증 상세 조회 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}

// PATCH: 현금영수증 상태 업데이트
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cashReceiptId } = await params;
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
    const { action } = body;

    // 현금영수증 조회
    const { data: cashReceipt, error: receiptError } = await supabase
      .from('cash_receipt')
      .select('*')
      .eq('id', cashReceiptId)
      .single();

    if (receiptError || !cashReceipt) {
      return NextResponse.json({
        success: false,
        error: '현금영수증을 찾을 수 없습니다'
      }, { status: 404 });
    }

    switch (action) {
      case 'update_status':
        // 토스페이먼츠에서 최신 상태 가져오기
        await cashReceiptAutomationService.updateCashReceiptStatus(cashReceiptId);
        
        return NextResponse.json({
          success: true,
          message: '현금영수증 상태가 업데이트되었습니다'
        });

      case 'revoke':
        // 현금영수증 취소
        const revokeResponse = await tossCashReceiptAPI.revokeCashReceipt(cashReceipt.pay_token);
        
        if (revokeResponse.success) {
          await supabase
            .from('cash_receipt')
            .update({
              status: 'REVOKED',
              revoked_at: new Date().toISOString(),
              processed_by: user.id,
              toss_response_data: revokeResponse.details,
              updated_at: new Date().toISOString()
            })
            .eq('id', cashReceiptId);

          // 활동 로그 추가
          await supabase
            .from('user_activities')
            .insert({
              user_id: cashReceipt.user_id,
              activity_type: 'admin_cash_receipt_revoked',
              activity_title: '관리자 현금영수증 취소',
              activity_description: `관리자 ${user.email}에 의해 현금영수증이 취소되었습니다.`,
              metadata: {
                cash_receipt_id: cashReceiptId,
                admin_user_id: user.id,
                revoke_reason: body.reason || '관리자에 의한 취소'
              }
            });

          return NextResponse.json({
            success: true,
            message: '현금영수증이 취소되었습니다'
          });
        } else {
          return NextResponse.json({
            success: false,
            error: revokeResponse.error || '현금영수증 취소에 실패했습니다'
          }, { status: 400 });
        }

      case 'generate_popup_uri':
        // 팝업 URI 생성/재생성
        const popupResponse = await tossCashReceiptAPI.getCashReceiptPopupUri(cashReceipt.pay_token);
        
        if (popupResponse.success) {
          await supabase
            .from('cash_receipt')
            .update({
              popup_uri: popupResponse.popupUri,
              updated_at: new Date().toISOString()
            })
            .eq('id', cashReceiptId);

          return NextResponse.json({
            success: true,
            popupUri: popupResponse.popupUri,
            message: '팝업 URI가 생성되었습니다'
          });
        } else {
          return NextResponse.json({
            success: false,
            error: popupResponse.error || '팝업 URI 생성에 실패했습니다'
          }, { status: 400 });
        }

      default:
        return NextResponse.json({
          success: false,
          error: '지원하지 않는 액션입니다'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('현금영수증 상태 업데이트 오류:', error);
    return NextResponse.json({
      success: false,
      error: '현금영수증 상태 업데이트 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}

// DELETE: 현금영수증 레코드 삭제 (취소와 다름 - 레코드 자체를 삭제)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cashReceiptId } = await params;
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

    // 현금영수증 조회
    const { data: cashReceipt, error: receiptError } = await supabase
      .from('cash_receipt')
      .select('*')
      .eq('id', cashReceiptId)
      .single();

    if (receiptError || !cashReceipt) {
      return NextResponse.json({
        success: false,
        error: '현금영수증을 찾을 수 없습니다'
      }, { status: 404 });
    }

    // 현금영수증 레코드 삭제
    const { error: deleteError } = await supabase
      .from('cash_receipt')
      .delete()
      .eq('id', cashReceiptId);

    if (deleteError) {
      throw deleteError;
    }

    // 활동 로그 추가
    await supabase
      .from('user_activities')
      .insert({
        user_id: cashReceipt.user_id,
        activity_type: 'admin_cash_receipt_deleted',
        activity_title: '관리자 현금영수증 삭제',
        activity_description: `관리자 ${user.email}에 의해 현금영수증 레코드가 삭제되었습니다.`,
        metadata: {
          cash_receipt_id: cashReceiptId,
          admin_user_id: user.id,
          deleted_receipt_data: cashReceipt
        }
      });

    return NextResponse.json({
      success: true,
      message: '현금영수증 레코드가 삭제되었습니다'
    });

  } catch (error) {
    console.error('현금영수증 삭제 오류:', error);
    return NextResponse.json({
      success: false,
      error: '현금영수증 삭제 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}