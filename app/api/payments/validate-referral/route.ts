import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@supabase/ssr';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { referralCode } = await request.json();

    if (!referralCode || typeof referralCode !== 'string') {
      return NextResponse.json(
        { valid: false, message: '추천인 코드를 입력해주세요.' },
        { status: 400 }
      );
    }

    // Supabase 클라이언트 생성
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 현재 로그인한 사용자 확인
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    // 추천인 코드로 사용자 찾기
    const referrer = await prisma.user.findUnique({
      where: {
        referralCode: referralCode
      },
      select: {
        id: true,
        email: true,
        referralCode: true
      }
    });

    if (!referrer) {
      return NextResponse.json(
        { valid: false, message: '존재하지 않는 추천인 코드입니다.' },
        { status: 404 }
      );
    }

    // 자기 자신의 추천 코드는 사용 불가
    if (currentUser && referrer.id === currentUser.id) {
      return NextResponse.json(
        { valid: false, message: '본인의 추천 코드는 사용할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 이미 추천인이 등록된 경우 확인 (로그인한 경우)
    if (currentUser) {
      const existingUser = await prisma.user.findUnique({
        where: {
          id: currentUser.id
        },
        select: {
          referredBy: true
        }
      });

      if (existingUser?.referredBy) {
        return NextResponse.json(
          { valid: false, message: '이미 추천인이 등록되어 있습니다.' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      valid: true,
      message: '유효한 추천인 코드입니다.',
      discount: 30,
      referrerId: referrer.id
    });

  } catch (error) {
    console.error('Referral validation error:', error);
    return NextResponse.json(
      { valid: false, message: '추천인 코드 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}