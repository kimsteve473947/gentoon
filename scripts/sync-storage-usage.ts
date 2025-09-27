#!/usr/bin/env npx tsx
/**
 * 스토리지 사용량 동기화 스크립트
 * user_storage 테이블을 실제 사용량으로 업데이트
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL과 Service Role Key가 필요합니다');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function calculateRealUsage(userId: string) {
  console.log(`📊 사용자 ${userId} 실제 사용량 계산 중...`);

  // 1. 프로젝트 데이터 조회
  const { data: projects } = await supabase
    .from('project')
    .select('id, thumbnailUrl')
    .eq('userId', userId)
    .is('deletedAt', null);

  const projectIds = projects?.map(p => p.id) || [];

  // 2. 병렬로 모든 데이터 조회
  const [
    { data: characters },
    { count: panelCount },
    { count: generationCount }
  ] = await Promise.all([
    supabase
      .from('character')
      .select('referenceImages, ratioImages')
      .eq('userId', userId),
    
    projectIds.length > 0 ? supabase
      .from('panel')
      .select('id', { count: 'exact' })
      .in('projectId', projectIds) : { count: 0 },
    
    supabase
      .from('generation')
      .select('id', { count: 'exact' })
      .eq('userId', userId)
  ]);

  // 3. 이미지 개수 계산
  const projectThumbnails = projects?.filter(p => p.thumbnailUrl).length || 0;
  const projectImages = projectThumbnails + (panelCount || 0) + (generationCount || 0);
  
  const characterImages = (characters || []).reduce((sum: number, c: any) => {
    const refs = Array.isArray(c.referenceImages) ? c.referenceImages.length : 0;
    const ratios = c.ratioImages && typeof c.ratioImages === 'object' 
      ? Object.values(c.ratioImages).reduce((ratioSum: number, images: any) => {
          return ratioSum + (Array.isArray(images) ? images.length : 0);
        }, 0)
      : 0;
    return sum + refs + ratios;
  }, 0);

  // 4. 총 사용량 계산 (이미지당 평균 2MB)
  const totalImages = projectImages + characterImages;
  const estimatedBytes = totalImages * 2 * 1024 * 1024; // 2MB per image

  console.log(`📈 계산 결과:
    - 프로젝트 이미지: ${projectImages}개 (썸네일: ${projectThumbnails}, 패널: ${panelCount}, 생성: ${generationCount})
    - 캐릭터 이미지: ${characterImages}개
    - 총 이미지: ${totalImages}개
    - 예상 사용량: ${(estimatedBytes / 1024 / 1024).toFixed(2)} MB`);

  return {
    totalImages,
    estimatedBytes,
    breakdown: {
      projectImages,
      characterImages,
      projectThumbnails,
      panelCount: panelCount || 0,
      generationCount: generationCount || 0
    }
  };
}

async function syncUserStorage(userId: string) {
  const usage = await calculateRealUsage(userId);
  
  // user_storage 테이블 업데이트
  const { error } = await supabase
    .from('user_storage')
    .upsert({
      userId: userId,
      used_bytes: usage.estimatedBytes,
      file_count: usage.totalImages,
      updated_at: new Date().toISOString()
    })
    .eq('userId', userId);

  if (error) {
    console.error(`❌ 사용자 ${userId} 스토리지 업데이트 실패:`, error);
    return false;
  }

  console.log(`✅ 사용자 ${userId} 스토리지 사용량 동기화 완료: ${(usage.estimatedBytes / 1024 / 1024).toFixed(2)} MB`);
  return true;
}

async function syncAllUsers() {
  console.log('🚀 모든 사용자 스토리지 사용량 동기화 시작...\n');

  // 모든 사용자 조회
  const { data: users } = await supabase
    .from('user')
    .select('id, email')
    .order('createdAt', { ascending: false });

  if (!users || users.length === 0) {
    console.log('동기화할 사용자가 없습니다.');
    return;
  }

  console.log(`📋 총 ${users.length}명의 사용자 동기화 시작...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const user of users) {
    try {
      const success = await syncUserStorage(user.id);
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
    } catch (error) {
      console.error(`❌ 사용자 ${user.email} 동기화 오류:`, error);
      errorCount++;
    }
    
    // 진행률 표시
    const processed = successCount + errorCount;
    const progress = ((processed / users.length) * 100).toFixed(1);
    console.log(`📊 진행률: ${progress}% (${processed}/${users.length})\n`);
  }

  console.log(`🎯 동기화 완료!
    ✅ 성공: ${successCount}명
    ❌ 실패: ${errorCount}명
    📊 총 처리: ${successCount + errorCount}명`);
}

// 특정 사용자만 동기화하려면 사용자 ID를 인자로 전달
const targetUserId = process.argv[2];

if (targetUserId) {
  console.log(`🎯 특정 사용자 동기화: ${targetUserId}`);
  syncUserStorage(targetUserId)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('동기화 오류:', error);
      process.exit(1);
    });
} else {
  syncAllUsers()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('동기화 오류:', error);
      process.exit(1);
    });
}