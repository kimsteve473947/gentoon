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

// 현금영수증 상태 (토스페이먼츠 공식 상태값)
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

// 토스페이먼츠 현금영수증 API 클라이언트 (수정된 버전)
export class TossCashReceiptAPI {
  private apiKey: string;
  private baseUrl: string;
  private isLiveMode: boolean;

  constructor() {
    this.apiKey = process.env.TOSS_SECRET_KEY!;
    this.baseUrl = 'https://pay.toss.im/api/v2';

    if (!this.apiKey) {
      throw new Error('TOSS_SECRET_KEY is required for cash receipt API');
    }

    // API 키 유효성 검증 및 모드 감지
    if (this.apiKey.startsWith('test_sk_')) {
      this.isLiveMode = false;
    } else if (this.apiKey.startsWith('live_sk_')) {
      this.isLiveMode = true;
    } else {
      throw new Error('Invalid TOSS_SECRET_KEY format. Must start with test_sk_ or live_sk_');
    }

    console.log(`🔧 TossCashReceiptAPI initialized in ${this.isLiveMode ? 'LIVE' : 'TEST'} mode`);
  }

  /**
   * Basic Authentication 헤더 생성 (토스페이먼츠 표준)
   */
  private getAuthHeaders(): Record<string, string> {
    // Basic Authentication: API_KEY를 사용자명으로, 비밀번호는 빈 문자열
    const credentials = Buffer.from(`${this.apiKey}:`).toString('base64');
    
    return {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
      'User-Agent': 'GenToon-CashReceipt-System/1.0'
    };
  }

  /**
   * 응답 데이터 검증 및 표준화
   */
  private validateResponse(response: Response, data: any) {
    // 토스페이먼츠 표준: code가 0이면 성공
    if (response.ok && data.code === 0) {
      return true;
    }
    return false;
  }

