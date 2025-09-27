import { createClient } from '@/lib/supabase/server'
import { STORAGE_LIMITS } from '@/lib/subscription/plan-config'

// Re-export STORAGE_LIMITS for external use
export { STORAGE_LIMITS }

// 멤버십 타입 (중앙 설정 사용)
export type MembershipType = 'FREE' | 'STARTER' | 'PRO' | 'PREMIUM' | 'ADMIN'

// 바이트를 읽기 쉬운 형식으로 변환
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

// 용량을 GB로 변환
export function bytesToGB(bytes: number): number {
  return bytes / (1024 * 1024 * 1024)
}

// 사용자의 스토리지 정보 가져오기
export async function getUserStorage(userId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('user_storage')
    .select('*')
    .eq('userId', userId)
    .single()
  
  if (error && error.code === 'PGRST116') {
    // 레코드가 없으면 생성
    const { data: newStorage, error: createError } = await supabase
      .from('user_storage')
      .insert({
        userId: userId,
        used_bytes: 0,
        max_bytes: STORAGE_LIMITS.FREE,
        file_count: 0
      })
      .select()
      .single()
    
    if (createError) throw createError
    return newStorage
  }
  
  if (error) throw error
  return data
}

// 멤버십에 따른 최대 용량 업데이트 (안전한 방식)
export async function updateStorageLimit(userId: string, membership: MembershipType) {
  const supabase = await createClient()
  const maxBytes = STORAGE_LIMITS[membership]
  
  // 먼저 기존 레코드 확인
  const { data: existingStorage } = await supabase
    .from('user_storage')
    .select('id')
    .eq('userId', userId)
    .single()
  
  let result;
  if (existingStorage) {
    // 기존 레코드 업데이트
    result = await supabase
      .from('user_storage')
      .update({
        max_bytes: maxBytes,
        updated_at: new Date().toISOString()
      })
      .eq('userId', userId)
  } else {
    // 새 레코드 생성
    result = await supabase
      .from('user_storage')
      .insert({
        userId: userId,
        used_bytes: 0,
        max_bytes: maxBytes,
        file_count: 0
      })
  }
  
  if (result.error) {
    console.error('스토리지 한도 업데이트 오류:', result.error)
    throw result.error
  }
  
  console.log(`✅ [Storage] 사용자 ${userId.slice(0, 8)} 스토리지 한도 업데이트: ${membership} (${formatBytes(maxBytes)})`)
}

// 사용자 구독 플랜에 따른 자동 스토리지 한도 설정
export async function autoSetStorageLimitBySubscription(userId: string) {
  const supabase = await createClient()
  
  // 사용자의 구독 정보 조회
  const { data: subscription, error } = await supabase
    .from('subscription')
    .select('plan')
    .eq('userId', userId)
    .single()
  
  if (error && error.code !== 'PGRST116') {
    console.error('구독 정보 조회 실패:', error)
    // 오류 시 FREE 플랜으로 기본 설정
    await updateStorageLimit(userId, 'FREE')
    return
  }
  
  const plan = subscription?.plan || 'FREE'
  let membership: MembershipType = 'FREE'
  
  switch (plan) {
    case 'STARTER':
      membership = 'STARTER'
      break
    case 'PRO':
      membership = 'PRO'
      break
    case 'PREMIUM':
      membership = 'PREMIUM'
      break
    default:
      membership = 'FREE'
  }
  
  await updateStorageLimit(userId, membership)
}

// 파일 업로드 전 용량 체크
export async function canUploadFile(userId: string, fileSize: number): Promise<{
  canUpload: boolean
  usedBytes: number
  maxBytes: number
  remainingBytes: number
  usagePercentage: number
}> {
  const storage = await getUserStorage(userId)
  
  const remainingBytes = storage.max_bytes - storage.used_bytes
  const canUpload = fileSize <= remainingBytes
  const usagePercentage = (storage.used_bytes / storage.max_bytes) * 100
  
  return {
    canUpload,
    usedBytes: storage.used_bytes,
    maxBytes: storage.max_bytes,
    remainingBytes,
    usagePercentage
  }
}

// 파일 업로드 후 용량 업데이트
export async function updateStorageUsage(
  userId: string,
  fileSize: number,
  operation: 'add' | 'remove' = 'add'
) {
  const supabase = await createClient()
  
  const storage = await getUserStorage(userId)
  
  const newUsedBytes = operation === 'add' 
    ? storage.used_bytes + fileSize
    : Math.max(0, storage.used_bytes - fileSize)
  
  const newFileCount = operation === 'add'
    ? storage.file_count + 1
    : Math.max(0, storage.file_count - 1)
  
  const { error } = await supabase
    .from('user_storage')
    .update({
      used_bytes: newUsedBytes,
      file_count: newFileCount
    })
    .eq('userId', userId)
  
  if (error) throw error
  
  return {
    usedBytes: newUsedBytes,
    fileCount: newFileCount
  }
}

