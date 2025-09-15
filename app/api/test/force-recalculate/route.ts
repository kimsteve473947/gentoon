import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { storageTracker } from '@/lib/storage/real-time-tracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 🔧 특정 사용자의 스토리지 강제 재계산 API (테스트용)
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 [ForceRecalc] 스토리지 강제 재계산 시작...');
    
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: "userId가 필요합니다" 
      }, { status: 400 });
    }
    
    console.log(`🔧 [ForceRecalc] 사용자 ${userId.slice(0, 8)}... 재계산 시작`);
    
    const supabase = await createClient();
    
    // 1. 현재 스토리지 상태 확인
    console.log('📊 [ForceRecalc] 1. 현재 스토리지 상태');
    const { data: beforeStorage } = await supabase
      .from('user_storage')
      .select('*')
      .eq('userId', userId)
      .single();
    console.log('현재 스토리지:', beforeStorage);
    
    // 2. 사용자 데이터 확인
    console.log('📊 [ForceRecalc] 2. 사용자 데이터 확인');
    const [projectsResult, charactersResult, generationsResult] = await Promise.all([
      supabase.from('project').select('id, title, thumbnailUrl').eq('userId', userId).is('deletedAt', null),
      supabase.from('character').select('id, name, referenceImages, ratioImages, thumbnailUrl').eq('userId', userId),
      supabase.from('generation').select('id, imageUrl').eq('userId', userId)
    ]);
    
    const projects = projectsResult.data || [];
    const characters = charactersResult.data || [];
    const generations = generationsResult.data || [];
    
    console.log(`✅ [ForceRecalc] 데이터 현황: 프로젝트 ${projects.length}개, 캐릭터 ${characters.length}개, 생성 이미지 ${generations.length}개`);
    
    // 3. 스토리지 재계산 실행
    console.log('🔧 [ForceRecalc] 3. 스토리지 재계산 실행');
    const recalcResult = await storageTracker.recalculateUserStorage(userId);
    console.log('재계산 결과:', recalcResult);
    
    // 4. 재계산 후 스토리지 상태 확인
    console.log('📊 [ForceRecalc] 4. 재계산 후 상태 확인');
    const { data: afterStorage } = await supabase
      .from('user_storage')
      .select('*')
      .eq('userId', userId)
      .single();
    console.log('재계산 후 스토리지:', afterStorage);
    
    return NextResponse.json({
      success: true,
      message: "스토리지 강제 재계산 완료",
      userId: userId,
      before: beforeStorage,
      after: afterStorage,
      data: {
        projects: projects.length,
        characters: characters.length,
        generations: generations.length
      },
      recalculation: recalcResult
    });
    
  } catch (error) {
    console.error('💥 [ForceRecalc] 재계산 실패:', error);
    return NextResponse.json({ 
      success: false, 
      error: "강제 재계산 중 오류 발생",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}