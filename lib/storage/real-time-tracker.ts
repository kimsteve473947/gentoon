import { createClient } from '@/lib/supabase/server'

// 🚀 Canva/Miro 스타일 실시간 DB 사용량 추적 시스템

// 이미지 크기 추정 (실제 파일이 없을 때)
const ESTIMATED_SIZES = {
  CHARACTER_REFERENCE: 1.5 * 1024 * 1024, // 1.5MB per reference image
  CHARACTER_RATIO: 1.2 * 1024 * 1024,     // 1.2MB per ratio image
  CHARACTER_THUMBNAIL: 0.5 * 1024 * 1024, // 0.5MB per thumbnail
  PROJECT_THUMBNAIL: 0.3 * 1024 * 1024,   // 0.3MB per project thumbnail
  GENERATED_IMAGE: 2 * 1024 * 1024,       // 2MB per generated image
} as const

// 📊 사용자별 DB 사용량 실시간 추적 클래스
export class RealTimeStorageTracker {
  private static instance: RealTimeStorageTracker
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new RealTimeStorageTracker()
    }
    return this.instance
  }

  // 🎯 캐릭터 생성 시 사용량 업데이트
  async onCharacterCreate(userId: string, characterData: {
    referenceImages?: string[]
    ratioImages?: Record<string, string[]>
    thumbnailUrl?: string
  }) {
    try {
      console.log(`📊 [Storage] 캐릭터 생성 - 사용자 ${userId.slice(0, 8)}...`)
      
      const imageCount = this.calculateCharacterImages(characterData)
      const estimatedBytes = this.estimateCharacterSize(characterData)
      
      await this.updateUserStorage(userId, {
        bytesChange: estimatedBytes,
        fileCountChange: imageCount,
        operation: 'add'
      })

      console.log(`✅ [Storage] 캐릭터 생성 완료: +${imageCount}개 이미지, +${this.formatBytes(estimatedBytes)}`)
    } catch (error) {
      console.error('❌ [Storage] 캐릭터 생성 추적 실패:', error)
    }
  }

  // 🎯 캐릭터 삭제 시 사용량 업데이트
  async onCharacterDelete(userId: string, characterData: {
    referenceImages?: string[]
    ratioImages?: Record<string, string[]>
    thumbnailUrl?: string
  }) {
    try {
      console.log(`📊 [Storage] 캐릭터 삭제 - 사용자 ${userId.slice(0, 8)}...`)
      
      const imageCount = this.calculateCharacterImages(characterData)
      const estimatedBytes = this.estimateCharacterSize(characterData)
      
      await this.updateUserStorage(userId, {
        bytesChange: estimatedBytes,
        fileCountChange: imageCount,
        operation: 'remove'
      })

      console.log(`✅ [Storage] 캐릭터 삭제 완료: -${imageCount}개 이미지, -${this.formatBytes(estimatedBytes)}`)
    } catch (error) {
      console.error('❌ [Storage] 캐릭터 삭제 추적 실패:', error)
    }
  }

  // 🎯 프로젝트 생성 시 사용량 업데이트
  async onProjectCreate(userId: string, projectData: {
    thumbnailUrl?: string
  }) {
    try {
      console.log(`📊 [Storage] 프로젝트 생성 - 사용자 ${userId.slice(0, 8)}...`)
      
      const imageCount = projectData.thumbnailUrl ? 1 : 0
      const estimatedBytes = imageCount * ESTIMATED_SIZES.PROJECT_THUMBNAIL
      
      await this.updateUserStorage(userId, {
        bytesChange: estimatedBytes,
        fileCountChange: imageCount,
        operation: 'add'
      })

      console.log(`✅ [Storage] 프로젝트 생성 완료: +${imageCount}개 이미지, +${this.formatBytes(estimatedBytes)}`)
    } catch (error) {
      console.error('❌ [Storage] 프로젝트 생성 추적 실패:', error)
    }
  }

  // 🎯 프로젝트 삭제 시 사용량 업데이트
  async onProjectDelete(userId: string, projectData: {
    thumbnailUrl?: string
  }) {
    try {
      console.log(`📊 [Storage] 프로젝트 삭제 - 사용자 ${userId.slice(0, 8)}...`)
      
      const imageCount = projectData.thumbnailUrl ? 1 : 0
      const estimatedBytes = imageCount * ESTIMATED_SIZES.PROJECT_THUMBNAIL
      
      await this.updateUserStorage(userId, {
        bytesChange: estimatedBytes,
        fileCountChange: imageCount,
        operation: 'remove'
      })

      console.log(`✅ [Storage] 프로젝트 삭제 완료: -${imageCount}개 이미지, -${this.formatBytes(estimatedBytes)}`)
    } catch (error) {
      console.error('❌ [Storage] 프로젝트 삭제 추적 실패:', error)
    }
  }

  // 🎯 이미지 생성 시 사용량 업데이트
  async onImageGenerate(userId: string, imageData: {
    imageUrl?: string
    estimatedSize?: number
  }) {
    try {
      console.log(`📊 [Storage] 이미지 생성 - 사용자 ${userId.slice(0, 8)}...`)
      
      if (!imageData.imageUrl) return

      const estimatedBytes = imageData.estimatedSize || ESTIMATED_SIZES.GENERATED_IMAGE
      
      await this.updateUserStorage(userId, {
        bytesChange: estimatedBytes,
        fileCountChange: 1,
        operation: 'add'
      })

      console.log(`✅ [Storage] 이미지 생성 완료: +1개 이미지, +${this.formatBytes(estimatedBytes)}`)
    } catch (error) {
      console.error('❌ [Storage] 이미지 생성 추적 실패:', error)
    }
  }

  // 🎯 이미지 삭제 시 사용량 업데이트
  async onImageDelete(userId: string, imageData: {
    estimatedSize?: number
  }) {
    try {
      console.log(`📊 [Storage] 이미지 삭제 - 사용자 ${userId.slice(0, 8)}...`)
      
      const estimatedBytes = imageData.estimatedSize || ESTIMATED_SIZES.GENERATED_IMAGE
      
      await this.updateUserStorage(userId, {
        bytesChange: estimatedBytes,
        fileCountChange: 1,
        operation: 'remove'
      })

      console.log(`✅ [Storage] 이미지 삭제 완료: -1개 이미지, -${this.formatBytes(estimatedBytes)}`)
    } catch (error) {
      console.error('❌ [Storage] 이미지 삭제 추적 실패:', error)
    }
  }

  // 🔧 사용자 저장소 업데이트 (원자적 연산)
  private async updateUserStorage(userId: string, change: {
    bytesChange: number
    fileCountChange: number
    operation: 'add' | 'remove'
  }) {
    const supabase = await createClient()
    
    // 현재 사용량 조회
    const { data: currentStorage } = await supabase
      .from('user_storage')
      .select('used_bytes, file_count')
      .eq('userId', userId)
      .single()

    if (!currentStorage) {
      // 사용자 스토리지 레코드가 없으면 생성
      await supabase
        .from('user_storage')
        .insert({
          userId: userId,
          used_bytes: change.operation === 'add' ? change.bytesChange : 0,
          file_count: change.operation === 'add' ? change.fileCountChange : 0,
          max_bytes: 1024 * 1024 * 1024 // 기본 1GB
        })
      return
    }

    // 새 사용량 계산
    const newUsedBytes = change.operation === 'add'
      ? currentStorage.used_bytes + change.bytesChange
      : Math.max(0, currentStorage.used_bytes - change.bytesChange)

    const newFileCount = change.operation === 'add'
      ? currentStorage.file_count + change.fileCountChange
      : Math.max(0, currentStorage.file_count - change.fileCountChange)

    // 업데이트 (원자적 연산)
    await supabase
      .from('user_storage')
      .update({
        used_bytes: newUsedBytes,
        file_count: newFileCount,
        updated_at: new Date().toISOString()
      })
      .eq('userId', userId)
  }

  // 🧮 캐릭터 이미지 수 계산
  private calculateCharacterImages(characterData: {
    referenceImages?: string[]
    ratioImages?: Record<string, string[]>
    thumbnailUrl?: string
  }): number {
    let count = 0

    // 레퍼런스 이미지
    if (characterData.referenceImages) {
      count += characterData.referenceImages.length
    }

    // 비율별 이미지
    if (characterData.ratioImages) {
      for (const images of Object.values(characterData.ratioImages)) {
        count += Array.isArray(images) ? images.length : 0
      }
    }

    // 썸네일
    if (characterData.thumbnailUrl) {
      count += 1
    }

    return count
  }

  // 🧮 캐릭터 크기 추정
  private estimateCharacterSize(characterData: {
    referenceImages?: string[]
    ratioImages?: Record<string, string[]>
    thumbnailUrl?: string
  }): number {
    let size = 0

    // 레퍼런스 이미지
    if (characterData.referenceImages) {
      size += characterData.referenceImages.length * ESTIMATED_SIZES.CHARACTER_REFERENCE
    }

    // 비율별 이미지
    if (characterData.ratioImages) {
      for (const images of Object.values(characterData.ratioImages)) {
        const count = Array.isArray(images) ? images.length : 0
        size += count * ESTIMATED_SIZES.CHARACTER_RATIO
      }
    }

    // 썸네일
    if (characterData.thumbnailUrl) {
      size += ESTIMATED_SIZES.CHARACTER_THUMBNAIL
    }

    return size
  }

  // 🛠️ 바이트 포맷팅
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // 🔄 전체 사용자 스토리지 재계산 (마이그레이션/복구용)
  async recalculateUserStorage(userId: string) {
    try {
      console.log(`🔄 [Storage] 사용자 ${userId.slice(0, 8)}... 전체 사용량 재계산 시작`)
      
      const supabase = await createClient()

      // 모든 데이터 조회
      const [projectsResult, charactersResult, generationsResult] = await Promise.all([
        supabase.from('project').select('thumbnailUrl').eq('userId', userId).is('deletedAt', null),
        supabase.from('character').select('referenceImages, ratioImages, thumbnailUrl').eq('userId', userId),
        supabase.from('generation').select('imageUrl').eq('userId', userId)
      ])

      const projects = projectsResult.data || []
      const characters = charactersResult.data || []
      const generations = generationsResult.data || []

      // 총 사용량 계산
      let totalBytes = 0
      let totalFiles = 0

      // 프로젝트 썸네일
      for (const project of projects) {
        if (project.thumbnailUrl) {
          totalBytes += ESTIMATED_SIZES.PROJECT_THUMBNAIL
          totalFiles += 1
        }
      }

      // 캐릭터 데이터
      for (const character of characters) {
        const characterSize = this.estimateCharacterSize(character)
        const characterFiles = this.calculateCharacterImages(character)
        totalBytes += characterSize
        totalFiles += characterFiles
      }

      // 생성된 이미지
      for (const generation of generations) {
        if (generation.imageUrl) {
          totalBytes += ESTIMATED_SIZES.GENERATED_IMAGE
          totalFiles += 1
        }
      }

      // 스토리지 업데이트 (기존 레코드 확인 후 업데이트 또는 생성)
      const { data: existingStorage } = await supabase
        .from('user_storage')
        .select('id')
        .eq('userId', userId)
        .single()

      if (existingStorage) {
        // 기존 레코드 업데이트
        const { error: updateError } = await supabase
          .from('user_storage')
          .update({
            used_bytes: Math.round(totalBytes),
            file_count: Math.round(totalFiles),
            updated_at: new Date().toISOString()
          })
          .eq('userId', userId)

        if (updateError) {
          console.error('❌ [Storage] DB 업데이트 실패:', updateError)
          throw updateError
        }
      } else {
        // 새 레코드 생성
        const { error: insertError } = await supabase
          .from('user_storage')
          .insert({
            userId: userId,
            used_bytes: Math.round(totalBytes),
            file_count: Math.round(totalFiles),
            max_bytes: 1024 * 1024 * 1024, // 기본 1GB
          })

        if (insertError) {
          console.error('❌ [Storage] DB 생성 실패:', insertError)
          throw insertError
        }
      }

      console.log(`✅ [Storage] 재계산 완료: ${totalFiles}개 파일, ${this.formatBytes(totalBytes)}`)
      
      return { totalBytes, totalFiles }
    } catch (error) {
      console.error('❌ [Storage] 재계산 실패:', error)
      throw error
    }
  }
}

// 🚀 싱글톤 인스턴스 export
export const storageTracker = RealTimeStorageTracker.getInstance()