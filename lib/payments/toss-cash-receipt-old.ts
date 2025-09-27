import { v4 as uuidv4 } from 'uuid';

// 현금영수증 식별자 타입
export enum CashReceiptKeyType {
  PHONE = 'PHONE',           // 휴대폰 번호
  CORPORATE = 'CORPORATE',   // 사업자등록번호
  CARD = 'CARD'             // 현금영수증 카드
}

// 현금영수증 용도
export enum CashReceiptPurpose {
  DEDUCTION = 'DEDUCTION',   // 소득공제 (개인)
  EVIDENCE = 'EVIDENCE'      // 지출증빙 (사업자)
}

// 현금영수증 상태
export enum CashReceiptStatus {
  IN_PROGRESS = 'IN_PROGRESS',       // 국세청 전송중
  ISSUE_APPLIED = 'ISSUE_APPLIED',   // 발급신청 완료
  ISSUE_COMPLETE = 'ISSUE_COMPLETE', // 발급 완료
  ISSUE_FAILED = 'ISSUE_FAILED',     // 발급 실패
  REVOKED = 'REVOKED'                // 취소됨
}

// 현금영수증 발급 요청
export interface CashReceiptIssueRequest {
  payToken: string;
  cashReceiptKey: string;
  cashReceiptKeyType: CashReceiptKeyType;
  cashReceiptPurpose: CashReceiptPurpose;
  needSelfIssue?: boolean;
  isCurrentCashReceiptKeyUsage?: boolean;
}

// 현금영수증 발급 응답
export interface CashReceiptIssueResponse {
  success: boolean;
  code: number;
  cashReceiptMgtKey?: string;
  supplyCost?: number;
  tax?: number;
  serviceFee?: number;
  error?: string;
  details?: any;
}

// 현금영수증 정보 응답
export interface CashReceiptInfoResponse {
  success: boolean;
  code: number;
  cashReceiptMgtKey?: string;
  customerName?: string;
  itemName?: string;
  identityNum?: string;
  taxationType?: string;
  totalAmount?: number;
  tradeUsage?: string;
  tradeType?: string;
  status?: CashReceiptStatus;
  error?: string;
  details?: any;
}

// 현금영수증 취소 응답
export interface CashReceiptRevokeResponse {
  success: boolean;
  code: number;
  cashReceiptMgtKey?: string;
  supplyCost?: number;
  tax?: number;
  serviceFee?: number;
  error?: string;
  details?: any;
}

// 현금영수증 팝업 URI 응답
export interface CashReceiptPopupResponse {
  success: boolean;
  code: number;
  popupUri?: string;
  error?: string;
  details?: any;
}

// 토스페이먼츠 현금영수증 API 클라이언트
export class TossCashReceiptAPI {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.TOSS_SECRET_KEY!;
    this.baseUrl = 'https://pay.toss.im/api/v2';

    if (!this.apiKey) {
      throw new Error('TOSS_SECRET_KEY is required for cash receipt API');
    }

