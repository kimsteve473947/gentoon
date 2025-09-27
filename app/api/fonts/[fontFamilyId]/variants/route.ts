import { NextRequest, NextResponse } from 'next/server'

// GET /api/fonts/[fontFamilyId]/variants - 특정 폰트 패밀리의 모든 variants 조회 (임시 구현)
export async function GET(
  request: NextRequest,
  { params }: { params: { fontFamilyId: string } }
) {
  try {
    const { fontFamilyId } = params

    // 임시 데이터 - 실제로는 데이터베이스에서 조회
    const sampleFontFamilies = {
      "2373259b-5218-43c4-9c0c-cc37d635d755": {
        id: "2373259b-5218-43c4-9c0c-cc37d635d755",
        nameKo: "한수원 한울림체",
        nameEn: "Hansuwon Hanullim",
        fontFamily: "HansuwonHanullim",
        category: "decorative",
        provider: "한수원",
        description: "한수원에서 제공하는 공식 폰트",
        variants: [
          {
            id: "variant-1-300",
            weight: 300,
            weightName: "Light",
            style: "normal",
            cssCode: "@import url('https://cdn.jsdelivr.net/gh/hansuwon/hanullim@main/HansuwonHanullim-Light.css');",
            cdnUrl: null,
            usageCount: 0
          },
          {
            id: "variant-1-400",
            weight: 400,
            weightName: "Regular",
            style: "normal",
            cssCode: "@import url('https://cdn.jsdelivr.net/gh/hansuwon/hanullim@main/HansuwonHanullim.css');",
            cdnUrl: null,
            usageCount: 0
          },
          {
            id: "variant-1-700",
            weight: 700,
            weightName: "Bold",
            style: "normal",
            cssCode: "@import url('https://cdn.jsdelivr.net/gh/hansuwon/hanullim@main/HansuwonHanullim-Bold.css');",
            cdnUrl: null,
            usageCount: 0
          }
        ]
      },
      "771baf05-0f71-44d4-ac8c-d9e8070e8d91": {
        id: "771baf05-0f71-44d4-ac8c-d9e8070e8d91",
        nameKo: "모노플렉스WideNerd",
        nameEn: "Monoplex Wide Nerd",
        fontFamily: "MonoplexWideNerd",
        category: "decorative",
        provider: "퍼블릭 도메인",
        description: "개발자를 위한 모노스페이스 폰트",
        variants: [
          {
            id: "variant-2-400",
            weight: 400,
            weightName: "Regular",
            style: "normal",
            cssCode: "@import url('https://fonts.googleapis.com/css2?family=Monoplex+Wide+Nerd:wght@400&display=swap');",
            cdnUrl: null,
            usageCount: 0
          },
          {
            id: "variant-2-700",
            weight: 700,
            weightName: "Bold",
            style: "normal",
            cssCode: "@import url('https://fonts.googleapis.com/css2?family=Monoplex+Wide+Nerd:wght@700&display=swap');",
            cdnUrl: null,
            usageCount: 0
          }
        ]
      },
      "f623ae4d-a384-4617-bdd9-0e1c74879944": {
        id: "f623ae4d-a384-4617-bdd9-0e1c74879944",
        nameKo: "꽃소금체",
        nameEn: "Kkotsogum",
        fontFamily: "Kkotsogum",
        category: "decorative",
        provider: "퍼블릭 도메인",
        description: "귀여운 손글씨 스타일 폰트",
        variants: [
          {
            id: "variant-3-400",
            weight: 400,
            weightName: "Regular",
            style: "normal",
            cssCode: "@import url('https://fonts.googleapis.com/css2?family=Kkotsogum:wght@400&display=swap');",
            cdnUrl: null,
            usageCount: 0
          }
        ]
      }
    }

    const fontFamily = sampleFontFamilies[fontFamilyId as keyof typeof sampleFontFamilies]

    if (!fontFamily) {
      return NextResponse.json(
        { success: false, error: '폰트 패밀리를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        fontFamily: {
          id: fontFamily.id,
          nameKo: fontFamily.nameKo,
          nameEn: fontFamily.nameEn,
          fontFamily: fontFamily.fontFamily,
          category: fontFamily.category,
          provider: fontFamily.provider,
          description: fontFamily.description
        },
        variants: fontFamily.variants
      }
    })

  } catch (error) {
    console.error('폰트 variants 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '폰트 variants를 불러올 수 없습니다.' },
      { status: 500 }
    )
  }
}