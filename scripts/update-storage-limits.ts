/**
 * 기존 사용자들의 스토리지 제한을 새로운 플랜 구조에 맞게 업데이트
 * 실행: npx tsx scripts/update-storage-limits.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { PLAN_CONFIGS } from '@/lib/subscription/plan-config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateStorageLimits() {
  console.log('🚀 Starting storage limits migration...');
  
  try {
    // 모든 사용자의 구독과 스토리지 정보 조회
    const { data: subscriptions, error: subError } = await supabase
      .from('subscription')
      .select('userId, plan');
      
    if (subError) {
      console.error('❌ Failed to fetch subscriptions:', subError);
      return;
    }
    
    console.log(`📋 Found ${subscriptions.length} subscriptions to process`);
    
    let updated = 0;
    let errors = 0;
    
    for (const subscription of subscriptions) {
      try {
        const { userId, plan } = subscription;
        const planConfig = PLAN_CONFIGS[plan as keyof typeof PLAN_CONFIGS];
        
        if (!planConfig) {
          console.warn(`⚠️  Unknown plan ${plan} for user ${userId.slice(0, 8)}`);
          continue;
        }
        
        const newStorageLimit = planConfig.storageLimit;
        
        // 현재 스토리지 정보 조회
        const { data: currentStorage } = await supabase
          .from('user_storage')
          .select('max_bytes')
          .eq('userId', userId)
          .single();
          
        if (currentStorage?.max_bytes === newStorageLimit) {
          console.log(`✅ User ${userId.slice(0, 8)} (${plan}): Already up to date`);
          continue;
        }
        
        // 스토리지 제한 업데이트 (기존 레코드가 있으면 업데이트)
        const { error: updateError } = await supabase
          .from('user_storage')
          .update({
            max_bytes: newStorageLimit,
            updated_at: new Date().toISOString()
          })
          .eq('userId', userId);
          
        if (updateError) {
          console.error(`❌ Failed to update user ${userId.slice(0, 8)}:`, updateError);
          errors++;
        } else {
          const oldGB = currentStorage?.max_bytes ? 
            (currentStorage.max_bytes / 1024 / 1024 / 1024).toFixed(1) : 'N/A';
          const newGB = (newStorageLimit / 1024 / 1024 / 1024).toFixed(1);
          
          console.log(`🔄 User ${userId.slice(0, 8)} (${plan}): ${oldGB}GB → ${newGB}GB`);
          updated++;
        }
        
      } catch (error) {
        console.error(`❌ Error processing user ${subscription.userId.slice(0, 8)}:`, error);
        errors++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Updated: ${updated} users`);
    console.log(`❌ Errors: ${errors} users`);
    console.log(`📋 Total processed: ${subscriptions.length} users`);
    
    if (errors === 0) {
      console.log('\n🎉 Storage limits migration completed successfully!');
    } else {
      console.log(`\n⚠️  Migration completed with ${errors} errors. Please check the logs.`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// 스크립트 실행
updateStorageLimits();