// 파일 메타데이터 저장
export async function saveFileMetadata(
  userId: string,
  projectId: string | null,
  fileName: string,
  filePath: string,
  fileSize: number,
  fileType: string,
  mimeType: string
) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('file_metadata')
    .insert({
      userId: userId,
      project_id: projectId,
      file_name: fileName,
      file_path: filePath,
      file_size: fileSize,
      file_type: fileType,
      mime_type: mimeType
    })
    .select()
    .single()
  
  if (error) throw error
  return data
}

// 파일 삭제 시 메타데이터 소프트 삭제
export async function deleteFileMetadata(fileId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('file_metadata')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', fileId)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// 프로젝트의 총 용량 계산
export async function getProjectStorageUsage(projectId: string): Promise<number> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('file_metadata')
    .select('file_size')
    .eq('project_id', projectId)
    .is('deleted_at', null)
  
  if (error) throw error
  
  return data.reduce((total, file) => total + file.file_size, 0)
}

// 사용자의 스토리지 통계
export async function getStorageStats(userId: string) {
  const supabase = await createClient()
  
  // 스토리지 정보
  const storage = await getUserStorage(userId)
  
  // 파일 타입별 통계
  const { data: fileStats, error } = await supabase
    .from('file_metadata')
    .select('file_type, file_size')
    .eq('userId', userId)
    .is('deleted_at', null)
  
  if (error) throw error
  
  // 파일 타입별 집계
  const typeStats = fileStats.reduce((acc, file) => {
    const type = file.file_type || 'other'
    if (!acc[type]) {
      acc[type] = { count: 0, size: 0 }
    }
    acc[type].count++
    acc[type].size += file.file_size
    return acc
  }, {} as Record<string, { count: number; size: number }>)
  
  return {
    totalUsed: storage.used_bytes,
    totalMax: storage.max_bytes,
    fileCount: storage.file_count,
    usagePercentage: (storage.used_bytes / storage.max_bytes) * 100,
    typeStats
  }
}

// 사용자 멤버십에 따른 스토리지 제한 확인
export async function checkStorageQuota(userId: string): Promise<{
  canCreate: boolean
  usagePercentage: number
  remainingBytes: number
  warningLevel: 'normal' | 'warning' | 'critical'
  message?: string
}> {
  const storage = await getUserStorage(userId)
  
  const usagePercentage = (storage.used_bytes / storage.max_bytes) * 100
  const remainingBytes = storage.max_bytes - storage.used_bytes
  
  let warningLevel: 'normal' | 'warning' | 'critical' = 'normal'
  let message: string | undefined
  
  if (usagePercentage >= 95) {
    warningLevel = 'critical'
    message = '스토리지 용량이 거의 찼습니다. 파일을 삭제하거나 플랜을 업그레이드하세요.'
  } else if (usagePercentage >= 80) {
    warningLevel = 'warning'  
    message = '스토리지 용량의 80%를 사용했습니다. 플랜 업그레이드를 고려해보세요.'
  }
  
  return {
    canCreate: remainingBytes > 0,
    usagePercentage,
    remainingBytes,
    warningLevel,
    message
  }
}

// 프로젝트 생성 전 용량 체크
export async function canCreateProject(userId: string): Promise<{
  canCreate: boolean
  reason?: string
  upgradeRequired?: boolean
}> {
  const quota = await checkStorageQuota(userId)
  
  if (!quota.canCreate) {
    return {
      canCreate: false,
      reason: '스토리지 용량이 부족합니다.',
      upgradeRequired: true
    }
  }
  
  if (quota.warningLevel === 'critical') {
    return {
      canCreate: false,
      reason: quota.message,
      upgradeRequired: true
    }
  }
  
  return { canCreate: true }
}

// 캐릭터 생성 전 용량 체크 (이미지 업로드 고려)
export async function canCreateCharacter(userId: string, estimatedImageSize?: number): Promise<{
  canCreate: boolean
  reason?: string
  upgradeRequired?: boolean
}> {
  const quota = await checkStorageQuota(userId)
  const imageSize = estimatedImageSize || 2 * 1024 * 1024 // 기본 2MB 추정
  
  if (!quota.canCreate || quota.remainingBytes < imageSize) {
    return {
      canCreate: false,
      reason: '스토리지 용량이 부족합니다.',
      upgradeRequired: true
    }
  }
  
  if (quota.warningLevel === 'critical') {
    return {
      canCreate: false,
      reason: quota.message,
      upgradeRequired: true
    }
  }
  
  return { canCreate: true }
}

// 자동 스토리지 사용량 업데이트 (파일 업로드/삭제 시 자동 호출)
export async function autoUpdateStorageUsage(
  userId: string,
  operation: 'add' | 'remove',
  fileSize: number
): Promise<void> {
  try {
    await updateStorageUsage(userId, fileSize, operation)
    
    // 업데이트 후 할당량 체크
    const quota = await checkStorageQuota(userId)
    
    // 임계점 도달 시 로그 기록 (추후 알림 시스템 연동 가능)
    if (quota.warningLevel !== 'normal') {
      console.log(`⚠️ [Storage] 사용자 ${userId.slice(0, 8)} 스토리지 ${quota.warningLevel}: ${quota.usagePercentage.toFixed(1)}%`)
    }
  } catch (error) {
    console.error('자동 스토리지 업데이트 실패:', error)
    throw error
  }
}