import { NextRequest, NextResponse } from 'next/server';
import { CashReceiptBatchService } from '@/lib/payments/cash-receipt-automation';

// 현금영수증 배치 작업 (크론 작업용)
// Vercel Cron Jobs 또는 외부 스케줄러에서 호출
export async function POST(request: NextRequest) {
  try {
    // 보안을 위한 크론 시크릿 확인
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;
    
    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({
        success: false,
        error: '인증되지 않은 요청입니다'
      }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { action = 'update_pending' } = body;

    console.log('🔄 현금영수증 배치 작업 시작:', { action });

    switch (action) {
      case 'update_pending':
        // 진행 중인 현금영수증들의 상태 업데이트
        await CashReceiptBatchService.updatePendingCashReceipts();
        break;

      case 'retry_failed':
        // 실패한 현금영수증들 재시도
        await CashReceiptBatchService.retryFailedCashReceipts();
        break;

      case 'all':
        // 모든 배치 작업 실행
        await CashReceiptBatchService.updatePendingCashReceipts();
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 딜레이
        await CashReceiptBatchService.retryFailedCashReceipts();
        break;

      default:
        return NextResponse.json({
          success: false,
          error: '지원하지 않는 액션입니다'
        }, { status: 400 });
    }

    console.log('✅ 현금영수증 배치 작업 완료:', { action });

    return NextResponse.json({
      success: true,
      message: `현금영수증 배치 작업이 완료되었습니다 (${action})`
    });

  } catch (error) {
    console.error('💥 현금영수증 배치 작업 오류:', error);
    return NextResponse.json({
      success: false,
      error: '배치 작업 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}

// GET 요청 (헬스 체크용)
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: '현금영수증 배치 작업 API가 정상적으로 작동 중입니다',
    timestamp: new Date().toISOString()
  });
}