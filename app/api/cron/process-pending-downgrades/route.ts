import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adjustResourcesForNewPlan } from "@/lib/subscription/subscription-manager";
import { PLAN_CONFIGS } from "@/lib/subscription/plan-config";

/**
 * 🔄 다운그레이드 예약 처리 크론 작업
 * - 매일 자정에 실행되어 다음 결제일이 된 구독들의 다운그레이드를 처리
 * - Vercel Cron: 0 0 * * * (매일 자정)
 */
export async function GET(req: NextRequest) {
  try {
    console.log('🔄 다운그레이드 예약 처리 크론 작업 시작');
    
    // Vercel Cron 인증 확인
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const supabase = await createClient();
    
    // 다운그레이드 예약이 있고 currentPeriodEnd가 지난 구독들 조회
    const { data: pendingDowngrades, error } = await supabase
      .from('subscription')
      .select('*')
      .not('pendingPlan', 'is', null)
      .lte('currentPeriodEnd', new Date().toISOString());
    
    if (error) {
      console.error('다운그레이드 예약 조회 오류:', error);
      return NextResponse.json(
        { error: 'Database query failed' },
        { status: 500 }
      );
    }
    
    if (!pendingDowngrades || pendingDowngrades.length === 0) {
      console.log('📝 처리할 다운그레이드 예약이 없습니다.');
      return NextResponse.json({
        success: true,
        message: 'No pending downgrades to process',
        processed: 0
      });
    }
    
    console.log(`📋 처리할 다운그레이드 예약: ${pendingDowngrades.length}개`);
    
    const processedDowngrades = [];
    
    for (const subscription of pendingDowngrades) {
      try {
        console.log(`🔄 다운그레이드 처리 시작: ${subscription.userId} (${subscription.plan} → ${subscription.pendingPlan})`);
        
        const newPlan = subscription.pendingPlan;
        const newPlanConfig = PLAN_CONFIGS[newPlan];
        
        // 1. 구독 정보 업데이트 (다운그레이드 적용)
        const { error: updateError } = await supabase
          .from('subscription')
          .update({
            plan: newPlan,
            tokensTotal: newPlanConfig.platformTokens,
            tokensUsed: 0, // 새 주기 시작 시 토큰 리셋
            maxCharacters: newPlanConfig.maxCharacters === Infinity ? 999 : newPlanConfig.maxCharacters,
            maxProjects: newPlanConfig.maxCharacters === 2 ? 3 : 
                        newPlanConfig.maxCharacters === 5 ? 10 :
                        newPlanConfig.maxCharacters === 10 ? 25 : 
                        newPlanConfig.maxCharacters === 20 ? 50 : 999,
            currentPeriodStart: new Date().toISOString(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            pendingPlan: null, // 다운그레이드 완료 후 예약 정보 제거
            updatedAt: new Date().toISOString()
          })
          .eq('id', subscription.id);
        
        if (updateError) {
          console.error(`❌ 구독 업데이트 실패: ${subscription.userId}`, updateError);
          continue;
        }
        
        // 2. 리소스 재조정 (스토리지, 토큰 리셋 등)
        await adjustResourcesForNewPlan(subscription.userId, newPlan);
        
        // 3. 트랜잭션 기록 생성
        await supabase
          .from('transaction')
          .insert({
            userId: subscription.userId,
            type: "SUBSCRIPTION",
            amount: 0, // 다운그레이드는 무료
            tokens: newPlanConfig.platformTokens,
            status: "COMPLETED",
            description: `자동 다운그레이드: ${subscription.plan} → ${newPlan} (예약 처리)`,
          });
        
        console.log(`✅ 다운그레이드 완료: ${subscription.userId} (${subscription.plan} → ${newPlan})`);
        
        processedDowngrades.push({
          userId: subscription.userId,
          previousPlan: subscription.plan,
          newPlan: newPlan,
          processedAt: new Date().toISOString()
        });
        
      } catch (error) {
        console.error(`❌ 다운그레이드 처리 실패: ${subscription.userId}`, error);
      }
    }
    
    console.log(`✅ 다운그레이드 예약 처리 완료: ${processedDowngrades.length}/${pendingDowngrades.length}개 성공`);
    
    return NextResponse.json({
      success: true,
      message: `Processed ${processedDowngrades.length} downgrades`,
      processed: processedDowngrades.length,
      total: pendingDowngrades.length,
      downgrades: processedDowngrades
    });
    
  } catch (error) {
    console.error('다운그레이드 예약 처리 크론 작업 오류:', error);
    
    return NextResponse.json(
      { 
        error: 'Cron job failed',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}