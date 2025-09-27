import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isUserAdmin } from '@/lib/auth/api-middleware';
import { prisma } from '@/lib/db/prisma';

// Mock 이메일 발송 기록 데이터
const mockEmailHistory = [
  {
    id: '1',
    subject: 'GenToon 1월 업데이트 소식 📈',
    recipient_count: 1204,
    sent_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2시간 전
    status: 'sent',
    open_rate: 0.68,
    click_rate: 0.24
  },
  {
    id: '2',
    subject: '신규 AI 모델 출시 안내 🚀',
    recipient_count: 856,
    sent_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1일 전
    status: 'sent',
    open_rate: 0.72,
    click_rate: 0.31
  },
  {
    id: '3',
    subject: '프리미엄 플랜 특가 혜택 ✨',
    recipient_count: 456,
    sent_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3일 전
    status: 'sent',
    open_rate: 0.65,
    click_rate: 0.18
  },
  {
    id: '4',
    subject: '서비스 점검 완료 공지',
    recipient_count: 1580,
    sent_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1주일 전
    status: 'sent',
    open_rate: 0.85,
    click_rate: 0.12
  },
  {
    id: '5',
    subject: '연말 이벤트 안내',
    recipient_count: 234,
    sent_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10일 전
    status: 'failed',
    open_rate: 0,
    click_rate: 0
  }
];

export async function GET(request: NextRequest) {
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

    // URL 파라미터에서 필터 조건 추출
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 데이터베이스에서 이메일 캠페인 기록 조회
    const [campaigns, totalCount] = await Promise.all([
      prisma.emailCampaign.findMany({
        orderBy: {
          sentAt: 'desc'
        },
        skip: offset,
        take: limit,
        select: {
          id: true,
          subject: true,
          recipientCount: true,
          sentAt: true,
          status: true,
          deliveredCount: true,
          openedCount: true,
          clickedCount: true,
          sentBy: true,
          targetType: true
        }
      }),
      prisma.emailCampaign.count()
    ]);

    // 열람률, 클릭률 계산
    const history = campaigns.map(campaign => ({
      id: campaign.id,
      subject: campaign.subject,
      recipient_count: campaign.recipientCount,
      sent_at: campaign.sentAt?.toISOString() || null,
      status: campaign.status,
      open_rate: campaign.deliveredCount > 0 ? campaign.openedCount / campaign.deliveredCount : 0,
      click_rate: campaign.deliveredCount > 0 ? campaign.clickedCount / campaign.deliveredCount : 0,
      sent_by: campaign.sentBy,
      target_type: campaign.targetType
    }));

    return NextResponse.json({
      success: true,
      history: history,
      totalCount: totalCount,
      hasMore: offset + limit < totalCount
    });

  } catch (error) {
    console.error('이메일 발송 기록 조회 오류:', error);
    return NextResponse.json(
      { error: '발송 기록을 불러오는데 실패했습니다' },
      { status: 500 }
    );
  }
}