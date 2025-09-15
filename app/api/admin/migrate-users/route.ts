import { NextRequest, NextResponse } from 'next/server';
import { createClient } from "@/lib/supabase/server";
import { migrateAuthOnlyUsers } from '@/lib/supabase/auto-onboarding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || user.email !== 'kimjh473947@gmail.com') {
      return NextResponse.json(
        { success: false, error: "관리자 권한이 필요합니다" },
        { status: 403 }
      );
    }

    console.log(`🔄 사용자 마이그레이션 시작: ${user.email}`);

    // Auth에만 있는 사용자들을 내부 테이블로 마이그레이션
    const result = await migrateAuthOnlyUsers();

    if (result.success) {
      console.log(`✅ 마이그레이션 완료: ${result.migrated}명 처리`);
      
      return NextResponse.json({
        success: true,
        message: `마이그레이션 완료: ${result.migrated}명의 사용자가 성공적으로 처리되었습니다.`,
        migrated: result.migrated,
        errors: result.errors,
        errorCount: result.errors.length
      });
    } else {
      return NextResponse.json({
        success: false,
        error: "마이그레이션 중 오류가 발생했습니다",
        errors: result.errors
      }, { status: 500 });
    }

  } catch (error) {
    console.error("마이그레이션 API 오류:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "마이그레이션 중 오류가 발생했습니다",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}