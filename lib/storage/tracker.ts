import { createClient } from '@/lib/supabase/server';

export interface StorageTrackingResult {
  success: boolean;
  error?: string;
  currentUsage?: number;
  limit?: number;
  available?: number;
}

/**
 * 사용자 스토리지 사용량을 추적하고 업데이트합니다
 * @param userId - 사용자 ID
 * @param fileSize - 파일 크기 (bytes)
 * @param operation - 'add' 또는 'remove'
 * @returns 추적 결과
 */
export async function trackStorageUsage(
  userId: string, 
  fileSize: number, 
  operation: 'add' | 'remove'
): Promise<StorageTrackingResult> {
  try {
    const supabase = await createClient();
    
    // 현재 사용자 스토리지 정보 조회
    let { data: storage, error: storageError } = await supabase
      .from('user_storage')
      .select('*')
      .eq('userId', userId)
      .single();

    if (storageError && storageError.code !== 'PGRST116') {
      console.error('스토리지 조회 오류:', storageError);
      return { success: false, error: '스토리지 정보 조회 실패' };
    }

    // 스토리지 레코드가 없으면 생성
    if (!storage) {
      // 사용자 구독 정보를 확인하여 스토리지 제한 설정
      const { data: subscription } = await supabase
        .from('subscription')
        .select('plan')
        .eq('userId', userId)
        .single();

      let maxBytes = 1073741824; // 1GB default
      switch (subscription?.plan) {
        case 'FREE': maxBytes = 104857600; break; // 100MB
        case 'PRO': maxBytes = 5368709120; break; // 5GB
        case 'PREMIUM': maxBytes = 21474836480; break; // 20GB
        case 'ADMIN': maxBytes = 107374182400; break; // 100GB
      }

      const { data: newStorage, error: insertError } = await supabase
        .from('user_storage')
        .insert({
          userId,
          used_bytes: 0,
          max_bytes: maxBytes,
          file_count: 0
        })
        .select()
        .single();

      if (insertError) {
        console.error('스토리지 생성 오류:', insertError);
        return { success: false, error: '스토리지 정보 생성 실패' };
      }

      storage = newStorage;
    }

    // 스토리지 사용량 계산
    let newUsedBytes = storage.used_bytes;
    let newFileCount = storage.file_count || 0;

    if (operation === 'add') {
      // 스토리지 제한 확인
      if (newUsedBytes + fileSize > storage.max_bytes) {
        return {
          success: false,
          error: '스토리지 제한 초과',
          currentUsage: newUsedBytes,
          limit: storage.max_bytes,
          available: storage.max_bytes - newUsedBytes
        };
      }

      newUsedBytes += fileSize;
      newFileCount += 1;
    } else if (operation === 'remove') {
      newUsedBytes = Math.max(0, newUsedBytes - fileSize);
      newFileCount = Math.max(0, newFileCount - 1);
    }

    // 스토리지 정보 업데이트
    const { error: updateError } = await supabase
      .from('user_storage')
      .update({
        used_bytes: newUsedBytes,
        file_count: newFileCount,
        updated_at: new Date().toISOString()
      })
      .eq('userId', userId);

    if (updateError) {
      console.error('스토리지 업데이트 오류:', updateError);
      return { success: false, error: '스토리지 업데이트 실패' };
    }

    // user_usage_cache도 업데이트
    await supabase
      .from('user_usage_cache')
      .upsert({
        user_id: userId,
        storage_used_bytes: newUsedBytes,
        storage_limit_bytes: storage.max_bytes,
        updated_at: new Date().toISOString()
      });

    console.log(`📊 스토리지 추적 완료: ${userId} - ${operation} ${fileSize} bytes (총 ${newUsedBytes} bytes)`);

    return {
      success: true,
      currentUsage: newUsedBytes,
      limit: storage.max_bytes,
      available: storage.max_bytes - newUsedBytes
    };

  } catch (error) {
    console.error('스토리지 추적 오류:', error);
    return { success: false, error: '스토리지 추적 처리 실패' };
  }
}

/**
 * 사용자의 현재 스토리지 사용량을 확인합니다
 * @param userId - 사용자 ID
 * @returns 스토리지 정보
 */
export async function checkStorageLimit(userId: string): Promise<{
  success: boolean;
  currentUsage: number;
  limit: number;
  available: number;
  canUpload: (fileSize: number) => boolean;
}> {
  try {
    const supabase = await createClient();
    
    let { data: storage } = await supabase
      .from('user_storage')
      .select('*')
      .eq('userId', userId)
      .single();

    if (!storage) {
      // 기본 제한 사용 (FREE 플랜)
      return {
        success: true,
        currentUsage: 0,
        limit: 104857600, // 100MB
        available: 104857600,
        canUpload: (fileSize: number) => fileSize <= 104857600
      };
    }

    return {
      success: true,
      currentUsage: storage.used_bytes,
      limit: storage.max_bytes,
      available: storage.max_bytes - storage.used_bytes,
      canUpload: (fileSize: number) => (storage.used_bytes + fileSize) <= storage.max_bytes
    };

  } catch (error) {
    console.error('스토리지 확인 오류:', error);
    return {
      success: false,
      currentUsage: 0,
      limit: 0,
      available: 0,
      canUpload: () => false
    };
  }
}

/**
 * 파일 크기를 사람이 읽기 쉬운 형태로 포맷합니다
 * @param bytes - 바이트 수
 * @returns 포맷된 문자열
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}