import { createClient } from '@/lib/supabase/server';
import { 
  tossCashReceiptAPI, 
  CashReceiptKeyType, 
  CashReceiptPurpose, 
  CashReceiptStatus,
  CashReceiptUtils 
} from './toss-cash-receipt';

// 현금영수증 자동화 설정
export interface CashReceiptAutomationConfig {
  enabled: boolean;
  autoIssueForSubscriptions: boolean;
  autoIssueThreshold: number; // 최소 금액 (원)
  defaultPurpose: CashReceiptPurpose;
  retryAttempts: number;
  retryDelayHours: number;
}

// 기본 자동화 설정
export const DEFAULT_AUTOMATION_CONFIG: CashReceiptAutomationConfig = {
  enabled: true,
  autoIssueForSubscriptions: true,
  autoIssueThreshold: 10000, // 1만원 이상
  defaultPurpose: CashReceiptPurpose.DEDUCTION,
  retryAttempts: 3,
  retryDelayHours: 1
};

// 현금영수증 자동화 서비스
export class CashReceiptAutomationService {
  private config: CashReceiptAutomationConfig;

  constructor(config: CashReceiptAutomationConfig = DEFAULT_AUTOMATION_CONFIG) {
    this.config = config;
  }

  /**
   * 결제 완료 시 자동으로 현금영수증 발급 처리
   */
  async processPaymentCompletedForCashReceipt(transactionId: string): Promise<void> {
    if (!this.config.enabled) {
      console.log('💡 현금영수증 자동화가 비활성화됨');
      return;
    }

    try {
      console.log('🧾 결제 완료 후 현금영수증 자동 처리 시작:', { transactionId });

      const supabase = await createClient();

      // 거래 정보 조회
      const { data: transaction, error: transactionError } = await supabase
        .from('transaction')
        .select(`
          *,
          user:user(*)
        `)
        .eq('id', transactionId)
        .single();

      if (transactionError || !transaction) {
        console.error('❌ 거래 정보 조회 실패:', transactionError);
        return;
      }

      // 자동 발급 조건 확인
      if (!this.shouldAutoIssueCashReceipt(transaction)) {
        console.log('💡 현금영수증 자동 발급 조건에 맞지 않음');
        return;
      }

      // 사용자의 현금영수증 설정 확인
      const userCashReceiptSettings = await this.getUserCashReceiptSettings(transaction.userId);
      
      if (!userCashReceiptSettings || !userCashReceiptSettings.autoIssue) {
        console.log('💡 사용자가 현금영수증 자동 발급을 설정하지 않음');
        return;
      }

      // 현금영수증 발급 요청
      await this.issueCashReceiptForTransaction(
        transaction,
        userCashReceiptSettings.cashReceiptKey,
        userCashReceiptSettings.cashReceiptKeyType,
        userCashReceiptSettings.cashReceiptPurpose
      );

    } catch (error) {
      console.error('💥 현금영수증 자동 처리 오류:', error);
    }
  }

