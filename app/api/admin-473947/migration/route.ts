/**
 * 관리자용 데이터 마이그레이션 API
 * - Google 프로필 이미지 업데이트
 * - Data URL 이미지를 Supabase Storage로 마이그레이션
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateUserProfileImages, migrateDataUrlImagesToStorage } from '@/lib/migration/update-profile-images';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 마이그레이션 작업 실행
 */
export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다'
      }, { status: 401 });
    }

    // 관리자 권한 확인
    const isAdmin = user.email === 'kimjh473947@gmail.com';
    if (!isAdmin) {
      return NextResponse.json({
        success: false,
        error: '관리자 권한이 필요합니다'
      }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    let result: any;

    switch (action) {
      case 'update_profile_images':
        console.log('🚀 Google 프로필 이미지 업데이트 시작...');
        result = await updateUserProfileImages();
        break;

      case 'migrate_data_url_images':
        console.log('🚀 Data URL 이미지 마이그레이션 시작...');
        result = await migrateDataUrlImagesToStorage();
        break;

      default:
        return NextResponse.json({
          success: false,
          error: `알 수 없는 액션: ${action}`
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('마이그레이션 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '마이그레이션 실행 중 오류가 발생했습니다',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
}

/**
 * 마이그레이션 상태 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다'
      }, { status: 401 });
    }

    const isAdmin = user.email === 'kimjh473947@gmail.com';
    if (!isAdmin) {
      return NextResponse.json({
        success: false,
        error: '관리자 권한이 필요합니다'
      }, { status: 403 });
    }

    // 마이그레이션 상태 조회
    const [usersWithoutAvatar, dataUrlImages] = await Promise.all([
      // avatarUrl이 null인 사용자 수
      supabase
        .from('user')
        .select('id', { count: 'exact' })
        .is('avatarUrl', null),
      
      // data URL로 저장된 이미지 수
      supabase
        .from('panel')
        .select('id', { count: 'exact' })
        .like('imageUrl', 'data:image%')
    ]);

    const status = {
      usersWithoutProfileImage: usersWithoutAvatar.count || 0,
      dataUrlImagesCount: dataUrlImages.count || 0,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('마이그레이션 상태 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '상태 조회 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}