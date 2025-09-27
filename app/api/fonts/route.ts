import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { FontCategory } from '@prisma/client'

// GET /api/fonts - 폰트 패밀리 목록 조회 (Canva급 시스템)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as FontCategory | null
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const includeVariants = searchParams.get('includeVariants') === 'true'

    // 기본 쿼리 조건
    const whereCondition: any = {
      isActive: true
    }

    // 카테고리 필터
    if (category && Object.values(FontCategory).includes(category)) {
      whereCondition.category = category
    }

    // 검색 필터
    if (search) {
      whereCondition.OR = [
        { nameKo: { contains: search, mode: 'insensitive' } },
        { nameEn: { contains: search, mode: 'insensitive' } },
        { provider: { contains: search, mode: 'insensitive' } }
      ]
    }

    // 임시 해결책: 하드코딩된 샘플 데이터 (개발 단계)
    const sampleFontFamilies = [
      {
        id: "2373259b-5218-43c4-9c0c-cc37d635d755",
        nameKo: "한수원 한울림체",
        nameEn: "Hansuwon Hanullim",
        fontFamily: "HansuwonHanullim",
        category: "decorative",
        provider: "한수원",
        description: "한수원에서 제공하는 공식 폰트",
        totalUsageCount: 0,
        isFeatured: false,
        variants: [{
          id: "variant-1",
          weight: 400,
          weightName: "Regular",
          style: "normal",
          cssCode: "@import url('https://cdn.jsdelivr.net/gh/hansuwon/hanullim@main/HansuwonHanullim.css');",
          cdnUrl: null,
          usageCount: 0
        }]
      },
      {
        id: "771baf05-0f71-44d4-ac8c-d9e8070e8d91",
        nameKo: "모노플렉스WideNerd",
        nameEn: "Monoplex Wide Nerd",
        fontFamily: "MonoplexWideNerd",
        category: "decorative",
        provider: "퍼블릭 도메인",
        description: "개발자를 위한 모노스페이스 폰트",
        totalUsageCount: 0,
        isFeatured: false,
        variants: [{
          id: "variant-2",
          weight: 400,
          weightName: "Regular",
          style: "normal",
          cssCode: "@import url('https://fonts.googleapis.com/css2?family=Monoplex+Wide+Nerd:wght@400&display=swap');",
          cdnUrl: null,
          usageCount: 0
        }]
      },
      {
        id: "f623ae4d-a384-4617-bdd9-0e1c74879944",
        nameKo: "꽃소금체",
        nameEn: "Kkotsogum",
        fontFamily: "Kkotsogum",
        category: "decorative",
        provider: "퍼블릭 도메인",
        description: "귀여운 손글씨 스타일 폰트",
        totalUsageCount: 0,
        isFeatured: false,
        variants: [{
          id: "variant-3",
          weight: 400,
          weightName: "Regular",
          style: "normal",
          cssCode: "@import url('https://fonts.googleapis.com/css2?family=Kkotsogum:wght@400&display=swap');",
          cdnUrl: null,
          usageCount: 0
        }]
      }
    ]

    const fontFamilies = sampleFontFamilies.slice(offset, offset + limit)
    const totalCount = sampleFontFamilies.length

    // 카테고리별 통계 (첫 페이지일 때만) - 임시 데이터
    let categoryStats = null
    if (offset === 0) {
      categoryStats = {
        decorative: 3,
        gothic: 0,
        serif: 0,
        handwriting: 0,
        monospace: 0
      }
    }

    // 응답 데이터 포맷팅
    const fonts = fontFamilies.map(family => ({
      id: family.id,
      nameKo: family.nameKo,
      nameEn: family.nameEn,
      fontFamily: family.fontFamily,
      category: family.category,
      provider: family.provider,
      description: family.description,
      totalUsageCount: family.totalUsageCount,
      isFeatured: family.isFeatured,
      variants: family.variants.map(variant => ({
        id: variant.id,
        weight: variant.weight,
        weightName: variant.weightName,
        style: variant.style,
        cssCode: variant.cssCode,
        cdnUrl: variant.cdnUrl,
        usageCount: variant.usageCount
      }))
    }))

    return NextResponse.json({
      success: true,
      data: {
        fonts,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount
        },
        categoryStats
      }
    })

  } catch (error) {
    console.error('폰트 패밀리 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '폰트 목록을 불러올 수 없습니다.' },
      { status: 500 }
    )
  }
}

// POST /api/fonts - 폰트 variant 사용량 증가 (임시 구현)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { variantId, fontFamilyId } = body

    if (!variantId) {
      return NextResponse.json(
        { success: false, error: 'Variant ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 임시: 데이터베이스 업데이트 없이 성공 응답만 반환
    console.log(`Font usage tracked: variant=${variantId}, family=${fontFamilyId}`)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('폰트 사용량 업데이트 실패:', error)
    return NextResponse.json(
      { success: false, error: '폰트 사용량을 업데이트할 수 없습니다.' },
      { status: 500 }
    )
  }
}