  /**
   * 특정 거래에 대해 현금영수증 발급
   */
  async issueCashReceiptForTransaction(
    transaction: any,
    cashReceiptKey: string,
    cashReceiptKeyType: CashReceiptKeyType,
    cashReceiptPurpose: CashReceiptPurpose
  ): Promise<{ success: boolean; cashReceiptId?: string; error?: string }> {
    try {
      console.log('🧾 현금영수증 발급 시작:', {
        transactionId: transaction.id,
        amount: transaction.amount,
        keyType: cashReceiptKeyType
      });

      const supabase = await createClient();

      // 이미 현금영수증이 있는지 확인
      const { data: existingReceipt } = await supabase
        .from('cash_receipt')
        .select('id, status')
        .eq('transaction_id', transaction.id)
        .single();

      if (existingReceipt) {
        console.log('💡 이미 현금영수증이 존재함:', existingReceipt.id);
        return { success: false, error: '이미 현금영수증이 발급되었습니다' };
      }

      // 입력값 유효성 검사
      if (!CashReceiptUtils.validateCashReceiptKey(cashReceiptKey, cashReceiptKeyType)) {
        throw new Error('현금영수증 식별자가 유효하지 않습니다');
      }

      // 현금영수증 레코드 생성 (발급 전)
      const { data: cashReceiptRecord, error: insertError } = await supabase
        .from('cash_receipt')
        .insert({
          user_id: transaction.userId,
          transaction_id: transaction.id,
          pay_token: transaction.tossPaymentKey,
          cash_receipt_key: cashReceiptKey,
          cash_receipt_key_type: cashReceiptKeyType,
          cash_receipt_purpose: cashReceiptPurpose,
          status: CashReceiptStatus.REQUESTED,
          auto_issue: true,
          issue_requested: true
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ 현금영수증 레코드 생성 실패:', insertError);
        throw new Error('현금영수증 레코드 생성에 실패했습니다');
      }

      // 토스페이먼츠 현금영수증 발급 API 호출
      const issueResponse = await tossCashReceiptAPI.issueCashReceipt({
        payToken: transaction.tossPaymentKey,
        cashReceiptKey,
        cashReceiptKeyType,
        cashReceiptPurpose
      });

      // 결과에 따라 상태 업데이트
      if (issueResponse.success) {
        console.log('✅ 현금영수증 발급 성공:', issueResponse.cashReceiptMgtKey);

        await supabase
          .from('cash_receipt')
          .update({
            status: CashReceiptStatus.IN_PROGRESS,
            cash_receipt_mgt_key: issueResponse.cashReceiptMgtKey,
            supply_cost: issueResponse.supplyCost,
            tax: issueResponse.tax,
            service_fee: issueResponse.serviceFee,
            issued_at: new Date().toISOString(),
            toss_response_data: issueResponse.details,
            updated_at: new Date().toISOString()
          })
          .eq('id', cashReceiptRecord.id);

        // 사용자 활동 로그 추가
        await this.logCashReceiptActivity(
          transaction.userId,
          'cash_receipt_issued',
          '현금영수증 자동 발급 완료',
          `${transaction.amount.toLocaleString()}원 결제에 대한 현금영수증이 자동으로 발급되었습니다.`,
          {
            transaction_id: transaction.id,
            cash_receipt_id: cashReceiptRecord.id,
            cash_receipt_mgt_key: issueResponse.cashReceiptMgtKey,
            amount: transaction.amount,
            key_type: cashReceiptKeyType,
            purpose: cashReceiptPurpose
          }
        );

        return { success: true, cashReceiptId: cashReceiptRecord.id };

      } else {
        console.error('❌ 현금영수증 발급 실패:', issueResponse.error);

        await supabase
          .from('cash_receipt')
          .update({
            status: CashReceiptStatus.ISSUE_FAILED,
            failure_reason: issueResponse.error,
            toss_response_data: issueResponse.details,
            updated_at: new Date().toISOString()
          })
          .eq('id', cashReceiptRecord.id);

        return { success: false, error: issueResponse.error };
      }

    } catch (error) {
      console.error('💥 현금영수증 발급 오류:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '현금영수증 발급 중 오류가 발생했습니다' 
      };
    }
  }

  /**
   * 현금영수증 상태 업데이트 (주기적 확인용)
   */
  async updateCashReceiptStatus(cashReceiptId: string): Promise<void> {
    try {
      const supabase = await createClient();

      const { data: cashReceipt, error } = await supabase
        .from('cash_receipt')
        .select('*')
        .eq('id', cashReceiptId)
        .single();

      if (error || !cashReceipt) {
        console.error('❌ 현금영수증 조회 실패:', error);
        return;
      }

      // 이미 완료되거나 실패한 경우 스킵
      if ([CashReceiptStatus.ISSUE_COMPLETE, CashReceiptStatus.ISSUE_FAILED, CashReceiptStatus.REVOKED].includes(cashReceipt.status)) {
        return;
      }

      // 토스페이먼츠에서 현금영수증 정보 조회
      const infoResponse = await tossCashReceiptAPI.getCashReceiptInfo(cashReceipt.pay_token);

      if (infoResponse.success && infoResponse.status) {
        // 상태가 변경된 경우 업데이트
        if (infoResponse.status !== cashReceipt.issue_status) {
          await supabase
            .from('cash_receipt')
            .update({
              status: this.mapTossStatusToOurStatus(infoResponse.status),
              issue_status: infoResponse.status,
              customer_name: infoResponse.customerName,
              item_name: infoResponse.itemName,
              identity_num: infoResponse.identityNum,
              taxation_type: infoResponse.taxationType,
              total_amount: infoResponse.totalAmount,
              trade_usage: infoResponse.tradeUsage,
              trade_type: infoResponse.tradeType,
              toss_response_data: infoResponse.details,
              updated_at: new Date().toISOString()
            })
            .eq('id', cashReceiptId);

          console.log('📋 현금영수증 상태 업데이트:', {
            cashReceiptId,
            newStatus: infoResponse.status
          });
        }
      }

    } catch (error) {
      console.error('💥 현금영수증 상태 업데이트 오류:', error);
    }
  }

  /**
   * 현금영수증 취소 (환불 시)
   */
  async revokeCashReceiptForRefund(transactionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🗑️ 환불로 인한 현금영수증 취소 시작:', { transactionId });

      const supabase = await createClient();

      // 현금영수증 조회
      const { data: cashReceipt, error } = await supabase
        .from('cash_receipt')
        .select('*')
        .eq('transaction_id', transactionId)
        .single();

      if (error || !cashReceipt) {
        console.log('💡 취소할 현금영수증이 없음');
        return { success: true }; // 현금영수증이 없으면 성공으로 처리
      }

      // 이미 취소된 경우
      if (cashReceipt.status === CashReceiptStatus.REVOKED) {
        console.log('💡 이미 취소된 현금영수증');
        return { success: true };
      }

      // 토스페이먼츠 현금영수증 취소 API 호출
      const revokeResponse = await tossCashReceiptAPI.revokeCashReceipt(cashReceipt.pay_token);

      if (revokeResponse.success) {
        // 취소 성공 시 상태 업데이트
        await supabase
          .from('cash_receipt')
          .update({
            status: CashReceiptStatus.REVOKED,
            revoked_at: new Date().toISOString(),
            toss_response_data: revokeResponse.details,
            updated_at: new Date().toISOString()
          })
          .eq('id', cashReceipt.id);

        console.log('✅ 현금영수증 취소 완료');
        return { success: true };

      } else {
        console.error('❌ 현금영수증 취소 실패:', revokeResponse.error);
        return { success: false, error: revokeResponse.error };
      }

    } catch (error) {
      console.error('💥 현금영수증 취소 오류:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '현금영수증 취소 중 오류가 발생했습니다' 
      };
    }
  }

