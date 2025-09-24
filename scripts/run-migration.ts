#!/usr/bin/env tsx

/**
 * 직접 마이그레이션 실행 스크립트
 * Usage: npx tsx scripts/run-migration.ts [action]
 * Actions: profile-images, data-url-images, both
 */

// 환경변수 로드
import { config } from 'dotenv';
import path from 'path';

// .env.local 파일 로드
config({ path: path.resolve(process.cwd(), '.env.local') });

// 환경변수 확인
console.log('🔍 환경변수 확인:');
console.log('- SUPABASE_URL:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('- SUPABASE_SERVICE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

import { updateUserProfileImages, migrateDataUrlImagesToStorage } from '../lib/migration/update-profile-images';

async function main() {
  const action = process.argv[2] || 'both';
  
  console.log('🚀 마이그레이션 스크립트 시작...');
  console.log(`📋 실행할 작업: ${action}`);
  
  try {
    switch (action) {
      case 'profile-images':
        console.log('\n🔄 Google 프로필 이미지 업데이트 시작...');
        const profileResult = await updateUserProfileImages();
        console.log('✅ 프로필 이미지 결과:', profileResult);
        break;
        
      case 'data-url-images':
        console.log('\n🔄 Data URL 이미지 마이그레이션 시작...');
        const imageResult = await migrateDataUrlImagesToStorage();
        console.log('✅ 이미지 마이그레이션 결과:', imageResult);
        break;
        
      case 'both':
      default:
        // 1. 프로필 이미지 먼저
        console.log('\n🔄 1단계: Google 프로필 이미지 업데이트...');
        const profileResult2 = await updateUserProfileImages();
        console.log('✅ 프로필 이미지 결과:', profileResult2);
        
        // 2. 그 다음 data URL 이미지들
        console.log('\n🔄 2단계: Data URL 이미지 마이그레이션...');
        const imageResult2 = await migrateDataUrlImagesToStorage();
        console.log('✅ 이미지 마이그레이션 결과:', imageResult2);
        break;
    }
    
    console.log('\n🎉 모든 마이그레이션 작업 완료!');
    process.exit(0);
    
  } catch (error) {
    console.error('💥 마이그레이션 실패:', error);
    process.exit(1);
  }
}

main();