    // API 키 유효성 검증
    if (!this.apiKey.startsWith('test_sk_') && !this.apiKey.startsWith('live_sk_')) {
      throw new Error('Invalid TOSS_SECRET_KEY format. Must start with test_sk_ or live_sk_');
    }
  }

  /**
   * 현금영수증 발급
   */
  async issueCashReceipt(request: CashReceiptIssueRequest): Promise<CashReceiptIssueResponse> {
    try {
      console.log('🧾 현금영수증 발급 요청:', {
        payToken: request.payToken,
        cashReceiptKeyType: request.cashReceiptKeyType,
        cashReceiptPurpose: request.cashReceiptPurpose,
        cashReceiptKey: request.cashReceiptKey.substring(0, 3) + '***' // 개인정보 보호
      });

      const requestBody = {
        apiKey: this.apiKey,
        payToken: request.payToken,
        cashReceiptKey: request.cashReceiptKey,
        cashReceiptKeyType: request.cashReceiptKeyType,
        cashReceiptPurpose: request.cashReceiptPurpose,
        ...(request.needSelfIssue !== undefined && { needSelfIssue: request.needSelfIssue }),
        ...(request.isCurrentCashReceiptKeyUsage !== undefined && { 
          isCurrentCashReceiptKeyUsage: request.isCurrentCashReceiptKeyUsage 
        })
      };

      const response = await fetch(`${this.baseUrl}/issue-cash-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GenToon-CashReceipt-System/1.0'
        },
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();
      console.log('📋 현금영수증 발급 응답:', {
        ...responseData,
        // 민감한 정보는 로그에서 제외
        cashReceiptMgtKey: responseData.cashReceiptMgtKey ? '***' + responseData.cashReceiptMgtKey.slice(-4) : undefined
      });

      if (!response.ok || responseData.code !== 0) {
        console.error('❌ 현금영수증 발급 실패:', responseData);
        return {
          success: false,
          code: responseData.code || response.status,
          error: responseData.message || responseData.errorMessage || '현금영수증 발급에 실패했습니다.',
          details: responseData
        };
      }

      return {
        success: true,
        code: responseData.code,
        cashReceiptMgtKey: responseData.cashReceiptMgtKey,
        supplyCost: responseData.supplyCost,
        tax: responseData.tax,
        serviceFee: responseData.serviceFee,
        details: responseData
      };

    } catch (error) {
      console.error('💥 현금영수증 발급 API 오류:', error);
      
      return {
        success: false,
        code: -1,
        error: error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 현금영수증 취소
   */
  async revokeCashReceipt(payToken: string): Promise<CashReceiptRevokeResponse> {
    try {
      console.log('🗑️ 현금영수증 취소 요청:', { payToken });

      const requestBody = {
        apiKey: this.apiKey,
        payToken: payToken
      };

      const response = await fetch(`${this.baseUrl}/revoke-cash-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GenToon-CashReceipt-System/1.0'
        },
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();
      console.log('📋 현금영수증 취소 응답:', responseData);

      if (!response.ok || responseData.code !== 0) {
        console.error('❌ 현금영수증 취소 실패:', responseData);
        return {
          success: false,
          code: responseData.code || response.status,
          error: responseData.message || responseData.errorMessage || '현금영수증 취소에 실패했습니다.',
          details: responseData
        };
      }

      return {
        success: true,
        code: responseData.code,
        cashReceiptMgtKey: responseData.cashReceiptMgtKey,
        supplyCost: responseData.supplyCost,
        tax: responseData.tax,
        serviceFee: responseData.serviceFee,
        details: responseData
      };

    } catch (error) {
      console.error('💥 현금영수증 취소 API 오류:', error);
      
      return {
        success: false,
        code: -1,
        error: error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 현금영수증 정보 조회
   */
  async getCashReceiptInfo(payToken: string): Promise<CashReceiptInfoResponse> {
    try {
      console.log('🔍 현금영수증 정보 조회:', { payToken });

      const requestBody = {
        apiKey: this.apiKey,
        payToken: payToken
      };

      const response = await fetch(`${this.baseUrl}/cash-receipt-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GenToon-CashReceipt-System/1.0'
        },
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();
      console.log('📋 현금영수증 정보 응답:', {
        ...responseData,
        // 개인정보 보호
        customerName: responseData.customerName ? responseData.customerName.substring(0, 1) + '***' : undefined,
        identityNum: responseData.identityNum ? '***' : undefined
      });

      if (!response.ok || responseData.code !== 0) {
        console.error('❌ 현금영수증 정보 조회 실패:', responseData);
        return {
          success: false,
          code: responseData.code || response.status,
          error: responseData.message || responseData.errorMessage || '현금영수증 정보 조회에 실패했습니다.',
          details: responseData
        };
      }

      return {
        success: true,
        code: responseData.code,
        cashReceiptMgtKey: responseData.cashReceiptMgtKey,
        customerName: responseData.customerName,
        itemName: responseData.itemName,
        identityNum: responseData.identityNum,
        taxationType: responseData.taxationType,
        totalAmount: responseData.totalAmount,
        tradeUsage: responseData.tradeUsage,
        tradeType: responseData.tradeType,
        status: responseData.status as CashReceiptStatus,
        details: responseData
      };

    } catch (error) {
      console.error('💥 현금영수증 정보 조회 API 오류:', error);
      
      return {
        success: false,
        code: -1,
        error: error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 현금영수증 팝업 URI 생성
   */
  async getCashReceiptPopupUri(payToken: string): Promise<CashReceiptPopupResponse> {
    try {
      console.log('🔗 현금영수증 팝업 URI 요청:', { payToken });

      const requestBody = {
        apiKey: this.apiKey,
        payToken: payToken
      };

      const response = await fetch(`${this.baseUrl}/cash-receipt-popupUri`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GenToon-CashReceipt-System/1.0'
        },
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();
      console.log('📋 현금영수증 팝업 URI 응답:', responseData);

      if (!response.ok || responseData.code !== 0) {
        console.error('❌ 현금영수증 팝업 URI 생성 실패:', responseData);
        return {
          success: false,
          code: responseData.code || response.status,
          error: responseData.message || responseData.errorMessage || '현금영수증 팝업 URI 생성에 실패했습니다.',
          details: responseData
        };
      }

      return {
        success: true,
        code: responseData.code,
        popupUri: responseData.popupUri,
        details: responseData
      };

    } catch (error) {
      console.error('💥 현금영수증 팝업 URI API 오류:', error);
      
      return {
        success: false,
        code: -1,
        error: error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.'
      };
    }
  }
}

// 현금영수증 API 인스턴스
export const tossCashReceiptAPI = new TossCashReceiptAPI();

// 현금영수증 유틸리티 함수들
export const CashReceiptUtils = {
  /**
   * 휴대폰 번호 유효성 검사
   */
  validatePhoneNumber(phone: string): boolean {
    const phoneRegex = /^01[016789]\d{7,8}$/;
    return phoneRegex.test(phone.replace(/[-\s]/g, ''));
  },

  /**
   * 사업자등록번호 유효성 검사
   */
  validateBusinessNumber(businessNumber: string): boolean {
    const cleaned = businessNumber.replace(/[-]/g, '');
    if (cleaned.length !== 10) return false;
    
    const digits = cleaned.split('').map(Number);
    const checksum = [1, 3, 7, 1, 3, 7, 1, 3, 5];
    
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += digits[i] * checksum[i];
    }
    
    const remainder = sum % 10;
    const checkDigit = remainder === 0 ? 0 : 10 - remainder;
    
    return checkDigit === digits[9];
  },

  /**
   * 현금영수증 카드번호 유효성 검사 (16자리)
   */
  validateCashReceiptCard(cardNumber: string): boolean {
    const cleaned = cardNumber.replace(/[-\s]/g, '');
    return /^\d{16}$/.test(cleaned);
  },

  /**
   * 식별자 타입에 따른 유효성 검사
   */
  validateCashReceiptKey(key: string, type: CashReceiptKeyType): boolean {
    switch (type) {
      case CashReceiptKeyType.PHONE:
        return this.validatePhoneNumber(key);
      case CashReceiptKeyType.CORPORATE:
        return this.validateBusinessNumber(key);
      case CashReceiptKeyType.CARD:
        return this.validateCashReceiptCard(key);
      default:
        return false;
    }
  },

  /**
   * 현금영수증 용도 추천 (개인/사업자 구분)
   */
  recommendPurpose(keyType: CashReceiptKeyType): CashReceiptPurpose {
    switch (keyType) {
      case CashReceiptKeyType.PHONE:
        return CashReceiptPurpose.DEDUCTION; // 개인 - 소득공제
      case CashReceiptKeyType.CORPORATE:
        return CashReceiptPurpose.EVIDENCE; // 사업자 - 지출증빙
      case CashReceiptKeyType.CARD:
        return CashReceiptPurpose.DEDUCTION; // 현금영수증카드 - 일반적으로 소득공제
      default:
        return CashReceiptPurpose.DEDUCTION;
    }
  },

  /**
   * 현금영수증 상태 한국어 설명
   */
  getStatusDescription(status: CashReceiptStatus): string {
    const descriptions = {
      [CashReceiptStatus.IN_PROGRESS]: '국세청 전송 중',
      [CashReceiptStatus.ISSUE_APPLIED]: '발급 신청 완료',
      [CashReceiptStatus.ISSUE_COMPLETE]: '발급 완료',
      [CashReceiptStatus.ISSUE_FAILED]: '발급 실패',
      [CashReceiptStatus.REVOKED]: '취소됨'
    };
    return descriptions[status] || '알 수 없음';
  },

  /**
   * 현금영수증 식별자 마스킹 (개인정보 보호)
   */
  maskCashReceiptKey(key: string, type: CashReceiptKeyType): string {
    switch (type) {
      case CashReceiptKeyType.PHONE:
        return key.substring(0, 3) + '****' + key.substring(7);
      case CashReceiptKeyType.CORPORATE:
        return key.substring(0, 3) + '***' + key.substring(6);
      case CashReceiptKeyType.CARD:
        return key.substring(0, 4) + '********' + key.substring(12);
      default:
        return '***';
    }
  }
};