  /**
   * 사용자 현금영수증 설정 조회
   */
  private async getUserCashReceiptSettings(userId: string) {
    try {
      const supabase = await createClient();

      // 사용자의 가장 최근 현금영수증 설정 조회
      const { data: settings, error } = await supabase
        .from('cash_receipt')
        .select('cash_receipt_key, cash_receipt_key_type, cash_receipt_purpose, auto_issue')
        .eq('user_id', userId)
        .eq('auto_issue', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !settings) {
        // 설정이 없으면 기본값 반환 (자동 발급 비활성화)
        return null;
      }

      return {
        cashReceiptKey: settings.cash_receipt_key,
        cashReceiptKeyType: settings.cash_receipt_key_type,
        cashReceiptPurpose: settings.cash_receipt_purpose,
        autoIssue: settings.auto_issue
      };

    } catch (error) {
      console.error('💥 사용자 현금영수증 설정 조회 오류:', error);
      return null;
    }
  }

  /**
   * 자동 발급 조건 확인
   */
  private shouldAutoIssueCashReceipt(transaction: any): boolean {
    // 결제가 완료되지 않은 경우
    if (transaction.status !== 'COMPLETED') {
      return false;
    }

    // 최소 금액 미달
    if (transaction.amount < this.config.autoIssueThreshold) {
      return false;
    }

    // 구독 결제가 아닌 경우 (설정에 따라)
    if (!this.config.autoIssueForSubscriptions && transaction.type === 'SUBSCRIPTION') {
      return false;
    }

    // 토스페이먼츠 결제 토큰이 없는 경우
    if (!transaction.tossPaymentKey) {
      return false;
    }

    return true;
  }

  /**
   * 토스페이먼츠 상태를 우리 시스템 상태로 매핑
   */
  private mapTossStatusToOurStatus(tossStatus: string): CashReceiptStatus {
    switch (tossStatus) {
      case 'IN_PROGRESS':
        return CashReceiptStatus.IN_PROGRESS;
      case 'ISSUE_APPLIED':
        return CashReceiptStatus.ISSUE_APPLIED;
      case 'ISSUE_COMPLETE':
        return CashReceiptStatus.ISSUE_COMPLETE;
      case 'ISSUE_FAILED':
        return CashReceiptStatus.ISSUE_FAILED;
      default:
        return CashReceiptStatus.PENDING;
    }
  }

