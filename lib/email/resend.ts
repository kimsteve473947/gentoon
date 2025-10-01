import { Resend } from 'resend';

// 환경 변수 확인 및 초기화
const API_KEY = process.env.RESEND_API_KEY;
console.log('📧 [Resend] 초기화:', {
  hasApiKey: !!API_KEY,
  apiKeyLength: API_KEY?.length,
  apiKeyPrefix: API_KEY?.substring(0, 10) + '...'
});

if (!API_KEY) {
  console.error('❌ [Resend] RESEND_API_KEY 환경 변수가 설정되지 않았습니다!');
}

const resend = new Resend(API_KEY);

export interface InquiryEmailData {
  userEmail: string;
  userName?: string;
  subject: string;
  originalMessage: string;
  adminResponse: string;
  inquiryId: string;
}

export async function sendInquiryResponse({
  userEmail,
  userName,
  subject,
  originalMessage,
  adminResponse,
  inquiryId
}: InquiryEmailData) {
  try {
    // 디버깅 로그 추가
    console.log('📧 [Resend] 이메일 발송 시도:', {
      userEmail,
      userName,
      subject,
      inquiryId,
      hasApiKey: !!process.env.RESEND_API_KEY,
      apiKeyPrefix: process.env.RESEND_API_KEY?.substring(0, 10) + '...'
    });
    
    const { data, error } = await resend.emails.send({
      from: 'GenToon 고객지원 <service@gentoon.ai>',
      to: [userEmail],
      subject: `[GenToon] 문의사항에 대한 답변이 등록되었습니다 - ${subject}`,
      html: `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>GenToon 고객지원 답변</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
              background-color: #f5f5f5;
            }
            .container {
              max-width: 600px;
              margin: 20px auto;
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
              color: white;
              padding: 30px 20px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 700;
            }
            .content {
              padding: 30px 20px;
            }
            .greeting {
              font-size: 16px;
              margin-bottom: 25px;
            }
            .inquiry-box {
              background: #f8fafc;
              border-left: 4px solid #8b5cf6;
              padding: 20px;
              margin: 20px 0;
              border-radius: 0 8px 8px 0;
            }
            .response-box {
              background: #f0fdf4;
              border-left: 4px solid #22c55e;
              padding: 20px;
              margin: 20px 0;
              border-radius: 0 8px 8px 0;
            }
            .box-title {
              font-weight: 600;
              margin-bottom: 10px;
              font-size: 14px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .inquiry-title { color: #8b5cf6; }
            .response-title { color: #22c55e; }
            .box-content {
              white-space: pre-wrap;
              line-height: 1.5;
            }
            .footer {
              background: #f8fafc;
              padding: 20px;
              text-align: center;
              font-size: 14px;
              color: #6b7280;
              border-top: 1px solid #e5e7eb;
            }
            .footer a {
              color: #8b5cf6;
              text-decoration: none;
            }
            .divider {
              height: 1px;
              background: linear-gradient(90deg, transparent, #e5e7eb, transparent);
              margin: 25px 0;
            }
            .emoji {
              font-size: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1><span class="emoji">🎨</span> GenToon 고객지원</h1>
            </div>
            
            <div class="content">
              <div class="greeting">
                안녕하세요${userName ? ` ${userName}님` : ''}, <strong>GenToon</strong>입니다! 👋
                <br><br>
                고객님의 소중한 문의사항에 대한 답변을 드립니다.
              </div>
              
              <div class="inquiry-box">
                <div class="box-title inquiry-title">📋 원본 문의 내용</div>
                <div><strong>제목:</strong> ${subject}</div>
                <div class="divider"></div>
                <div class="box-content">${originalMessage.replace(/\n/g, '<br>')}</div>
              </div>
              
              <div class="response-box">
                <div class="box-title response-title">💬 GenToon 팀 답변</div>
                <div class="box-content">${adminResponse.replace(/\n/g, '<br>')}</div>
              </div>
              
              <div class="divider"></div>
              
              <p style="font-size: 14px; color: #6b7280; margin: 20px 0;">
                <strong>🔍 문의번호:</strong> ${inquiryId}<br>
                추가 문의사항이 있으시면 언제든 연락주세요!
              </p>
            </div>
            
            <div class="footer">
              <p>
                <strong>GenToon</strong> - AI 웹툰 제작 플랫폼<br>
                이메일: <a href="mailto:service@gentoon.ai">service@gentoon.ai</a> | 
                웹사이트: <a href="https://gentoon.ai" target="_blank">gentoon.ai</a>
              </p>
              <p style="font-size: 12px; margin-top: 15px;">
                본 메일은 발신 전용입니다. 답변이 필요하시면 플랫폼을 통해 새로운 문의를 등록해 주세요.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
GenToon 고객지원 답변

안녕하세요${userName ? ` ${userName}님` : ''}, GenToon입니다.

고객님의 문의사항에 대한 답변을 드립니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 원본 문의 내용:
제목: ${subject}

${originalMessage}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 GenToon 팀 답변:

${adminResponse}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 문의번호: ${inquiryId}

추가 문의사항이 있으시면 언제든 연락주세요!

감사합니다.
GenToon 팀 드림

──────────────────────────────────
GenToon - AI 웹툰 제작 플랫폼
이메일: service@gentoon.ai | 웹사이트: gentoon.ai
      `
    });

    if (error) {
      console.error('📧 [Resend] 이메일 발송 실패:', error);
      console.error('📧 [Resend] 에러 상세:', {
        name: error.name,
        message: error.message,
        statusCode: (error as any)?.statusCode,
        code: (error as any)?.code
      });
      throw new Error(`이메일 발송 실패: ${error.message}`);
    }

    console.log(`✅ [Resend] 이메일 발송 성공: ${inquiryId} → ${userEmail}`, data);
    return { success: true, data };

  } catch (error) {
    console.error('이메일 발송 중 오류:', error);
    throw error;
  }
}