#!/usr/bin/env npx tsx
/**
 * 🚀 구독 플랜 마이그레이션 스크립트
 * - 기존 3-tier 구조를 새로운 4-tier 구조로 변경
 * - 기존 사용자 혜택 손실 없이 업그레이드
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { PLAN_CONFIGS } from '../lib/subscription/plan-config';

// 환경변수 로드
config({ path: '.env.local' });

// 마이그레이션 매핑 규칙
const MIGRATION_MAPPING = {
  'FREE': 'FREE',      // 무료 → 무료 (변경 없음)
  'PRO': 'PRO',        // 기존 PRO → 새 PRO (더 많은 토큰)
  'PREMIUM': 'PREMIUM', // 기존 PREMIUM → 새 PREMIUM (더 많은 토큰)
  // 기존에 없던 STARTER는 별도 처리 안함
};

async function migrateSubscriptions() {
  console.log('🚀 구독 플랜 마이그레이션 시작...');
  
  try {
    // 환경변수에서 Supabase 설정 가져오기
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase 환경변수가 설정되지 않았습니다.');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 1. 현재 구독 상태 조회
    const { data: subscriptions, error: fetchError } = await supabase
      .from('subscription')
      .select(`
        id,
        userId,
        plan,
        tokensTotal,
        tokensUsed,
        maxCharacters,
        currentPeriodStart,
        currentPeriodEnd
      `)
      .not('plan', 'eq', 'STARTER'); // STARTER는 이미 새로운 구조
    
    if (fetchError) {
      throw fetchError;
    }

    console.log(`📊 총 ${subscriptions?.length || 0}개 구독 발견`);
    
    if (!subscriptions || subscriptions.length === 0) {
      console.log('✅ 마이그레이션할 구독이 없습니다.');
      return;
    }

    // 2. 플랜별 분석
    const planStats = subscriptions.reduce((acc, sub) => {
      acc[sub.plan] = (acc[sub.plan] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('📈 현재 플랜 분포:', planStats);

    // 3. 마이그레이션 실행
    let migratedCount = 0;
    let errorCount = 0;

    for (const subscription of subscriptions) {
      try {
        const currentPlan = subscription.plan;
        const newPlan = MIGRATION_MAPPING[currentPlan as keyof typeof MIGRATION_MAPPING];
        
        if (!newPlan) {
          console.log(`⚠️ [${subscription.userId}] 알 수 없는 플랜: ${currentPlan}`);
          continue;
        }

        const newConfig = PLAN_CONFIGS[newPlan as keyof typeof PLAN_CONFIGS];
        
        // 기존 토큰보다 적으면 업그레이드, 많으면 유지
        const newTokensTotal = Math.max(subscription.tokensTotal, newConfig.platformTokens);
        const newMaxCharacters = Math.max(subscription.maxCharacters || 0, newConfig.maxCharacters);

        // 업데이트
        const { error: updateError } = await supabase
          .from('subscription')
          .update({
            tokensTotal: newTokensTotal,
            maxCharacters: newMaxCharacters,
            updatedAt: new Date().toISOString()
          })
          .eq('id', subscription.id);

        if (updateError) {
          throw updateError;
        }

        const upgrade = newTokensTotal > subscription.tokensTotal;
        
        console.log(`✅ [${subscription.userId.slice(0, 8)}...] ${currentPlan} → ${newPlan} ${upgrade ? '(업그레이드!)' : '(유지)'}`);
        console.log(`   토큰: ${subscription.tokensTotal.toLocaleString()} → ${newTokensTotal.toLocaleString()}`);
        console.log(`   캐릭터: ${subscription.maxCharacters || 0} → ${newMaxCharacters}`);
        
        migratedCount++;

      } catch (error) {
        console.error(`❌ [${subscription.userId}] 마이그레이션 실패:`, error);
        errorCount++;
      }
    }

    // 4. 결과 요약
    console.log('\n🎉 마이그레이션 완료!');
    console.log(`✅ 성공: ${migratedCount}개`);
    console.log(`❌ 실패: ${errorCount}개`);
    
    if (errorCount > 0) {
      console.log('⚠️ 실패한 항목들은 수동으로 확인해주세요.');
    }

    // 5. 최신 플랜 구성 출력
    console.log('\n📋 새로운 플랜 구성:');
    Object.entries(PLAN_CONFIGS).forEach(([key, config]) => {
      if (key !== 'ADMIN') {
        console.log(`${key}: ${config.name} - ${config.platformTokens.toLocaleString()}토큰, 캐릭터 ${config.maxCharacters}개`);
      }
    });

  } catch (error) {
    console.error('💥 마이그레이션 오류:', error);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  migrateSubscriptions()
    .then(() => {
      console.log('🏁 스크립트 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 스크립트 실행 오류:', error);
      process.exit(1);
    });
}

export { migrateSubscriptions };