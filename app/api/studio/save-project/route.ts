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

    // 🚀 패널 저장 및 프로젝트 메타데이터 자동 계산
    if (panels && panels.length > 0) {
      
      // 기존 패널 모두 삭제 후 새로 생성 (간단하고 빠름)
      const { error: deleteError } = await supabase
        .from('panel')
        .delete()
        .eq('projectId', project.id);

      if (deleteError) {
        console.error('❌ [Save-Project] 기존 패널 삭제 실패:', deleteError);
        throw new Error(`기존 패널 삭제 실패: ${deleteError.message} (코드: ${deleteError.code})`);
      }
      console.log('✅ [Save-Project] 기존 패널 삭제 완료');

      // 새 패널들 일괄 생성
      console.log('➕ [Save-Project] 새 패널 데이터 생성');
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

      console.log('💾 [Save-Project] 패널 데이터 DB 삽입 시작:', {
        count: panelData.length,
        preview: panelData.slice(0, 2).map(p => ({
          order: p.order,
          hasPrompt: !!p.prompt,
          hasImageUrl: !!p.imageUrl,
          editDataKeys: Object.keys(p.editData || {})
        }))
      });

      const { error: insertError } = await supabase
        .from('panel')
        .insert(panelData);

      if (insertError) {
        console.error('❌ [Save-Project] 패널 삽입 실패:', insertError);
        console.error('삽입 시도한 데이터 미리보기:', panelData.slice(0, 1));
        throw new Error(`패널 저장 실패: ${insertError.message} (코드: ${insertError.code})`);
      }
      console.log('✅ [Save-Project] 패널 삽입 완료');

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