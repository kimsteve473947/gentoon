'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { MiriCanvasStudioUltimate } from "@/components/studio/MiriCanvasStudioUltimate";

// UUID 생성 함수
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function StudioContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get('projectId');
  const [projectData, setProjectData] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 🚀 즉시 초기화 - 실제 DB 사용
  useEffect(() => {
    const initializeStudio = async () => {
      try {
        console.log('🚀 Studio initialization with real DB');
        
        // 실제 데이터베이스 사용 (개발/프로덕션 동일)
        if (projectId) {
          await loadProject();
        } else {
          await createNewProject();
        }
      } catch (error) {
        console.error('Studio initialization error:', error);
        // 에러 발생시에도 기본 프로젝트로 초기화
        setProjectData({
          id: 'temp',
          title: '무제 프로젝트',
          userId: 'temp',
          workspacesettings: {}
        });
      } finally {
        setIsInitialized(true);
      }
    };

    initializeStudio();
  }, [projectId]);

  const loadProject = useCallback(async () => {
    try {
      // 🚀 개발/프로덕션 모드 통합 - 실제 DB에서 프로젝트 조회

      // 프로덕션 모드에서는 실제 데이터베이스 조회
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/sign-in?redirectTo=/studio');
        return;
      }

      const { data, error } = await supabase
        .from('project')
        .select('*')
        .eq('id', projectId)
        .eq('userId', user.id)
        .single();

      if (error) throw error;
      setProjectData(data);
    } catch (error) {
      console.error('Error loading project:', error);
      // 프로젝트 로드 실패 시 새 프로젝트 생성
      await createNewProject();
    }
  }, [projectId, router, supabase]);

  const createNewProject = useCallback(async () => {
    try {
      // 🚀 개발/프로덕션 모드 통합 - 실제 DB에 프로젝트 생성

      // 프로덕션 모드에서는 실제 프로젝트 생성
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/sign-in?redirectTo=/studio');
        return;
      }

      const { data: userData } = await supabase
        .from('user')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!userData) {
        const { data: newUser, error: createError } = await supabase
          .from('user')
          .insert({ 
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
          })
          .select()
          .single();
        
        if (createError || !newUser) {
          console.error('Error creating user:', createError);
          return;
        }
        
        const newProject = {
          userId: newUser.id,
          title: '무제 프로젝트',
          description: '',
          status: 'DRAFT',
          isPublic: false,
          isdraft: true,
          workspacesettings: {},
          tags: [],
          episodecount: 0,
          viewcount: 0,
          likecount: 0
        };

        const { data, error } = await supabase
          .from('project')
          .insert(newProject)
          .select()
          .single();

        if (error) throw error;
        
        router.replace(`/studio?projectId=${data.id}`);
        setProjectData(data);
        return;
      }

      const newProject = {
        userId: userData.id,
        title: '무제 프로젝트',
        description: '',
        status: 'DRAFT',
        isPublic: false,
        isdraft: true,
        workspacesettings: {},
        tags: [],
        episodecount: 0,
        viewcount: 0,
        likecount: 0
      };

      const { data, error } = await supabase
        .from('project')
        .insert(newProject)
        .select()
        .single();

      if (error) throw error;
      
      router.replace(`/studio?projectId=${data.id}`);
      setProjectData(data);
    } catch (error) {
      console.error('Error creating project:', error);
    }
  }, [router, supabase]);

  // 🚀 🚀 🚀 완전히 최적화된 프로젝트 저장 로직 🚀 🚀 🚀
  const saveProject = async (panels: any[], title?: string) => {
    if (!projectData) {
      console.error('❌ No project data available for saving');
      return;
    }

    const startTime = Date.now();

    // 🚀 개발 모드에서도 실제 DB 사용 (API 호출과 일관성 유지)
    console.log('💾 Using database save for consistency with API calls');

    // 프로덕션 모드에서는 실제 데이터베이스 저장
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('❌ User not authenticated');
      router.push('/sign-in?redirectTo=/studio');
      return;
    }

    if (projectData.userId !== user.id) {
      console.error('❌ User does not own this project');
      throw new Error('프로젝트에 대한 접근 권한이 없습니다.');
    }

    console.log('🚀 [OPTIMIZED] Starting super-fast project save:', {
      projectId: projectData.id,
      panelCount: panels?.length || 0,
      title: title || 'no title change'
    });

    try {
      // 1. 프로젝트 메타데이터 업데이트 (병렬 처리 준비)
      const { panels: _, ...cleanWorkspaceSettings } = projectData.workspacesettings || {};
      const updateData: any = {
        lasteditedat: new Date().toISOString(),
        workspacesettings: cleanWorkspaceSettings
      };

      if (title) {
        updateData.title = title;
      }

      // 2. 🚀 핵심 최적화: 프로젝트 업데이트와 패널 UPSERT를 병렬 처리
      const promises = [];

      // 프로젝트 테이블 업데이트
      promises.push(
        supabase
          .from('project')
          .update(updateData)
          .eq('id', projectData.id)
          .then(result => {
            if (result.error) throw result.error;
            console.log('✅ Project metadata updated');
            return result;
          })
      );

      // 패널 데이터 최적화 저장
      if (panels && panels.length > 0) {
        console.log(`🚀 [ULTRA-FAST] Direct UPSERT for ${panels.length} panels - NO DELETE!`);
        
        // 🎯 핵심 개선: 삭제 없이 바로 UPSERT
        const panelData = panels.map((panel, index) => ({
          projectId: projectData.id,
          order: index,
          prompt: panel.prompt || '',
          imageUrl: panel.imageUrl || null,
          editData: panel.editData || null
        }));

        // 🚀 대량 데이터 처리: 스마트 배치 크기 결정
        const batchSize = panels.length > 200 ? 100 : 
                         panels.length > 50 ? 50 : panels.length;
        
        for (let i = 0; i < panelData.length; i += batchSize) {
          const batch = panelData.slice(i, i + batchSize);
          const batchNum = Math.floor(i/batchSize) + 1;
          const totalBatches = Math.ceil(panelData.length/batchSize);
          
          console.log(`🔥 [BATCH-${batchNum}/${totalBatches}] UPSERT ${batch.length} panels...`);
          
          // 배치 UPSERT를 promises에 추가 (병렬 처리)
          promises.push(
            supabase
              .from('panel')
              .upsert(batch, {
                onConflict: 'projectId,order',
                ignoreDuplicates: false
              })
              .then(result => {
                if (result.error) {
                  console.error(`❌ Batch ${batchNum} failed:`, result.error);
                  throw result.error;
                }
                console.log(`✅ Batch ${batchNum} completed successfully`);
                return result;
              })
          );
        }

        // 🧹 필요시에만 정리: 기존 패널보다 적어진 경우에만 삭제
        if (panels.length > 0) {
          const maxOrder = panels.length - 1;
          promises.push(
            supabase
              .from('panel')
              .delete()
              .eq('projectId', projectData.id)
              .gt('"order"', maxOrder)
              .then(result => {
                if (result.error) {
                  console.warn('⚠️ Cleanup failed, but continuing...', result.error);
                } else {
                  console.log(`🧹 Cleaned up panels beyond order ${maxOrder}`);
                }
                return result;
              })
          );
        }
      }

      // 🚀 모든 작업을 병렬로 실행
      await Promise.all(promises);
      
      const totalTime = Date.now() - startTime;
      console.log(`🎉 [OPTIMIZED] Project saved successfully in ${totalTime}ms (${Math.round(totalTime/1000 * 10)/10}s)`);
      
      // 성능 메트릭 로깅
      if (panels?.length > 0) {
        const panelsPerSecond = Math.round((panels.length / totalTime) * 1000);
        console.log(`📊 Performance: ${panelsPerSecond} panels/second`);
      }

    } catch (error: any) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ [OPTIMIZED] Save failed after ${totalTime}ms:`, error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      if (error && typeof error === 'object') {
        console.error('Error code:', error.code);
        console.error('Error status:', error.status);
        console.error('Error details from Supabase:', error.details);
        console.error('Error hint:', error.hint);
      }
      
      throw error;
    }
  };

  // 🚀 초기화가 완료되지 않았으면 아무것도 렌더링하지 않음 (Suspense 스켈레톤이 표시됨)
  if (!isInitialized || !projectData) {
    return null;
  }

  // 🚀 즉시 스튜디오 컴포넌트 렌더링 - 추가 로딩 없음
  return (
    <MiriCanvasStudioUltimate 
      projectId={projectData?.id}
      initialData={projectData}
      onSave={saveProject}
    />
  );
}