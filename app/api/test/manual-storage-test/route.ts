import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { storageTracker } from '@/lib/storage/real-time-tracker';
import { getUserStorage } from '@/lib/storage/storage-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 🚀 수동 스토리지 테스트 API (디버깅용)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }
    
    console.log(`🔧 [ManualTest] 사용자 ${user.id} 스토리지 테스트 시작`);
    
    // 1. 현재 스토리지 상태 확인
    console.log('📊 [ManualTest] 1. 현재 스토리지 상태 확인');
    try {
      const currentStorage = await getUserStorage(user.id);
      console.log('✅ [ManualTest] 현재 스토리지:', currentStorage);
    } catch (error) {
      console.error('❌ [ManualTest] 현재 스토리지 조회 실패:', error);
    }
    
    // 2. user_storage 테이블 직접 조회
    console.log('📊 [ManualTest] 2. user_storage 테이블 직접 조회');
    const { data: storageData, error: storageError } = await supabase
      .from('user_storage')
      .select('*')
      .eq('userId', user.id);
      
    if (storageError) {
      console.error('❌ [ManualTest] user_storage 조회 실패:', storageError);
    } else {
      console.log('✅ [ManualTest] user_storage 데이터:', storageData);
    }
    
    // 3. 관련 데이터 수집
    console.log('📊 [ManualTest] 3. 관련 데이터 수집');
    const [projectsResult, charactersResult, generationsResult] = await Promise.all([
      supabase.from('project').select('id, title, thumbnailUrl').eq('userId', user.id).is('deletedAt', null),
      supabase.from('character').select('id, name, referenceImages, ratioImages, thumbnailUrl').eq('userId', user.id),
      supabase.from('generation').select('id, imageUrl').eq('userId', user.id)
    ]);
    
    console.log('✅ [ManualTest] 프로젝트 수:', projectsResult.data?.length || 0);
    console.log('✅ [ManualTest] 캐릭터 수:', charactersResult.data?.length || 0);
    console.log('✅ [ManualTest] 생성 이미지 수:', generationsResult.data?.length || 0);
    
    // 4. 스토리지 재계산 실행
    console.log('📊 [ManualTest] 4. 스토리지 재계산 실행');
    try {
      const recalculateResult = await storageTracker.recalculateUserStorage(user.id);
      console.log('✅ [ManualTest] 재계산 완료:', recalculateResult);
    } catch (error) {
      console.error('❌ [ManualTest] 재계산 실패:', error);
    }
    
    // 5. 재계산 후 스토리지 상태 확인
    console.log('📊 [ManualTest] 5. 재계산 후 스토리지 상태 확인');
    try {
      const finalStorage = await getUserStorage(user.id);
      console.log('✅ [ManualTest] 최종 스토리지:', finalStorage);
    } catch (error) {
      console.error('❌ [ManualTest] 최종 스토리지 조회 실패:', error);
    }
    
    return NextResponse.json({
      success: true,
      message: "스토리지 테스트 완료 (콘솔 로그 확인)",
      userId: user.id,
      projects: projectsResult.data?.length || 0,
      characters: charactersResult.data?.length || 0,
      generations: generationsResult.data?.length || 0
    });
    
  } catch (error) {
    console.error('💥 [ManualTest] 치명적 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: "테스트 중 오류 발생",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}