  /**
   * 사용자 활동 로그 추가
   */
  private async logCashReceiptActivity(
    userId: string,
    activityType: string,
    activityTitle: string,
    activityDescription: string,
    metadata: any
  ): Promise<void> {
    try {
      const supabase = await createClient();

      await supabase
        .from('user_activities')
        .insert({
          user_id: userId,
          activity_type: activityType,
          activity_title: activityTitle,
          activity_description: activityDescription,
          metadata
        });

    } catch (error) {
      console.error('💥 사용자 활동 로그 추가 오류:', error);
    }
  }
}

// 현금영수증 자동화 서비스 인스턴스
export const cashReceiptAutomationService = new CashReceiptAutomationService();

// 현금영수증 배치 작업 (주기적 상태 확인)
export class CashReceiptBatchService {
  /**
   * 진행 중인 현금영수증들의 상태 업데이트
   */
  static async updatePendingCashReceipts(): Promise<void> {
    try {
      console.log('🔄 진행 중인 현금영수증 상태 업데이트 시작');

      const supabase = await createClient();

      // 진행 중인 현금영수증들 조회
      const { data: pendingReceipts, error } = await supabase
        .from('cash_receipt')
        .select('id')
        .in('status', [
          CashReceiptStatus.REQUESTED,
          CashReceiptStatus.IN_PROGRESS,
          CashReceiptStatus.ISSUE_APPLIED
        ])
        .order('created_at', { ascending: true })
        .limit(50); // 한 번에 50개씩 처리

      if (error) {
        console.error('❌ 진행 중인 현금영수증 조회 실패:', error);
        return;
      }

      if (!pendingReceipts || pendingReceipts.length === 0) {
        console.log('💡 진행 중인 현금영수증이 없음');
        return;
      }

      console.log(`📋 ${pendingReceipts.length}개의 현금영수증 상태 확인 중`);

      // 각 현금영수증 상태 업데이트
      for (const receipt of pendingReceipts) {
        await cashReceiptAutomationService.updateCashReceiptStatus(receipt.id);
        // API 호출 제한을 위한 딜레이
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('✅ 현금영수증 상태 업데이트 완료');

    } catch (error) {
      console.error('💥 현금영수증 배치 작업 오류:', error);
    }
  }

  /**
   * 실패한 현금영수증 재시도
   */
  static async retryFailedCashReceipts(): Promise<void> {
    try {
      console.log('🔄 실패한 현금영수증 재시도 시작');

      const supabase = await createClient();

      // 재시도 가능한 실패 현금영수증들 조회
      const retryBefore = new Date();
      retryBefore.setHours(retryBefore.getHours() - DEFAULT_AUTOMATION_CONFIG.retryDelayHours);

      const { data: failedReceipts, error } = await supabase
        .from('cash_receipt')
        .select(`
          id,
          user_id,
          transaction_id,
          cash_receipt_key,
          cash_receipt_key_type,
          cash_receipt_purpose,
          created_at,
          transaction:transaction(*)
        `)
        .eq('status', CashReceiptStatus.ISSUE_FAILED)
        .lt('updated_at', retryBefore.toISOString())
        .limit(10); // 한 번에 10개씩 재시도

      if (error || !failedReceipts || failedReceipts.length === 0) {
        console.log('💡 재시도할 실패 현금영수증이 없음');
        return;
      }

      console.log(`📋 ${failedReceipts.length}개의 실패 현금영수증 재시도 중`);

      for (const receipt of failedReceipts) {
        try {
          await cashReceiptAutomationService.issueCashReceiptForTransaction(
            receipt.transaction,
            receipt.cash_receipt_key,
            receipt.cash_receipt_key_type,
            receipt.cash_receipt_purpose
          );

          // 재시도 딜레이
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (retryError) {
          console.error(`❌ 현금영수증 재시도 실패 (${receipt.id}):`, retryError);
        }
      }

      console.log('✅ 실패한 현금영수증 재시도 완료');

    } catch (error) {
      console.error('💥 현금영수증 재시도 배치 작업 오류:', error);
    }
  }
}