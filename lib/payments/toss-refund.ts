import { v4 as uuidv4 } from 'uuid';

// 환불 사유 카테고리
export enum RefundCategory {
  SERVICE_ISSUE = 'SERVICE_ISSUE',          // 서비스 문제
  BILLING_ERROR = 'BILLING_ERROR',          // 청구 오류
  USER_REQUEST = 'USER_REQUEST',            // 사용자 요청
  TECHNICAL_ISSUE = 'TECHNICAL_ISSUE',      // 기술적 문제
  POLICY_VIOLATION = 'POLICY_VIOLATION',    // 정책 위반
  PROMOTIONAL = 'PROMOTIONAL',              // 프로모션/마케팅
  ADMIN_DECISION = 'ADMIN_DECISION'         // 관리자 결정
}

// 환불 정책 타입
export enum RefundPolicyType {
  FULL_REFUND = 'FULL_REFUND',              // 전액 환불
  PARTIAL_50 = 'PARTIAL_50',                // 50% 환불
  PARTIAL_30 = 'PARTIAL_30',                // 30% 환불
  PARTIAL_CUSTOM = 'PARTIAL_CUSTOM',        // 커스텀 금액
  PRORATED = 'PRORATED',                    // 비례 환불 (사용 기간 기준)
  TOKEN_BASED = 'TOKEN_BASED'               // 토큰 사용량 기준 환불
}

// 환불 요청 타입
export interface RefundRequest {
  payToken: string;
  amount?: number; // 부분 환불 시 금액 (전액 환불이면 생략)
  reason: string;
  category: RefundCategory;
  policyType: RefundPolicyType;
  refundNo?: string; // 환불 번호 (자동 생성됨)
  adminNote?: string; // 관리자 메모
  originalAmount?: number; // 원래 결제 금액 (계산용)
  usedTokens?: number; // 사용된 토큰 수
  totalTokens?: number; // 전체 토큰 수
  usageDays?: number; // 사용 일수
  totalDays?: number; // 전체 구독 일수
}

// 환불 응답 타입
export interface RefundResponse {
  success: boolean;
  refundNo: string;
  approvalTime?: string;
  refundedAmount: number;
  totalRefundedAmount: number;
  error?: string;
  details?: any;
}

