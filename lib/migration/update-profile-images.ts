/**
 * 기존 사용자들의 Google 프로필 이미지 업데이트
 * Vercel Blob → Supabase Storage 마이그레이션 과정에서 누락된 프로필 이미지 복구
 */

import { createClient } from "@supabase/supabase-js";

export async function updateUserProfileImages(): Promise<{
  success: boolean;
  updated: number;
  errors: string[];
}> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('🔄 사용자 프로필 이미지 업데이트 시작...');

    // 1. avatarUrl이 null이고 UUID 형태인 사용자들만 찾기
    const { data: allUsers } = await supabase
      .from('user')
      .select('id, email')
      .is('avatarUrl', null);

    if (!allUsers || allUsers.length === 0) {
      console.log('✅ 업데이트가 필요한 사용자가 없습니다.');
      return { success: true, updated: 0, errors: [] };
    }

    // UUID 형태의 사용자만 필터링 (Supabase Auth 사용자)
    const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    const usersWithoutAvatar = allUsers.filter(user => isUUID(user.id));

    if (usersWithoutAvatar.length === 0) {
      console.log('✅ UUID 형태의 업데이트 대상 사용자가 없습니다.');
      return { success: true, updated: 0, errors: [] };
    }

    console.log(`📊 프로필 이미지 업데이트 대상: ${usersWithoutAvatar.length}명`);

    let updated = 0;
    const errors: string[] = [];

    // 2. 각 사용자의 Auth 정보에서 프로필 이미지 가져오기
    for (const user of usersWithoutAvatar) {
      try {
        // Supabase Auth에서 사용자 정보 조회
        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user.id);
        
        if (authError || !authUser.user) {
          errors.push(`${user.email}: Auth 정보 조회 실패`);
          continue;
        }

        // 프로필 이미지 URL 추출
        const avatarUrl = authUser.user.user_metadata?.avatar_url || 
                         authUser.user.user_metadata?.picture || 
                         null;

        if (!avatarUrl) {
          console.log(`⚠️ ${user.email}: 프로필 이미지 없음`);
          continue;
        }

        // 사용자 프로필 이미지 업데이트
        const { error: updateError } = await supabase
          .from('user')
          .update({
            avatarUrl: avatarUrl,
            name: authUser.user.user_metadata?.full_name || 
                  authUser.user.user_metadata?.name || 
                  user.email?.split('@')[0] || '사용자',
            updatedAt: new Date().toISOString()
          })
          .eq('id', user.id);

        if (updateError) {
          errors.push(`${user.email}: 업데이트 실패 - ${updateError.message}`);
        } else {
          updated++;
          console.log(`✅ ${user.email}: 프로필 이미지 업데이트 완료`);
        }

      } catch (error) {
        const errorMsg = `${user.email}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    console.log(`🎯 프로필 이미지 업데이트 완료: ${updated}명 성공, ${errors.length}명 실패`);

    return {
      success: true,
      updated,
      errors
    };

  } catch (error) {
    console.error('💥 프로필 이미지 업데이트 실패:', error);
    return {
      success: false,
      updated: 0,
      errors: [`시스템 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`]
    };
  }
}

/**
 * 기존 data URL 이미지들을 Supabase Storage로 마이그레이션
 */
export async function migrateDataUrlImagesToStorage(): Promise<{
  success: boolean;
  migrated: number;
  errors: string[];
}> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('🔄 Data URL 이미지 → Supabase Storage 마이그레이션 시작...');

    // data URL로 저장된 이미지들 찾기
    const { data: panelsWithDataUrl } = await supabase
      .from('panel')
      .select('id, "imageUrl", "projectId"')
      .like('imageUrl', 'data:image%')
      .limit(10); // 테스트용으로 10개만

    if (!panelsWithDataUrl || panelsWithDataUrl.length === 0) {
      console.log('✅ 마이그레이션이 필요한 이미지가 없습니다.');
      return { success: true, migrated: 0, errors: [] };
    }

    console.log(`📊 마이그레이션 대상 이미지: ${panelsWithDataUrl.length}개`);

    let migrated = 0;
    const errors: string[] = [];

    for (const panel of panelsWithDataUrl) {
      try {
        const dataUrl = panel.imageUrl;
        
        // data URL에서 base64 데이터 추출
        const [headerPart, base64Data] = dataUrl.split(',');
        if (!base64Data) {
          errors.push(`Panel ${panel.id}: 잘못된 data URL 형식`);
          continue;
        }

        // MIME 타입 추출
        const mimeMatch = headerPart.match(/data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
        const fileExtension = mimeType.split('/')[1] || 'png';

        // Buffer 생성
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Supabase Storage에 업로드
        const fileName = `migrated/${panel.projectId}/${panel.id}.${fileExtension}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('webtoon-images')
          .upload(fileName, buffer, {
            contentType: mimeType,
            cacheControl: '31536000',
            upsert: false
          });

        if (uploadError) {
          errors.push(`Panel ${panel.id}: 업로드 실패 - ${uploadError.message}`);
          continue;
        }

        // 공개 URL 생성
        const { data: publicUrl } = supabase.storage
          .from('webtoon-images')
          .getPublicUrl(fileName);

        // DB 업데이트
        const { error: updateError } = await supabase
          .from('panel')
          .update({
            imageUrl: publicUrl.publicUrl,
            updatedAt: new Date().toISOString()
          })
          .eq('id', panel.id);

        if (updateError) {
          errors.push(`Panel ${panel.id}: DB 업데이트 실패 - ${updateError.message}`);
        } else {
          migrated++;
          console.log(`✅ Panel ${panel.id}: 마이그레이션 완료 (${Math.round(buffer.length/1024)}KB)`);
        }

      } catch (error) {
        const errorMsg = `Panel ${panel.id}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    console.log(`🎯 이미지 마이그레이션 완료: ${migrated}개 성공, ${errors.length}개 실패`);

    return {
      success: true,
      migrated,
      errors
    };

  } catch (error) {
    console.error('💥 이미지 마이그레이션 실패:', error);
    return {
      success: false,
      migrated: 0,
      errors: [`시스템 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`]
    };
  }
}