import { useState, useEffect } from 'react'
import { FontCategory, FontStyle } from '@prisma/client'

// FontVariant 인터페이스
export interface FontVariant {
  id: string
  weight: number
  weightName: string
  style: FontStyle
  cssCode: string
  cdnUrl: string | null
  usageCount: number
}

// FontFamily 인터페이스 (Canva급 시스템)
export interface FontFamily {
  id: string
  nameKo: string
  nameEn: string
  fontFamily: string
  category: FontCategory
  provider: string
  description: string | null
  totalUsageCount: number
  isFeatured: boolean
  variants: FontVariant[]
}

interface FontFamiliesResponse {
  success: boolean
  data: {
    fonts: FontFamily[]
    pagination: {
      total: number
      limit: number
      offset: number
      hasMore: boolean
    }
    categoryStats: Record<string, number> | null
  }
}

interface FontVariantsResponse {
  success: boolean
  data: {
    fontFamily: Omit<FontFamily, 'variants'>
    variants: FontVariant[]
  }
}

interface UseFontsOptions {
  category?: FontCategory | null
  search?: string
  limit?: number
  enabled?: boolean
  includeVariants?: boolean
}

export function useFonts(options: UseFontsOptions = {}) {
  const {
    category = null,
    search = '',
    limit = 50,
    enabled = true,
    includeVariants = false
  } = options

  const [fontFamilies, setFontFamilies] = useState<FontFamily[]>([])
  const [categoryStats, setCategoryStats] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const fetchFonts = async (reset = true) => {
    if (!enabled) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (category) params.append('category', category)
      if (search) params.append('search', search)
      params.append('limit', limit.toString())
      params.append('includeVariants', includeVariants.toString())
      if (!reset) params.append('offset', fontFamilies.length.toString())

      const response = await fetch(`/api/fonts?${params}`)
      const data: FontFamiliesResponse = await response.json()

      if (!data.success) {
        throw new Error('폰트 데이터를 불러올 수 없습니다.')
      }

      if (reset) {
        setFontFamilies(data.data.fonts)
        setCategoryStats(data.data.categoryStats)
      } else {
        setFontFamilies(prev => [...prev, ...data.data.fonts])
      }

      setHasMore(data.data.pagination.hasMore)

    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
      console.error('폰트 조회 실패:', err)
    } finally {
      setLoading(false)
    }
  }

  // 특정 폰트 패밀리의 모든 variants 조회
  const fetchFontVariants = async (fontFamilyId: string): Promise<FontVariant[]> => {
    try {
      const response = await fetch(`/api/fonts/${fontFamilyId}/variants`)
      const data: FontVariantsResponse = await response.json()

      if (!data.success) {
        throw new Error('폰트 variants를 불러올 수 없습니다.')
      }

      return data.data.variants
    } catch (err) {
      console.error('폰트 variants 조회 실패:', err)
      return []
    }
  }

  // 폰트 variant 사용량 증가
  const incrementUsage = async (variantId: string, fontFamilyId?: string) => {
    try {
      await fetch('/api/fonts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId, fontFamilyId })
      })

      // 로컬 상태에서도 사용량 증가
      setFontFamilies(prev => prev.map(family => {
        if (fontFamilyId && family.id === fontFamilyId) {
          return {
            ...family,
            totalUsageCount: family.totalUsageCount + 1,
            variants: family.variants.map(variant =>
              variant.id === variantId
                ? { ...variant, usageCount: variant.usageCount + 1 }
                : variant
            )
          }
        }
        return family
      }))
    } catch (err) {
      console.error('폰트 사용량 업데이트 실패:', err)
    }
  }

  useEffect(() => {
    fetchFonts(true)
  }, [category, search, enabled, includeVariants])

  return {
    fontFamilies,
    fonts: fontFamilies, // 하위 호환성을 위한 alias
    categoryStats,
    loading,
    error,
    hasMore,
    fetchMore: () => fetchFonts(false),
    refetch: () => fetchFonts(true),
    fetchFontVariants,
    incrementUsage
  }
}

// 카테고리 한글명 매핑
export const CATEGORY_LABELS = {
  gothic: '고딕체',
  serif: '명조체',
  handwriting: '손글씨체',
  decorative: '장식체',
  monospace: '코딩체'
} as const

// Weight 한글명 매핑
export const WEIGHT_LABELS = {
  100: 'Thin',
  200: 'ExtraLight',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black'
} as const