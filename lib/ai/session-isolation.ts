/**
 * 사용자별 AI 세션 격리 시스템
 * Vertex AI API 키를 공유하면서도 사용자별 격리 보장
 */

import crypto from 'crypto';

export interface UserSession {
  userId: string;
  sessionId: string;
  projectId: string;
  createdAt: Date;
  lastAccessAt: Date;
  requestCount: number;
  tokensUsed: number;
}

export class SessionIsolationManager {
  private static sessions = new Map<string, UserSession>();
  private static readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30분
  private static readonly MAX_REQUESTS_PER_SESSION = 100;
  
  /**
   * 사용자별 고유 세션 생성
   */
  static createUserSession(userId: string, projectId?: string): string {
    // 기존 활성 세션 정리
    this.cleanupExpiredSessions();
    
    // 사용자별 고유 세션 ID 생성
    const sessionId = crypto
      .createHash('sha256')
      .update(`${userId}-${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 16);
    
    const session: UserSession = {
      userId,
      sessionId,
      projectId: projectId || 'default',
      createdAt: new Date(),
      lastAccessAt: new Date(),
      requestCount: 0,
      tokensUsed: 0
    };
    
    this.sessions.set(sessionId, session);
    
    console.log(`🔐 새 사용자 세션 생성: ${sessionId} (유저: ${userId})`);
    return sessionId;
  }
  
  /**
   * 세션 기반 프롬프트 격리
   */
  static isolatePrompt(sessionId: string, originalPrompt: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('유효하지 않은 세션입니다');
    }
    
    // 세션 정보 업데이트
    session.lastAccessAt = new Date();
    session.requestCount++;
    
    // 세션별 고유 컨텍스트 추가
    const isolatedPrompt = `[SESSION:${sessionId}] [USER:${session.userId}] [PROJECT:${session.projectId}] [REQUEST:${session.requestCount}]

${originalPrompt}

[END_SESSION_CONTEXT]`;
    
    return isolatedPrompt;
  }
  
  /**
   * 세션 토큰 사용량 기록
   */
  static recordTokenUsage(sessionId: string, tokens: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.tokensUsed += tokens;
    }
  }
  
  /**
   * 사용자별 레이트 리미트 확인
   */
  static checkRateLimit(sessionId: string): { allowed: boolean; reason?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { allowed: false, reason: '유효하지 않은 세션' };
    }
    
    // 세션당 최대 요청 수 확인
    if (session.requestCount >= this.MAX_REQUESTS_PER_SESSION) {
      return { allowed: false, reason: '세션당 최대 요청 수 초과' };
    }
    
    // 시간당 요청 제한 (사용자별)
    const hourlyLimit = this.getHourlyRequestLimit(session.userId);
    const recentRequests = this.getRecentRequests(session.userId, 60 * 60 * 1000); // 1시간
    
    if (recentRequests >= hourlyLimit) {
      return { allowed: false, reason: '시간당 요청 제한 초과' };
    }
    
    return { allowed: true };
  }
  
  /**
   * 만료된 세션 정리
   */
  private static cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions = [];
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastAccessAt.getTime() > this.SESSION_TIMEOUT) {
        expiredSessions.push(sessionId);
      }
    }
    
    expiredSessions.forEach(sessionId => {
      this.sessions.delete(sessionId);
      console.log(`🧹 만료된 세션 삭제: ${sessionId}`);
    });
  }
  
  /**
   * 사용자별 시간당 요청 제한
   */
  private static getHourlyRequestLimit(userId: string): number {
    // 구독 플랜별 제한 (실제로는 DB에서 조회)
    return 100; // 기본값
  }
  
  /**
   * 최근 요청 수 조회
   */
  private static getRecentRequests(userId: string, timeWindow: number): number {
    const now = Date.now();
    let count = 0;
    
    for (const session of this.sessions.values()) {
      if (session.userId === userId && 
          now - session.lastAccessAt.getTime() < timeWindow) {
        count += session.requestCount;
      }
    }
    
    return count;
  }
  
  /**
   * 사용자 세션 정보 조회
   */
  static getUserSessionInfo(userId: string): {
    activeSessions: number;
    totalRequests: number;
    totalTokens: number;
  } {
    let activeSessions = 0;
    let totalRequests = 0;
    let totalTokens = 0;
    
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        activeSessions++;
        totalRequests += session.requestCount;
        totalTokens += session.tokensUsed;
      }
    }
    
    return { activeSessions, totalRequests, totalTokens };
  }
  
  /**
   * 세션 종료
   */
  static terminateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      console.log(`🔚 세션 종료: ${sessionId} (유저: ${session.userId}, 요청: ${session.requestCount}, 토큰: ${session.tokensUsed})`);
      this.sessions.delete(sessionId);
    }
  }
  
  /**
   * 사용자의 모든 세션 종료 (로그아웃 시)
   */
  static terminateUserSessions(userId: string): void {
    const userSessions = Array.from(this.sessions.entries())
      .filter(([_, session]) => session.userId === userId);
    
    userSessions.forEach(([sessionId, _]) => {
      this.sessions.delete(sessionId);
    });
    
    console.log(`🔚 사용자 세션 전체 종료: ${userId} (${userSessions.length}개 세션)`);
  }
}