import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isUserAdmin } from '@/lib/auth/api-middleware';
import { prisma } from '@/lib/db/prisma';

// Mock 이메일 템플릿 데이터
const mockTemplates = [
  {
    id: '1',
    name: '신규 사용자 환영 메시지',
    subject: 'GenToon에 오신 것을 환영합니다! 🎨',
    content: `안녕하세요! GenToon에 가입해주셔서 감사합니다.

AI 기반 웹툰 제작의 새로운 경험을 시작해보세요:
• 무료 토큰 8,000개로 시작
• 캐릭터 2개까지 등록 가능
• 다양한 말풍선 템플릿 제공

지금 바로 스튜디오에서 첫 번째 웹툰을 만들어보세요!

GenToon 팀 드림`,
    type: 'marketing',
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    sent_count: 156
  },
  {
    id: '2',
    name: '유료 플랜 구독 안내',
    subject: '더 많은 창작을 위한 프리미엄 플랜 ✨',
    content: `창작 활동이 활발하시네요! 🎉

더 많은 이미지를 생성하고 캐릭터를 등록하시려면 
프리미엄 플랜을 확인해보세요:

• 스타터: 월 270장 + 캐릭터 5개 (₩29,000)
• 프로: 월 540장 + 캐릭터 10개 (₩59,000)  
• 프리미엄: 월 930장 + 캐릭터 20개 (₩99,000)

GenToon 팀 드림`,
    type: 'marketing',
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    sent_count: 89
  },
  {
    id: '3',
    name: '시스템 점검 공지',
    subject: '[공지] 시스템 정기 점검 안내',
    content: `안녕하세요, GenToon 사용자 여러분.

시스템 안정성 향상을 위한 정기 점검을 실시합니다.

• 일시: 2024년 1월 15일 (월) 02:00 ~ 04:00
• 내용: 서버 업데이트 및 성능 최적화
• 영향: 일시적인 서비스 이용 불가

점검 중 불편을 드려 죄송합니다.

GenToon 팀 드림`,
    type: 'announcement',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    sent_count: 1204
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

    // 데이터베이스에서 템플릿 목록 조회
    const templates = await prisma.emailTemplate.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      templates: templates
    });

  } catch (error) {
    console.error('이메일 템플릿 조회 오류:', error);
    return NextResponse.json(
      { error: '템플릿을 불러오는데 실패했습니다' },
      { status: 500 }
    );
  }
}

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

    // 템플릿 데이터 파싱
    const body = await request.json();
    const { name, subject, content, type, description } = body;

    if (!name || !subject || !content || !type) {
      return NextResponse.json(
        { error: '모든 필드를 입력해주세요' },
        { status: 400 }
      );
    }

    // 데이터베이스에 새 템플릿 생성
    const newTemplate = await prisma.emailTemplate.create({
      data: {
        name,
        subject,
        content,
        type: type as any,
        description,
        createdBy: user.email || 'admin',
        isActive: true
      }
    });

    console.log('새 이메일 템플릿 생성:', newTemplate.id);

    return NextResponse.json({
      success: true,
      message: '템플릿이 성공적으로 생성되었습니다',
      template: newTemplate
    });

  } catch (error) {
    console.error('템플릿 생성 오류:', error);
    return NextResponse.json(
      { error: '템플릿 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}