// 토스페이먼츠 환불 API 클라이언트
export class TossRefundAPI {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.TOSS_SECRET_KEY!;
    this.baseUrl = 'https://api.tosspayments.com';
  }

  /**
   * 결제 환불 요청
   */
  async requestRefund(refundRequest: RefundRequest): Promise<RefundResponse> {
    try {
      console.log('🔄 환불 요청 시작:', refundRequest);

      // 환불 번호 자동 생성
      const refundNo = refundRequest.refundNo || uuidv4();

      const requestBody = {
        cancelReason: refundRequest.reason,
        ...(refundRequest.amount && { cancelAmount: refundRequest.amount })
      };

      console.log('📤 토스페이먼츠 환불 API 요청:', {
        paymentKey: refundRequest.payToken,
        ...requestBody
      });

      const response = await fetch(`${this.baseUrl}/v1/payments/${refundRequest.payToken}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': refundNo
        },
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();
      console.log('📥 토스페이먼츠 환불 API 응답:', responseData);

      if (!response.ok) {
        console.error('❌ 환불 요청 실패:', responseData);
        return {
          success: false,
          refundNo,
          refundedAmount: 0,
          totalRefundedAmount: 0,
          error: responseData.message || '환불 처리 중 오류가 발생했습니다.',
          details: responseData
        };
      }

      // 환불 성공 시 응답 데이터 구조 (토스페이먼츠 v1 API)
      const cancelTransaction = responseData.cancels?.[0];
      return {
        success: true,
        refundNo,
        approvalTime: cancelTransaction?.approvedAt,
        refundedAmount: cancelTransaction?.cancelAmount || refundRequest.amount || 0,
        totalRefundedAmount: responseData.totalAmount || 0,
        details: responseData
      };

    } catch (error) {
      console.error('💥 환불 API 호출 오류:', error);
      
      return {
        success: false,
        refundNo: refundRequest.refundNo || uuidv4(),
        refundedAmount: 0,
        totalRefundedAmount: 0,
        error: error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 환불 내역 조회
   */
  async getRefundStatus(paymentKey: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/payments/${paymentKey}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`결제 내역 조회 실패: ${response.status}`);
      }

      const paymentData = await response.json();
      return {
        payment: paymentData,
        cancels: paymentData.cancels || [],
        totalCancelAmount: paymentData.cancels?.reduce((sum: number, cancel: any) => sum + cancel.cancelAmount, 0) || 0
      };
    } catch (error) {
      console.error('결제 내역 조회 오류:', error);
      throw error;
    }
  }
}

// 환불 API 인스턴스
export const tossRefundAPI = new TossRefundAPI();

// 환불 계산기
export class RefundCalculator {
  /**
   * 환불 정책에 따른 환불 금액 계산
   */
  static calculateRefundAmount(request: RefundRequest): number {
    const { policyType, originalAmount = 0, usedTokens = 0, totalTokens = 1, usageDays = 0, totalDays = 30 } = request;

    switch (policyType) {
      case RefundPolicyType.FULL_REFUND:
        return originalAmount;

      case RefundPolicyType.PARTIAL_50:
        return Math.round(originalAmount * 0.5);

      case RefundPolicyType.PARTIAL_30:
        return Math.round(originalAmount * 0.3);

      case RefundPolicyType.PARTIAL_CUSTOM:
        return request.amount || 0;

      case RefundPolicyType.PRORATED:
        // 사용하지 않은 기간에 대한 비례 환불
        const unusedDays = totalDays - usageDays;
        const dailyRate = originalAmount / totalDays;
        return Math.round(dailyRate * unusedDays);

      case RefundPolicyType.TOKEN_BASED:
        // 사용하지 않은 토큰에 대한 비례 환불
        const unusedTokens = totalTokens - usedTokens;
        const tokenRate = originalAmount / totalTokens;
        return Math.round(tokenRate * unusedTokens);

      default:
        return 0;
    }
  }

  /**
   * 환불 수수료 계산 (토스페이먼츠 정책에 따라)
   */
  static calculateRefundFee(amount: number, category: RefundCategory): number {
    // 일반적으로 환불 수수료는 없지만, 특정 카테고리에서는 수수료가 있을 수 있음
    switch (category) {
      case RefundCategory.USER_REQUEST:
        // 사용자 요청 환불의 경우 소액 수수료 (예: 500원)
        return Math.min(500, amount * 0.01);
      
      default:
        return 0; // 서비스 문제, 기술적 문제 등은 수수료 없음
    }
  }

  /**
   * 최종 환불 금액 계산 (수수료 제외)
   */
  static calculateFinalRefundAmount(request: RefundRequest): { refundAmount: number, fee: number, finalAmount: number } {
    const refundAmount = this.calculateRefundAmount(request);
    const fee = this.calculateRefundFee(refundAmount, request.category);
    const finalAmount = refundAmount - fee;

    return {
      refundAmount,
      fee,
      finalAmount: Math.max(0, finalAmount) // 음수 방지
    };
  }
}

// 환불 유틸리티 함수들
export const RefundUtils = {
  /**
   * 환불 가능 여부 확인
   */
  canRefund(paymentDate: Date, amount: number, status: string = 'COMPLETED'): boolean {
    const daysSincePayment = Math.floor(
      (Date.now() - paymentDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // 결제 상태가 완료되고, 결제일로부터 30일 이내, 금액이 0보다 큰 경우만 환불 가능
    return status === 'COMPLETED' && daysSincePayment <= 30 && amount > 0;
  },

  /**
   * 환불 사유 검증
   */
  validateRefundReason(reason: string, category: RefundCategory): boolean {
    if (!reason || reason.trim().length < 5) return false;

    // 카테고리별 사유 검증
    switch (category) {
      case RefundCategory.SERVICE_ISSUE:
      case RefundCategory.TECHNICAL_ISSUE:
        return reason.length >= 10; // 기술적 문제는 더 상세한 설명 필요
      
      default:
        return reason.length >= 5;
    }
  },

  /**
   * 부분 환불 가능 여부 확인
   */
  canPartialRefund(originalAmount: number, alreadyRefunded: number, requestAmount: number): boolean {
    const remainingAmount = originalAmount - alreadyRefunded;
    return requestAmount > 0 && requestAmount <= remainingAmount;
  },

  /**
   * 환불 정책 추천
   */
  recommendRefundPolicy(
    category: RefundCategory, 
    usageDays: number, 
    totalDays: number, 
    usedTokens: number, 
    totalTokens: number
  ): RefundPolicyType {
    // 카테고리별 추천 정책
    switch (category) {
      case RefundCategory.SERVICE_ISSUE:
      case RefundCategory.TECHNICAL_ISSUE:
        return RefundPolicyType.FULL_REFUND; // 서비스/기술 문제는 전액 환불

      case RefundCategory.BILLING_ERROR:
        return RefundPolicyType.FULL_REFUND; // 청구 오류는 전액 환불

      case RefundCategory.USER_REQUEST:
        // 사용량에 따른 추천
        const usageRate = usedTokens / totalTokens;
        if (usageRate < 0.1) return RefundPolicyType.FULL_REFUND;
        if (usageRate < 0.3) return RefundPolicyType.PARTIAL_50;
        return RefundPolicyType.TOKEN_BASED;

      case RefundCategory.POLICY_VIOLATION:
        return RefundPolicyType.PARTIAL_30; // 정책 위반은 30% 환불

      case RefundCategory.PROMOTIONAL:
        return RefundPolicyType.FULL_REFUND; // 프로모션은 전액 환불

      default:
        return RefundPolicyType.PRORATED; // 기본값은 비례 환불
    }
  },

  /**
   * 환불 사유 카테고리 설명
   */
  getCategoryDescription(category: RefundCategory): string {
    const descriptions = {
      [RefundCategory.SERVICE_ISSUE]: '서비스 품질 문제 또는 기능 오류',
      [RefundCategory.BILLING_ERROR]: '잘못된 청구 또는 중복 결제',
      [RefundCategory.USER_REQUEST]: '사용자의 단순 변심 또는 취소 요청',
      [RefundCategory.TECHNICAL_ISSUE]: '시스템 오류 또는 기술적 문제',
      [RefundCategory.POLICY_VIOLATION]: '서비스 이용약관 위반',
      [RefundCategory.PROMOTIONAL]: '프로모션 또는 마케팅 관련',
      [RefundCategory.ADMIN_DECISION]: '관리자 재량에 의한 결정'
    };
    return descriptions[category] || '기타 사유';
  },

  /**
   * 환불 정책 설명
   */
  getPolicyDescription(policy: RefundPolicyType): string {
    const descriptions = {
      [RefundPolicyType.FULL_REFUND]: '결제 금액 전액 환불',
      [RefundPolicyType.PARTIAL_50]: '결제 금액의 50% 환불',
      [RefundPolicyType.PARTIAL_30]: '결제 금액의 30% 환불',
      [RefundPolicyType.PARTIAL_CUSTOM]: '관리자 지정 금액 환불',
      [RefundPolicyType.PRORATED]: '사용 기간에 따른 비례 환불',
      [RefundPolicyType.TOKEN_BASED]: '토큰 사용량에 따른 비례 환불'
    };
    return descriptions[policy] || '기타 정책';
  }
};