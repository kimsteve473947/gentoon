import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 🔍 Auth ID 마이그레이션 문제 분석 API
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    console.log('🔍 [Auth-Analysis] Auth ID 마이그레이션 분석 시작');
    
    // 현재 인증된 사용자 정보
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: "인증 필요"
      }, { status: 401 });
    }
    
    console.log('👤 [Auth-Analysis] 현재 인증된 사용자:', {
      id: user.id,
      email: user.email
    });
    
    // 1. User 테이블에서 현재 사용자 확인
    const { data: userRecord, error: userError } = await supabase
      .from('user')
      .select('*')
      .eq('id', user.id)
      .single();
    
    console.log('📋 [Auth-Analysis] User 테이블 레코드:', {
      userRecord,
      userError
    });
    
    // 2. 해당 프로젝트의 실제 소유자 확인
    const projectId = 'b84998e8-4a98-41fa-85b8-3dc1373d6e58';
    const { data: projectRecord, error: projectError } = await supabase
      .from('project')
      .select('id, userId, title, createdAt, updatedAt')
      .eq('id', projectId)
      .single();
    
    console.log('📁 [Auth-Analysis] 프로젝트 레코드:', {
      projectRecord,
      projectError
    });
    
    // 3. 프로젝트 소유자와 현재 사용자 비교
    const ownershipMatch = projectRecord?.userId === user.id;
    console.log('🔗 [Auth-Analysis] 소유권 매치:', {
      currentUserId: user.id,
      projectUserId: projectRecord?.userId,
      match: ownershipMatch
    });
    
    // 4. User 테이블에서 모든 사용자 검색 (마이그레이션 상태 확인)
    const { data: allUsers, error: allUsersError } = await supabase
      .from('user')
      .select('id, email, createdAt')
      .order('createdAt', { ascending: false })
      .limit(10);
    
    console.log('👥 [Auth-Analysis] 최근 사용자들:', {
      allUsers: allUsers?.map(u => ({ id: u.id, email: u.email })),
      allUsersError
    });
    
    // 5. 프로젝트 소유자 사용자 정보 조회 (다른 사용자인 경우)
    let projectOwnerInfo = null;
    if (projectRecord && !ownershipMatch) {
      const { data: ownerInfo, error: ownerError } = await supabase
        .from('user')
        .select('id, email, createdAt')
        .eq('id', projectRecord.userId)
        .single();
      
      projectOwnerInfo = { ownerInfo, ownerError };
      console.log('👤 [Auth-Analysis] 프로젝트 실제 소유자:', projectOwnerInfo);
    }
    
    // 6. 현재 사용자의 모든 프로젝트 확인
    const { data: userProjects, error: userProjectsError } = await supabase
      .from('project')
      .select('id, title, createdAt')
      .eq('userId', user.id)
      .order('createdAt', { ascending: false })
      .limit(5);
    
    console.log('📁 [Auth-Analysis] 현재 사용자의 프로젝트들:', {
      userProjects,
      userProjectsError
    });
    
    return NextResponse.json({
      success: true,
      analysis: {
        currentUser: {
          id: user.id,
          email: user.email
        },
        userRecord: {
          exists: !!userRecord,
          data: userRecord,
          error: userError?.message
        },
        targetProject: {
          id: projectId,
          data: projectRecord,
          error: projectError?.message
        },
        ownership: {
          match: ownershipMatch,
          currentUserId: user.id,
          projectUserId: projectRecord?.userId,
          issue: !ownershipMatch ? 'OWNERSHIP_MISMATCH' : null
        },
        projectOwner: projectOwnerInfo,
        currentUserProjects: {
          count: userProjects?.length || 0,
          projects: userProjects,
          error: userProjectsError?.message
        },
        diagnosis: ownershipMatch 
          ? 'AUTH_OK_BUT_OTHER_ISSUE' 
          : 'AUTH_ID_MIGRATION_NEEDED',
        recommendation: ownershipMatch 
          ? '인증은 정상이지만 다른 문제가 있습니다. API 호출이나 데이터베이스 스키마를 확인해야 합니다.'
          : '프로젝트가 다른 사용자 ID로 연결되어 있습니다. Auth ID 마이그레이션이 필요합니다.'
      }
    });
    
  } catch (error) {
    console.error('💥 [Auth-Analysis] 분석 실패:', error);
    return NextResponse.json({
      success: false,
      error: "분석 중 오류 발생",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}