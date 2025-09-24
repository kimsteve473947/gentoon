import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  console.log('🔥 [Save-Project] API 호출 시작:', {
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
    contentType: request.headers.get('content-type'),
    userAgent: request.headers.get('user-agent')
  });

  try {
    const supabase = await createClient();
    console.log('✅ [Save-Project] Supabase 클라이언트 생성 완료');
    
    // Beacon API 요청 처리 (페이지 이탈 시 자동 저장)
    const contentType = request.headers.get('content-type');
    let body;
    let rawBody;
    
    try {
      if (contentType?.includes('text/plain')) {
        // Beacon API는 text/plain으로 전송됨
        const text = await request.text();
        rawBody = text;
        console.log('📄 [Save-Project] Beacon API 텍스트 수신:', text.substring(0, 200) + '...');
        body = JSON.parse(text);
      } else {
        body = await request.json();
        rawBody = JSON.stringify(body);
        console.log('📦 [Save-Project] JSON 데이터 수신:', {
          hasProjectId: !!body.projectId,
          hasProjectName: !!body.projectName,
          panelsCount: body.panels?.length || 0
        });
      }
    } catch (parseError) {
      console.error('❌ [Save-Project] 요청 본문 파싱 실패:', parseError);
      console.error('Raw body preview:', rawBody?.substring(0, 500));
      throw new Error(`요청 데이터 파싱 실패: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
    
    const { projectId, projectName, panels } = body;
    
    // 요청 데이터 검증
    if (!projectName || typeof projectName !== 'string') {
      throw new Error('프로젝트 이름이 유효하지 않습니다');
    }
    
    if (!Array.isArray(panels)) {
      throw new Error('패널 데이터가 배열이 아닙니다');
    }
    
    console.log('✅ [Save-Project] 요청 데이터 검증 완료:', {
      projectId: projectId || 'NEW',
      projectName: projectName.substring(0, 50),
      panelsCount: panels.length
    });
    
    // 모든 변경사항을 저장 (빈 프로젝트 체크 제거)
    
    console.log('🔐 [Save-Project] 사용자 인증 확인 시작');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('❌ [Save-Project] 인증 에러:', authError);
      return NextResponse.json(
        { success: false, error: "인증 확인 중 오류 발생", details: authError.message },
        { status: 401 }
      );
    }
    
    if (!user) {
      console.warn('⚠️ [Save-Project] 인증되지 않은 사용자');
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    console.log('✅ [Save-Project] 사용자 인증 완료:', {
      userId: user.id,
      email: user.email
    });

    // 사용자 정보 조회
    console.log('👤 [Save-Project] 사용자 데이터 조회 시작');
    const { data: userData, error: userError } = await supabase
      .from('user')
      .select('id')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('❌ [Save-Project] 사용자 데이터 조회 실패:', userError);
      return NextResponse.json(
        { success: false, error: "사용자 데이터 조회 실패", details: userError.message },
        { status: 500 }
      );
    }

    if (!userData) {
      console.warn('⚠️ [Save-Project] 사용자 데이터가 존재하지 않음:', user.id);
      return NextResponse.json(
        { success: false, error: "사용자 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }
    
    console.log('✅ [Save-Project] 사용자 데이터 조회 완료:', userData.id);

    let project;

    if (projectId) {
      // 기존 프로젝트 업데이트
      console.log('📝 [Save-Project] 기존 프로젝트 업데이트 시작:', {
        projectId,
        title: projectName,
        userId: userData.id,
        userIdType: typeof userData.id,
        userIdLength: userData.id?.length
      });
      
      // 🔍 프로젝트 존재 여부 먼저 확인
      const { data: existingProject, error: fetchError } = await supabase
        .from('project')
        .select('id, userId, title')
        .eq('id', projectId)
        .single();
      
      console.log('🔍 [Save-Project] 기존 프로젝트 조회:', {
        existingProject,
        fetchError,
        userIdMatch: existingProject?.userId === userData.id,
        existingUserId: existingProject?.userId,
        providedUserId: userData.id
      });
      
      // 💾 사용자 소유 프로젝트 업데이트
      console.log('💡 [Save-Project] 프로젝트 업데이트 시도');
      const { data: updatedProject, error: updateError } = await supabase
        .from('project')
        .update({
          title: projectName,
          updatedAt: new Date().toISOString(),
          lastEditedAt: new Date().toISOString(),
        })
        .eq('id', projectId)
        .eq('userId', userData.id)
        .select();

      if (updateError) {
        console.error("❌ [Save-Project] 프로젝트 업데이트 오류:", updateError);
        console.error('업데이트 시도 데이터:', {
          projectId,
          userId: userData.id,
          title: projectName
        });
        throw new Error(`프로젝트 업데이트 실패: ${updateError.message} (코드: ${updateError.code})`);
      }

      if (!updatedProject || updatedProject.length === 0) {
        console.error("❌ [Save-Project] 업데이트된 프로젝트가 없음 - 권한이 없거나 프로젝트가 존재하지 않음");
        throw new Error("프로젝트를 찾을 수 없거나 수정 권한이 없습니다");
      }

      project = updatedProject[0];
      console.log('✅ [Save-Project] 프로젝트 업데이트 완료:', project.id);
    } else {
      // 새 프로젝트 생성
      console.log('🆕 [Save-Project] 새 프로젝트 생성 시작:', {
        userId: userData.id,
        title: projectName || '무제 프로젝트'
      });
      
      const { data: newProject, error: createError } = await supabase
        .from('project')
        .insert({
          userId: userData.id,
          title: projectName || '무제 프로젝트',
          status: 'DRAFT',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastEditedAt: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error("❌ [Save-Project] 프로젝트 생성 오류:", createError);
        console.error('생성 시도 데이터:', {
          userId: userData.id,
          title: projectName || '무제 프로젝트'
        });
        throw new Error(`프로젝트 생성 실패: ${createError.message} (코드: ${createError.code})`);
      }

      if (!newProject) {
        console.error("❌ [Save-Project] 생성된 프로젝트가 반환되지 않음");
        throw new Error("프로젝트 생성 후 데이터 반환 실패");
      }

      project = newProject;
      console.log('✅ [Save-Project] 새 프로젝트 생성 완료:', project.id);
    }

    // 🚀 🚀 🚀 최적화된 패널 저장 - UPSERT 패턴 적용 🚀 🚀 🚀
    if (panels && panels.length > 0) {
      const startTime = Date.now();
      console.log(`🚀 [OPTIMIZED-API] Starting super-fast panel save for ${panels.length} panels`);
      
      // 패널 데이터 준비
      const panelData = panels.map((panel, index) => {
        // 패널 데이터 유효성 검사
        if (!panel || typeof panel !== 'object') {
          throw new Error(`패널 ${index}: 잘못된 패널 데이터`);
        }
        
        return {
          projectId: project.id,
          order: index,
          prompt: panel.prompt || '',
          imageUrl: panel.imageUrl || null,
          editData: panel.editData || {
            elements: panel.elements || [],
            content: panel.content || '',
            settings: panel.settings || {},
            metadata: panel.metadata || {},
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      console.log('💾 [OPTIMIZED-API] Panel data prepared:', {
        count: panelData.length,
        preview: panelData.slice(0, 2).map(p => ({
          order: p.order,
          hasPrompt: !!p.prompt,
          hasImageUrl: !!p.imageUrl
        }))
      });

      // 🚀 스마트 배치 크기 결정
      const batchSize = panels.length > 200 ? 100 : 
                       panels.length > 50 ? 50 : panels.length;
      
      const promises = [];
      
      // 🔥 병렬 UPSERT 처리
      for (let i = 0; i < panelData.length; i += batchSize) {
        const batch = panelData.slice(i, i + batchSize);
        const batchNum = Math.floor(i/batchSize) + 1;
        const totalBatches = Math.ceil(panelData.length/batchSize);
        
        console.log(`🔥 [API-BATCH-${batchNum}/${totalBatches}] UPSERT ${batch.length} panels...`);
        
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
                console.error(`❌ API Batch ${batchNum} failed:`, result.error);
                throw result.error;
              }
              console.log(`✅ API Batch ${batchNum} completed successfully`);
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
            .eq('projectId', project.id)
            .gt('"order"', maxOrder)
            .then(result => {
              if (result.error) {
                console.warn('⚠️ API Cleanup failed, but continuing...', result.error);
              } else {
                console.log(`🧹 API Cleaned up panels beyond order ${maxOrder}`);
              }
              return result;
            })
        );
      }

      // 🚀 모든 UPSERT 작업을 병렬로 실행
      await Promise.all(promises);
      
      const totalTime = Date.now() - startTime;
      console.log(`🎉 [OPTIMIZED-API] Panel save completed in ${totalTime}ms (${Math.round(totalTime/1000 * 10)/10}s)`);
      
      // 성능 메트릭 로깅
      const panelsPerSecond = Math.round((panels.length / totalTime) * 1000);
      console.log(`📊 API Performance: ${panelsPerSecond} panels/second`);

      // 🚀 프로젝트 메타데이터 자동 계산 및 업데이트
      const panelCount = panels.length;
      const imagesWithUrl = panels.filter(p => p.imageUrl && p.imageUrl.trim() !== '');
      const imageCount = imagesWithUrl.length;
      const firstImageUrl = imagesWithUrl.length > 0 ? imagesWithUrl[0].imageUrl : null;
      
      // 썸네일 자동 설정 (첫 번째 이미지가 있으면)
      const thumbnailUrl = firstImageUrl || project.thumbnailUrl;
      
      // 프로젝트 상태 계산
      const isEmpty = imageCount === 0;
      const hasContent = !isEmpty;
      
      // 콘텐츠 요약 생성
      const contentSummary = isEmpty 
        ? '빈 프로젝트'
        : imageCount === 0 
          ? `${panelCount}개 패널 (이미지 없음)`
          : `${panelCount}개 패널, ${imageCount}개 이미지`;

      // 프로젝트 메타데이터 업데이트
      await supabase
        .from('project')
        .update({
          panelCount,
          thumbnailUrl,
          lastPanelImageUrl: firstImageUrl,
          isEmpty,
          hasContent,
          contentSummary,
          lastEditedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .eq('id', project.id);
        
    } else {
      // 빈 프로젝트 처리
      await supabase
        .from('project')
        .update({
          panelCount: 0,
          isEmpty: true,
          hasContent: false,
          contentSummary: '빈 프로젝트',
          lastEditedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .eq('id', project.id);
    }

    return NextResponse.json({
      success: true,
      projectId: project.id,
      message: "프로젝트가 성공적으로 저장되었습니다"
    });

  } catch (error) {
    console.error("Project save error:", error);
    
    // 더 상세한 에러 정보 추가
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : 'Unknown',
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    });
    
    return NextResponse.json(
      { 
        success: false, 
        error: "프로젝트 저장 중 오류가 발생했습니다",
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}