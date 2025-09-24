import { createClient } from '@/lib/supabase/server';

export interface ActivityLogData {
  userId: string;
  activityType: 'generation' | 'subscription' | 'character' | 'project' | 'payment' | 'system';
  activityTitle: string;
  activityDescription?: string;
  status: 'pending' | 'completed' | 'failed' | 'active';
  tokensUsed?: number;
  metadata?: Record<string, any>;
}

export class ActivityLogger {
  
  static async logActivity(data: ActivityLogData): Promise<void> {
    try {
      const supabase = await createClient();
      
      await supabase
        .from('user_activities')
        .insert({
          user_id: data.userId,
          activity_type: data.activityType,
          activity_title: data.activityTitle,
          activity_description: data.activityDescription || data.activityTitle,
          status: data.status,
          tokens_used: data.tokensUsed || 0,
          metadata: data.metadata || {},
          created_at: new Date().toISOString()
        });

      console.log(`📝 Activity logged: ${data.activityType} - ${data.activityTitle}`);
    } catch (error) {
      console.error('Activity logging failed:', error);
      // Don't throw error - activity logging shouldn't break the main functionality
    }
  }

  // 🚀 이미지 생성 활동 로깅
  static async logImageGeneration(
    userId: string, 
    tokensUsed: number, 
    imageCount: number = 1,
    status: 'completed' | 'failed' = 'completed'
  ): Promise<void> {
    await ActivityLogger.logActivity({
      userId,
      activityType: 'generation',
      activityTitle: `이미지 ${imageCount}장 생성`,
      activityDescription: `AI를 사용하여 웹툰 이미지 ${imageCount}장을 생성했습니다`,
      status,
      tokensUsed,
      metadata: { imageCount }
    });
  }

  // 🚀 캐릭터 관련 활동 로깅
  static async logCharacterActivity(
    userId: string,
    action: 'created' | 'updated' | 'deleted',
    characterName: string,
    characterId?: string
  ): Promise<void> {
    const actionMap = {
      created: '생성',
      updated: '수정',
      deleted: '삭제'
    };

    await ActivityLogger.logActivity({
      userId,
      activityType: 'character',
      activityTitle: `캐릭터 "${characterName}" ${actionMap[action]}`,
      activityDescription: `캐릭터 "${characterName}"를 ${actionMap[action]}했습니다`,
      status: 'completed',
      metadata: { action, characterId, characterName }
    });
  }

  // 🚀 구독 관련 활동 로깅
  static async logSubscriptionActivity(
    userId: string,
    action: 'upgraded' | 'downgraded' | 'cancelled' | 'renewed',
    planName: string,
    amount?: number
  ): Promise<void> {
    const actionMap = {
      upgraded: '업그레이드',
      downgraded: '다운그레이드', 
      cancelled: '해지',
      renewed: '갱신'
    };

    await ActivityLogger.logActivity({
      userId,
      activityType: 'subscription',
      activityTitle: `${planName} 플랜 ${actionMap[action]}`,
      activityDescription: `구독 플랜을 ${actionMap[action]}했습니다`,
      status: 'completed',
      metadata: { action, planName, amount }
    });
  }

  // 🚀 프로젝트 관련 활동 로깅
  static async logProjectActivity(
    userId: string,
    action: 'created' | 'updated' | 'deleted' | 'published',
    projectTitle: string,
    projectId?: string
  ): Promise<void> {
    const actionMap = {
      created: '생성',
      updated: '수정',
      deleted: '삭제',
      published: '발행'
    };

    await ActivityLogger.logActivity({
      userId,
      activityType: 'project',
      activityTitle: `프로젝트 "${projectTitle}" ${actionMap[action]}`,
      activityDescription: `웹툰 프로젝트 "${projectTitle}"를 ${actionMap[action]}했습니다`,
      status: 'completed',
      metadata: { action, projectId, projectTitle }
    });
  }

  // 🚀 결제 관련 활동 로깅
  static async logPaymentActivity(
    userId: string,
    action: 'success' | 'failed' | 'refunded',
    amount: number,
    planName: string,
    paymentId?: string
  ): Promise<void> {
    const actionMap = {
      success: '결제 완료',
      failed: '결제 실패',
      refunded: '환불 완료'
    };

    await ActivityLogger.logActivity({
      userId,
      activityType: 'payment',
      activityTitle: `${planName} 플랜 ${actionMap[action]}`,
      activityDescription: `${planName} 플랜 결제가 ${actionMap[action]}되었습니다 (₩${amount.toLocaleString()})`,
      status: action === 'success' ? 'completed' : action === 'failed' ? 'failed' : 'completed',
      metadata: { action, amount, planName, paymentId }
    });
  }
}

// 편의 함수들
export const logImageGeneration = ActivityLogger.logImageGeneration;
export const logCharacterActivity = ActivityLogger.logCharacterActivity;
export const logSubscriptionActivity = ActivityLogger.logSubscriptionActivity;
export const logProjectActivity = ActivityLogger.logProjectActivity;
export const logPaymentActivity = ActivityLogger.logPaymentActivity;