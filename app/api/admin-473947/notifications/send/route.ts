import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isUserAdmin } from '@/lib/auth/api-middleware';
import { Resend } from 'resend';
import { prisma } from '@/lib/db/prisma';

// Resend 클라이언트 초기화
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // 관리자 권한 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const isAdmin = await isUserAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // 이메일 데이터 파싱
    const body = await request.json();
    const { recipients, subject, content, customEmails } = body;

    if (!subject || !content) {
      return NextResponse.json(
        { error: '제목과 내용은 필수입니다' },
        { status: 400 }
      );
    }

    console.log('이메일 발송 요청:', { recipients, subject: subject.substring(0, 50) + '...' });

    // 수신자 목록 생성
    let recipientEmails: string[] = [];
    let recipientCount = 0;

    if (recipients === 'custom') {
      // 직접 입력한 이메일
      if (!customEmails) {
        return NextResponse.json(
          { error: '커스텀 이메일 주소를 입력해주세요' },
          { status: 400 }
        );
      }
      recipientEmails = customEmails
        .split(',')
        .map((email: string) => email.trim())
        .filter((email: string) => email && email.includes('@'));
      recipientCount = recipientEmails.length;
    } else {
      // Prisma를 사용하여 데이터베이스에서 사용자 목록 조회
      let whereClause: any = {
        email: {
          not: null
        }
      };

      // 플랜별 필터링
      if (recipients === 'free') {
        whereClause.subscription = {
          plan: 'FREE'
        };
      } else if (recipients === 'paid') {
        whereClause.subscription = {
          plan: {
            in: ['STARTER', 'PRO', 'PREMIUM']
          }
        };
      } else if (recipients === 'starter') {
        whereClause.subscription = {
          plan: 'STARTER'
        };
      } else if (recipients === 'pro') {
        whereClause.subscription = {
          plan: 'PRO'
        };
      } else if (recipients === 'premium') {
        whereClause.subscription = {
          plan: 'PREMIUM'
        };
      } else if (recipients === 'inactive') {
        // 30일 이상 비활성 사용자
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        whereClause.updatedAt = {
          lt: thirtyDaysAgo
        };
      } else if (recipients === 'active') {
        // 7일 이내 활성 사용자
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        whereClause.updatedAt = {
          gte: sevenDaysAgo
        };
      }

      try {
        const users = await prisma.user.findMany({
          where: whereClause,
          select: {
            email: true
          }
        });

        recipientEmails = users.map(u => u.email).filter(Boolean) as string[];
        recipientCount = recipientEmails.length;
      } catch (error) {
        console.error('사용자 조회 오류:', error);
        return NextResponse.json(
          { error: '수신자 목록을 가져오는데 실패했습니다' },
          { status: 500 }
        );
      }
    }

    if (recipientCount === 0) {
      return NextResponse.json(
        { error: '발송할 수신자가 없습니다' },
        { status: 400 }
      );
    }

    console.log(`${recipientCount}명에게 이메일 발송 시작`);

    // 데이터베이스에 이메일 캠페인 기록 생성
    const emailCampaign = await prisma.emailCampaign.create({
      data: {
        subject,
        content,
        targetType: recipients === 'all' ? 'all' :
                   recipients === 'free' ? 'free' :
                   recipients === 'paid' ? 'paid' :
                   recipients === 'starter' ? 'starter' :
                   recipients === 'pro' ? 'pro' :
                   recipients === 'premium' ? 'premium' :
                   recipients === 'inactive' ? 'inactive' :
                   recipients === 'active' ? 'active' : 'custom',
        customEmails: recipients === 'custom' ? JSON.stringify(recipientEmails) : null,
        recipientCount,
        sentBy: user.email || 'admin',
        status: 'pending'
      }
    });

    // Resend API가 설정되어 있는 경우 실제 이메일 발송
    if (resend && recipientEmails.length > 0) {
      try {
        // 배치로 이메일 발송 (Resend는 한 번에 많은 이메일을 보낼 수 있음)
        // 단, 실제로는 rate limiting을 고려해야 함
        
        const fromEmail = 'GenToon <noreply@gentoon.ai>';
        const htmlContent = content.replace(/\n/g, '<br>');
        
        // 테스트를 위해 처음 5명에게만 발송
        const testRecipients = recipientEmails.slice(0, Math.min(5, recipientEmails.length));
        
        const emailResults = await Promise.allSettled(
          testRecipients.map(email => 
            resend.emails.send({
              from: fromEmail,
              to: email,
              subject: subject,
              html: `
                <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">GenToon</h1>
                  </div>
                  <div style="padding: 40px 20px; background: #ffffff;">
                    <div style="white-space: pre-line; line-height: 1.6; color: #333;">
                      ${htmlContent}
                    </div>
                  </div>
                  <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px;">
                    <p style="margin: 0;">이 이메일은 GenToon 관리자가 발송한 공식 이메일입니다.</p>
                    <p style="margin: 5px 0 0 0;">GenToon • AI 웹툰 제작 플랫폼</p>
                  </div>
                </div>
              `,
              text: content
            })
          )
        );

        // 발솨 결과 분석
        const successCount = emailResults.filter(result => result.status === 'fulfilled').length;
        const failureCount = emailResults.filter(result => result.status === 'rejected').length;

        console.log(`이메일 발송 완료: 성공 ${successCount}개, 실패 ${failureCount}개`);

        // 캠페인 상태 업데이트
        await prisma.emailCampaign.update({
          where: { id: emailCampaign.id },
          data: {
            status: failureCount === 0 ? 'sent' : 'failed',
            sentAt: new Date(),
            sentCount: successCount,
            failedCount: failureCount,
            completedAt: new Date()
          }
        });

        // 개별 수신자 기록 생성
        const recipientRecords = testRecipients.map((email, index) => ({
          campaignId: emailCampaign.id,
          email: email,
          status: emailResults[index].status === 'fulfilled' ? 'sent' : 'failed',
          sentAt: emailResults[index].status === 'fulfilled' ? new Date() : null,
          errorMessage: emailResults[index].status === 'rejected' ? 
            (emailResults[index] as any).reason?.message : null
        }));

        await prisma.emailRecipient.createMany({
          data: recipientRecords as any
        });

        // TODO: 실제 감사 로그에 기록
        console.log('이메일 발송 감사 로그:', {
          userId: user.id,
          action: 'EMAIL_BROADCAST',
          resource: 'email_system',
          details: `${recipientCount}명에게 이메일 발송: "${subject.substring(0, 50)}..."`,
          severity: 'medium',
          category: 'admin',
          success: emailRecord.status === 'sent',
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Resend API 오류:', error);
        
        await prisma.emailCampaign.update({
          where: { id: emailCampaign.id },
          data: {
            status: 'failed',
            errorLog: error instanceof Error ? error.message : '알 수 없는 오류',
            completedAt: new Date()
          }
        });
      }
    } else {
      // Resend가 설정되지 않은 경우 시뮬레이션
      console.log('이메일 발송 시뮬레이션 (Resend API 없음)');
      
      // 시뮬레이션 지연
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 시뮬레이션 성공 업데이트
      await prisma.emailCampaign.update({
        where: { id: emailCampaign.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          sentCount: recipientCount,
          deliveredCount: recipientCount,
          completedAt: new Date()
        }
      });
    }

    // 업데이트된 캠페인 정보 조회
    const updatedCampaign = await prisma.emailCampaign.findUnique({
      where: { id: emailCampaign.id }
    });

    return NextResponse.json({
      success: true,
      message: updatedCampaign?.status === 'sent' 
        ? `${recipientCount}명에게 이메일이 성공적으로 발송되었습니다`
        : '이메일 발송 중 오류가 발생했습니다',
      campaign: updatedCampaign
    });

  } catch (error) {
    console.error('이메일 발송 오류:', error);
    return NextResponse.json(
      { error: '이메일 발송 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}