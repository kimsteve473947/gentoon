import { createClient } from "@supabase/supabase-js";

const SUBSCRIPTION_CONFIG = {
  FREE: {
    name: '무료',
    price: 0,
    platformTokens: 10000, // 10,000 토큰
    maxCharacters: 1,
    maxProjects: 3,
  },
  PRO: {
    name: '프로',
    price: 30000,
    platformTokens: 500000, // 50만 토큰
    maxCharacters: 3,
    maxProjects: -1, // 무제한
  },
  PREMIUM: {
    name: '프리미엄', 
    price: 100000,
    platformTokens: 2000000, // 200만 토큰
    maxCharacters: 5,
    maxProjects: -1, // 무제한
  },
  ADMIN: {
    name: '관리자',
    price: 0,
    platformTokens: 999999999, // 무제한
    maxCharacters: 999,
    maxProjects: -1, // 무제한
  },
} as const;

/**
 * 🚀 자동 사용자 온보딩 시스템 (단일 ID)
 * - Supabase Auth ID를 직접 사용
 * - 구독 정보 자동 초기화
 * - 저장소 사용량 추적 시작
 */
export async function ensureUserExists(authUser: any): Promise<{
  success: boolean;
  userId?: string;
  isNewUser?: boolean;
  error?: string;
}> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log(`🔍 사용자 온보딩 체크: ${authUser.email}`);

    // 1. 기존 사용자 확인 (Auth ID 직접 사용)
    const { data: existingUser } = await supabase
      .from('user')
      .select('id, updatedAt')
      .eq('id', authUser.id)
      .single();

    if (existingUser) {
      console.log(`✅ 기존 사용자: ${authUser.email}`);
      return {
        success: true,
        userId: existingUser.id,
        isNewUser: false
      };
    }

    console.log(`🆕 신규 사용자 온보딩 시작: ${authUser.email}`);

    // 2. 플랜 결정 (관리자인지 확인)
    const plan = authUser.email === 'kimjh473947@gmail.com' ? 'ADMIN' : 'FREE';
    const config = SUBSCRIPTION_CONFIG[plan];

    console.log(`📋 플랜 설정: ${plan}`);

    // 3. 사용자 생성 (Auth ID를 직접 PK로 사용)
    const { data: newUser, error: userError } = await supabase
      .from('user')
      .insert({
        id: authUser.id, // Auth ID를 직접 PK로 사용
        email: authUser.email || '',
        name: authUser.user_metadata?.full_name || 
              authUser.user_metadata?.name || 
              authUser.email?.split('@')[0] || '사용자',
        avatarUrl: authUser.user_metadata?.avatar_url || 
                   authUser.user_metadata?.picture || null,
        role: plan === 'ADMIN' ? 'ADMIN' : 'USER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .select('id')
      .single();

    if (userError) {
      console.error(`❌ 사용자 생성 실패:`, userError);
      return {
        success: false,
        error: `사용자 생성 실패: ${userError.message}`
      };
    }

    const userId = newUser.id;
    console.log(`✅ 사용자 생성 완료: ${userId}`);

    // 4. 구독 정보 생성
    const { error: subscriptionError } = await supabase
      .from('subscription')
      .insert({
        userId: userId,
        plan: plan,
        tokensTotal: config.platformTokens,
        tokensUsed: 0,
        maxCharacters: config.maxCharacters,
        maxProjects: config.maxProjects === -1 ? 999999 : config.maxProjects,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1년 후
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

    if (subscriptionError) {
      console.error(`❌ 구독 생성 실패:`, subscriptionError);
      // 사용자는 생성됐지만 구독 생성 실패 - 일단 진행
    } else {
      console.log(`📋 구독 생성 완료: ${plan} 플랜`);
    }

    // 5. 저장소 사용량 초기화
    const storageLimit = plan === 'ADMIN' ? 100 * 1024 * 1024 * 1024 : // 100GB
                         plan === 'PREMIUM' ? 5 * 1024 * 1024 * 1024 : // 5GB
                         plan === 'PRO' ? 1 * 1024 * 1024 * 1024 : // 1GB
                         100 * 1024 * 1024; // 100MB (FREE)

    const { error: storageError } = await supabase
      .from('user_storage')
      .insert({
        userId: userId,
        used_bytes: 0,
        max_bytes: storageLimit,
        file_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (storageError) {
      console.warn(`⚠️ 저장소 초기화 실패:`, storageError);
      // 중요하지 않으므로 진행
    } else {
      console.log(`💾 저장소 초기화 완료: ${storageLimit / (1024*1024)}MB`);
    }

    console.log(`🎉 사용자 온보딩 완료: ${authUser.email} (${plan})`);

    return {
      success: true,
      userId,
      isNewUser: true
    };

  } catch (error) {
    console.error(`💥 사용자 온보딩 실패:`, error);
    return {
      success: false,
      error: `온보딩 오류: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * 🔧 기존 사용자 데이터 보정 (관리자 전용)
 * - Auth에만 있고 내부 테이블에 없는 사용자들을 일괄 온보딩
 */
export async function migrateAuthOnlyUsers(): Promise<{
  success: boolean;
  migrated: number;
  errors: string[];
}> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log(`🔄 Auth 전용 사용자 마이그레이션 시작`);

    // 1. 모든 Auth 사용자 가져오기
    const { data: authUsersData } = await supabase.auth.admin.listUsers();
    const authUsers = authUsersData?.users || [];

    // 2. 내부 테이블의 기존 사용자 확인
    const { data: internalUsers } = await supabase
      .from('user')
      .select('id');

    const existingAuthIds = new Set(internalUsers?.map(u => u.id) || []);

    // 3. 마이그레이션 대상 찾기
    const usersToMigrate = authUsers.filter(user => !existingAuthIds.has(user.id));
    
    console.log(`📊 마이그레이션 대상: ${usersToMigrate.length}명`);

    if (usersToMigrate.length === 0) {
      return {
        success: true,
        migrated: 0,
        errors: []
      };
    }

    // 4. 각 사용자에 대해 온보딩 실행
    let migrated = 0;
    const errors: string[] = [];

    for (const authUser of usersToMigrate) {
      const result = await ensureUserExists(authUser);
      
      if (result.success && result.isNewUser) {
        migrated++;
        console.log(`✅ 마이그레이션 완료: ${authUser.email}`);
      } else if (!result.success) {
        const errorMsg = `${authUser.email}: ${result.error}`;
        errors.push(errorMsg);
        console.error(`❌ 마이그레이션 실패: ${errorMsg}`);
      }
    }

    console.log(`🎯 마이그레이션 완료: ${migrated}명 성공, ${errors.length}명 실패`);

    return {
      success: true,
      migrated,
      errors
    };

  } catch (error) {
    console.error(`💥 마이그레이션 실패:`, error);
    return {
      success: false,
      migrated: 0,
      errors: [`마이그레이션 오류: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}