  /**
   * 오류 메시지 표준화 (토스페이먼츠 에러 형식 기준)
   */
  private standardizeError(data: any): string {
    return data.message || data.errorMessage || data.error || '알 수 없는 오류가 발생했습니다';
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
        headers: this.getAuthHeaders(),
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();
      
      console.log('📋 현금영수증 발급 응답:', {
        code: responseData.code,
        success: this.validateResponse(response, responseData),
        cashReceiptMgtKey: responseData.cashReceiptMgtKey ? '***' + responseData.cashReceiptMgtKey.slice(-4) : undefined
      });

      if (!this.validateResponse(response, responseData)) {
        console.error('❌ 현금영수증 발급 실패:', {
          status: response.status,
          code: responseData.code,
          message: this.standardizeError(responseData)
        });
        
        return {
          success: false,
          code: responseData.code || response.status,
          error: this.standardizeError(responseData),
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
        payToken: payToken
      };

      const response = await fetch(`${this.baseUrl}/revoke-cash-receipt`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();
      console.log('📋 현금영수증 취소 응답:', {
        code: responseData.code,
        success: this.validateResponse(response, responseData)
      });

      if (!this.validateResponse(response, responseData)) {
        console.error('❌ 현금영수증 취소 실패:', {
          status: response.status,
          code: responseData.code,
          message: this.standardizeError(responseData)
        });
        
        return {
          success: false,
          code: responseData.code || response.status,
          error: this.standardizeError(responseData),
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
        payToken: payToken
      };

      const response = await fetch(`${this.baseUrl}/cash-receipt-info`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();
      console.log('📋 현금영수증 정보 응답:', {
        code: responseData.code,
        success: this.validateResponse(response, responseData),
        status: responseData.status,
        customerName: responseData.customerName ? responseData.customerName.substring(0, 1) + '***' : undefined
      });

      if (!this.validateResponse(response, responseData)) {
        console.error('❌ 현금영수증 정보 조회 실패:', {
          status: response.status,
          code: responseData.code,
          message: this.standardizeError(responseData)
        });
        
        return {
          success: false,
          code: responseData.code || response.status,
          error: this.standardizeError(responseData),
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
        payToken: payToken
      };

      const response = await fetch(`${this.baseUrl}/cash-receipt-popupUri`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();
      console.log('📋 현금영수증 팝업 URI 응답:', {
        code: responseData.code,
        success: this.validateResponse(response, responseData),
        hasPopupUri: !!responseData.popupUri
      });

      if (!this.validateResponse(response, responseData)) {
        console.error('❌ 현금영수증 팝업 URI 생성 실패:', {
          status: response.status,
          code: responseData.code,
          message: this.standardizeError(responseData)
        });
        
        return {
          success: false,
          code: responseData.code || response.status,
          error: this.standardizeError(responseData),
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

  /**
   * 헬스 체크 (API 키 및 연결 테스트)
   */
  async healthCheck(): Promise<{ isHealthy: boolean; mode: string; error?: string }> {
    try {
      // 간단한 API 호출로 연결 상태 확인 (잘못된 payToken으로 테스트)
      const testResponse = await this.getCashReceiptInfo('invalid_test_token');
      
      // 401 또는 400 에러가 나면 인증은 성공 (잘못된 토큰이므로)
      const isHealthy = testResponse.code === 401 || testResponse.code === 400 || testResponse.code === 404;
      
      return {
        isHealthy,
        mode: this.isLiveMode ? 'LIVE' : 'TEST',
        error: isHealthy ? undefined : testResponse.error
      };
    } catch (error) {
      return {
        isHealthy: false,
        mode: this.isLiveMode ? 'LIVE' : 'TEST',
        error: error instanceof Error ? error.message : '연결 테스트 실패'
      };
    }
  }
}

// 현금영수증 API 인스턴스 (수정된 버전)
export const tossCashReceiptAPI = new TossCashReceiptAPI();

// 현금영수증 유틸리티 함수들 (개선된 버전)
export const CashReceiptUtils = {
  /**
   * 휴대폰 번호 유효성 검사 (한국 표준)
   */
  validatePhoneNumber(phone: string): boolean {
    const cleaned = phone.replace(/[-\s]/g, '');
    // 010, 011, 016, 017, 018, 019로 시작하는 10-11자리
    const phoneRegex = /^01[016789]\d{7,8}$/;
    return phoneRegex.test(cleaned);
  },

  /**
   * 사업자등록번호 유효성 검사 (체크섬 포함)
   */
  validateBusinessNumber(businessNumber: string): boolean {
    const cleaned = businessNumber.replace(/[-]/g, '');
    if (cleaned.length !== 10 || !/^\d{10}$/.test(cleaned)) return false;
    
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
   * 현금영수증 카드번호 유효성 검사 (16자리 숫자)
   */
  validateCashReceiptCard(cardNumber: string): boolean {
    const cleaned = cardNumber.replace(/[-\s]/g, '');
    return /^\d{16}$/.test(cleaned);
  },

  /**
   * 식별자 타입에 따른 유효성 검사
   */
  validateCashReceiptKey(key: string, type: CashReceiptKeyType): boolean {
    if (!key || typeof key !== 'string') return false;
    
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
      case CashReceiptKeyType.CARD:
        return CashReceiptPurpose.DEDUCTION; // 개인 - 소득공제
      case CashReceiptKeyType.CORPORATE:
        return CashReceiptPurpose.EVIDENCE; // 사업자 - 지출증빙
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
   * 현금영수증 식별자 마스킹 (개인정보 보호 강화)
   */
  maskCashReceiptKey(key: string, type: CashReceiptKeyType): string {
    if (!key) return '***';
    
    switch (type) {
      case CashReceiptKeyType.PHONE:
        if (key.length >= 7) {
          return key.substring(0, 3) + '****' + key.substring(7);
        }
        return key.substring(0, 2) + '***';
      case CashReceiptKeyType.CORPORATE:
        if (key.length >= 6) {
          return key.substring(0, 3) + '***' + key.substring(6);
        }
        return key.substring(0, 2) + '***';
      case CashReceiptKeyType.CARD:
        if (key.length >= 12) {
          return key.substring(0, 4) + '********' + key.substring(12);
        }
        return key.substring(0, 3) + '***';
      default:
        return '***';
    }
  },

  /**
   * 현금영수증 키 타입 자동 감지
   */
  detectKeyType(key: string): CashReceiptKeyType | null {
    const cleaned = key.replace(/[-\s]/g, '');
    
    // 휴대폰 번호 패턴
    if (/^01[016789]\d{7,8}$/.test(cleaned)) {
      return CashReceiptKeyType.PHONE;
    }
    
    // 사업자등록번호 패턴 (10자리)
    if (/^\d{10}$/.test(cleaned) && this.validateBusinessNumber(key)) {
      return CashReceiptKeyType.CORPORATE;
    }
    
    // 현금영수증카드 패턴 (16자리)
    if (/^\d{16}$/.test(cleaned)) {
      return CashReceiptKeyType.CARD;
    }
    
    return null;
  }
};