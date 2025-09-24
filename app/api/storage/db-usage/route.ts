import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    // 사용자 정보 조회
    const { data: userData } = await supabase
      .from('user')
      .select('id, email')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json(
        { success: false, error: "사용자 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 🔥 정확한 DB 사용량 계산
    const [
      generationsResult,
      charactersResult,
      projectsResult,
      panelsResult
    ] = await Promise.all([
      // AI 생성 이미지 개수
      supabase
        .from('generation')
        .select('id, tokensUsed, model')
        .eq('userId', userData.id),
      
      // 캐릭터 개수 (레퍼런스 이미지 포함)
      supabase
        .from('character')
        .select('id, referenceImages, ratioImages')
        .eq('userId', userData.id),
      
      // 프로젝트 개수
      supabase
        .from('project')
        .select('id, panelCount, thumbnailUrl')
        .eq('userId', userData.id)
        .is('deletedAt', null),
      
      // 패널 개수 
      supabase
        .from('panel')
        .select('id, imageUrl')
        .in('projectId', 
          // 사용자의 프로젝트만 조회
          (await supabase
            .from('project')
            .select('id')
            .eq('userId', userData.id)
            .is('deletedAt', null)
          ).data?.map(p => p.id) || []
        )
    ]);

    // 에러 처리
    if (generationsResult.error) throw generationsResult.error;
    if (charactersResult.error) throw charactersResult.error;
    if (projectsResult.error) throw projectsResult.error;
    if (panelsResult.error) throw panelsResult.error;

    const generations = generationsResult.data || [];
    const characters = charactersResult.data || [];
    const projects = projectsResult.data || [];
    const panels = panelsResult.data || [];

    // 📊 상세 사용량 분석
    const dbUsage = {
      // 기본 통계
      totalGenerations: generations.length,
      totalCharacters: characters.length,
      totalProjects: projects.length,
      totalPanels: panels.length,
      
      // 이미지 관련 통계
      generatedImages: generations.filter(g => g.imageUrl).length,
      panelImages: panels.filter(p => p.imageUrl).length,
      projectThumbnails: projects.filter(p => p.thumbnailUrl).length,
      
      // 캐릭터 이미지 통계
      characterReferenceImages: characters.reduce((sum, c) => {
        const refs = Array.isArray(c.referenceImages) ? c.referenceImages.length : 0;
        return sum + refs;
      }, 0),
      
      characterRatioImages: characters.reduce((sum, c) => {
        if (!c.ratioImages || typeof c.ratioImages !== 'object') return sum;
        return sum + Object.values(c.ratioImages).reduce((ratioSum: number, images: any) => {
          return ratioSum + (Array.isArray(images) ? images.length : 0);
        }, 0);
      }, 0),

      // 토큰 사용량
      totalTokensUsed: generations.reduce((sum, g) => sum + (g.tokensUsed || 0), 0),
      
      // 모델별 사용량
      modelUsage: generations.reduce((acc, g) => {
        acc[g.model || 'unknown'] = (acc[g.model || 'unknown'] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    // 📈 총 이미지 개수 계산 (중복 없이)
    const totalImages = 
      dbUsage.generatedImages + 
      dbUsage.panelImages + 
      dbUsage.projectThumbnails +
      dbUsage.characterReferenceImages + 
      dbUsage.characterRatioImages;

    // 💾 예상 스토리지 사용량 (이미지당 평균 2MB로 가정)
    const estimatedStorageBytes = totalImages * 2 * 1024 * 1024; // 2MB per image
    const estimatedStorageMB = (estimatedStorageBytes / (1024 * 1024)).toFixed(2);
    const estimatedStorageGB = (estimatedStorageBytes / (1024 * 1024 * 1024)).toFixed(3);

    // ⚠️ 사용량 경고 레벨 계산
    const warningLevel = 
      totalImages > 1000 ? 'critical' : 
      totalImages > 500 ? 'high' : 
      totalImages > 100 ? 'medium' : 'normal';

    return NextResponse.json({
      success: true,
      user: {
        id: userData.id,
        email: userData.email
      },
      dbUsage,
      summary: {
        totalImages,
        estimatedStorage: {
          bytes: estimatedStorageBytes,
          mb: estimatedStorageMB,
          gb: estimatedStorageGB,
          formatted: estimatedStorageBytes > 1024 * 1024 * 1024 ? 
            `${estimatedStorageGB} GB` : `${estimatedStorageMB} MB`
        },
        warningLevel,
        isAbnormal: totalImages > 1000 || dbUsage.totalCharacters > 100 || dbUsage.totalProjects > 100
      },
      limits: {
        maxImages: 1000,
        maxCharacters: 100,
        maxTokens: 1000000
      }
    });

  } catch (error) {
    console.error("DB usage API error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "DB 사용량 조회 중 오류가 발생했습니다",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}