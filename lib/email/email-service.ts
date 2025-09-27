import { Resend } from 'resend';
import { prisma } from '@/lib/db/prisma';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  content: string;
  html?: string;
  templateId?: string;
}

export interface BulkEmailOptions {
  recipients: string[];
  subject: string;
  content: string;
  targetType: 'all' | 'free' | 'paid' | 'starter' | 'pro' | 'premium' | 'inactive' | 'active' | 'custom';
  sentBy: string;
  templateId?: string;
}

class EmailService {
  private resend: Resend | null = null;

  constructor() {
    if (process.env.RESEND_API_KEY) {
      this.resend = new Resend(process.env.RESEND_API_KEY);
    }
  }

  /**
   * 단일 이메일 발송
   */
  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.resend) {
      return { success: false, error: 'Resend API가 설정되지 않았습니다' };
    }

    try {
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      
      const result = await this.resend.emails.send({
        from: 'GenToon <noreply@gentoon.ai>',
        to: recipients,
        subject: options.subject,
        html: options.html || this.generateDefaultHTML(options.content),
        text: options.content
      });

      return { 
        success: true, 
        messageId: result.data?.id 
      };
    } catch (error) {
      console.error('이메일 발송 오류:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '알 수 없는 오류' 
      };
    }
  }

  /**
   * 대량 이메일 발송 (캠페인)
   */
  async sendBulkEmail(options: BulkEmailOptions): Promise<{ 
    success: boolean; 
    campaignId?: string; 
    sentCount?: number; 
    failedCount?: number; 
    error?: string 
  }> {
    try {
      // 이메일 캠페인 생성
      const campaign = await prisma.emailCampaign.create({
        data: {
          subject: options.subject,
          content: options.content,
          targetType: options.targetType,
          customEmails: options.targetType === 'custom' ? JSON.stringify(options.recipients) : null,
          recipientCount: options.recipients.length,
          sentBy: options.sentBy,
          templateId: options.templateId,
          status: 'pending'
        }
      });

      if (!this.resend) {
        // Resend가 없는 경우 시뮬레이션
        await this.simulateBulkEmail(campaign.id, options.recipients);
        return { 
          success: true, 
          campaignId: campaign.id, 
          sentCount: options.recipients.length, 
          failedCount: 0 
        };
      }

      // 실제 이메일 발송
      const batchSize = 50; // Resend API 제한에 맞춰 조정
      let sentCount = 0;
      let failedCount = 0;
      const recipientRecords: any[] = [];

      for (let i = 0; i < options.recipients.length; i += batchSize) {
        const batch = options.recipients.slice(i, i + batchSize);
        
        const results = await Promise.allSettled(
          batch.map(email => this.sendEmail({
            to: email,
            subject: options.subject,
            content: options.content
          }))
        );

        // 결과 처리
        results.forEach((result, index) => {
          const email = batch[index];
          if (result.status === 'fulfilled' && result.value.success) {
            sentCount++;
            recipientRecords.push({
              campaignId: campaign.id,
              email: email,
              status: 'sent',
              sentAt: new Date()
            });
          } else {
            failedCount++;
            recipientRecords.push({
              campaignId: campaign.id,
              email: email,
              status: 'failed',
              errorMessage: result.status === 'rejected' ? result.reason : 
                          result.status === 'fulfilled' ? result.value.error : '알 수 없는 오류'
            });
          }
        });

        // 배치 간 지연 (API 제한 회피)
        if (i + batchSize < options.recipients.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // 캠페인 상태 업데이트
      await Promise.all([
        prisma.emailCampaign.update({
          where: { id: campaign.id },
          data: {
            status: failedCount === 0 ? 'sent' : 'failed',
            sentAt: new Date(),
            sentCount,
            failedCount,
            completedAt: new Date()
          }
        }),
        prisma.emailRecipient.createMany({
          data: recipientRecords
        })
      ]);

      return { 
        success: true, 
        campaignId: campaign.id, 
        sentCount, 
        failedCount 
      };

    } catch (error) {
      console.error('대량 이메일 발송 오류:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '알 수 없는 오류' 
      };
    }
  }

  /**
   * 이메일 발송 시뮬레이션 (개발/테스트용)
   */
  private async simulateBulkEmail(campaignId: string, recipients: string[]): Promise<void> {
    console.log(`이메일 발송 시뮬레이션: ${recipients.length}명`);
    
    // 시뮬레이션 지연
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 캠페인 상태 업데이트
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'sent',
        sentAt: new Date(),
        sentCount: recipients.length,
        deliveredCount: recipients.length,
        completedAt: new Date()
      }
    });

    console.log('이메일 발송 시뮬레이션 완료');
  }

  /**
   * 기본 HTML 템플릿 생성
   */
  private generateDefaultHTML(content: string): string {
    const htmlContent = content.replace(/\n/g, '<br>');
    
    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">GenToon</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">AI 웹툰 제작 플랫폼</p>
        </div>
        <div style="padding: 40px 20px; background: #ffffff;">
          <div style="white-space: pre-line; line-height: 1.6; color: #333; font-size: 16px;">
            ${htmlContent}
          </div>
        </div>
        <div style="background: #f8f9fa; padding: 30px 20px; text-align: center;">
          <p style="margin: 0; color: #6c757d; font-size: 14px;">
            이 이메일은 GenToon 관리자가 발송한 공식 이메일입니다.
          </p>
          <p style="margin: 10px 0 0 0; color: #6c757d; font-size: 14px;">
            GenToon • <a href="https://gentoon.ai" style="color: #667eea; text-decoration: none;">gentoon.ai</a>
          </p>
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e9ecef;">
            <p style="margin: 0; color: #adb5bd; font-size: 12px;">
              수신을 원하지 않으시면 관리자에게 문의해주세요.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 이메일 템플릿 조회
   */
  async getEmailTemplate(id: string) {
    return await prisma.emailTemplate.findUnique({
      where: { id }
    });
  }

  /**
   * 사용자 목록 조회 (이메일 발송용)
   */
  async getUsersByTarget(targetType: string): Promise<string[]> {
    let whereClause: any = {
      email: { not: null }
    };

    switch (targetType) {
      case 'free':
        whereClause.subscription = { plan: 'FREE' };
        break;
      case 'paid':
        whereClause.subscription = { plan: { in: ['STARTER', 'PRO', 'PREMIUM'] } };
        break;
      case 'starter':
        whereClause.subscription = { plan: 'STARTER' };
        break;
      case 'pro':
        whereClause.subscription = { plan: 'PRO' };
        break;
      case 'premium':
        whereClause.subscription = { plan: 'PREMIUM' };
        break;
      case 'inactive':
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        whereClause.updatedAt = { lt: thirtyDaysAgo };
        break;
      case 'active':
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        whereClause.updatedAt = { gte: sevenDaysAgo };
        break;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: { email: true }
    });

    return users.map(u => u.email).filter(Boolean) as string[];
  }
}

export const emailService = new EmailService();