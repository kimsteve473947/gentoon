#!/usr/bin/env npx tsx
/**
 * 데이터베이스의 WebFont 데이터를 STUDIO_FONTS 구조로 변환하는 스크립트
 * - 데이터베이스에서 폰트 데이터 조회
 * - 같은 fontFamily끼리 그룹화하여 weights 배열 생성
 * - noonnu-fonts.ts 파일에 추가
 */

import { PrismaClient, FontCategory } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface StudioFont {
  id: string
  nameKo: string
  nameEn: string
  fontFamily: string
  category: FontCategory
  provider: string
  cssCode: string
  weights: Array<{
    weight: number
    name: string
    cssCode: string
  }>
}

// weight 숫자를 이름으로 매핑
function getWeightName(weight: number): string {
  const weightMap: Record<number, string> = {
    100: 'Thin',
    200: 'ExtraLight',
    300: 'Light',
    400: 'Regular',
    500: 'Medium',
    600: 'SemiBold',
    700: 'Bold',
    800: 'ExtraBold',
    900: 'Black',
  }
  return weightMap[weight] || `${weight}`
}

async function loadFontsFromDatabase(): Promise<StudioFont[]> {
  console.log('📂 데이터베이스에서 폰트 데이터 로드 중...')
  
  const fontFamilies = await prisma.fontFamily.findMany({
    include: {
      variants: true
    },
    orderBy: {
      nameKo: 'asc'
    }
  })
  
  console.log(`✅ ${fontFamilies.length}개 폰트 패밀리 로드 완료`)
  
  // STUDIO_FONTS 구조로 변환
  const studioFonts: StudioFont[] = []
  
  fontFamilies.forEach(family => {
    // weights 배열 생성
    const weights = family.variants.map(variant => ({
      weight: variant.weight,
      name: getWeightName(variant.weight),
      cssCode: variant.cssCode || ''
    }))
    
    // weight 정렬
    const sortedWeights = weights.sort((a, b) => a.weight - b.weight)
    
    studioFonts.push({
      id: family.nameEn?.toLowerCase().replace(/[^a-z0-9]/g, '-') || `font-${Date.now()}`,
      nameKo: family.nameKo,
      nameEn: family.nameEn || family.nameKo,
      fontFamily: family.fontFamily,
      category: family.category,
      provider: family.provider,
      cssCode: family.cssCode || '',
      weights: sortedWeights
    })
  })
  
  console.log(`🎨 ${studioFonts.length}개 STUDIO_FONTS 생성`)
  
  return studioFonts.sort((a, b) => a.nameKo.localeCompare(b.nameKo))
}

function generateStudioFontsCode(studioFonts: StudioFont[]): string {
  const fontsCode = studioFonts.map(font => {
    const weightsCode = font.weights.map(weight => 
      `      { weight: ${weight.weight}, name: '${weight.name}', cssCode: \`${weight.cssCode}\` }`
    ).join(',\n')
    
    return `  {
    id: '${font.id}',
    nameKo: '${font.nameKo}',
    nameEn: '${font.nameEn}',
    fontFamily: '${font.fontFamily}',
    category: '${font.category}' as const,
    provider: '${font.provider}',
    cssCode: \`${font.cssCode}\`,
    weights: [
${weightsCode}
    ]
  }`
  }).join(',\n')
  
  return `/**
 * 🎨 눈누(noonnu.cc) 사이트에서 수집한 저작권 문제없는 웹폰트들
 * - 임베딩 권한: "사용 가능"만 선별
 * - 상업적 이용 가능
 * - 웹사이트 및 프로그램 서버 내 폰트 탑재 허용
 * 
 * 자동 생성됨: ${new Date().toLocaleString('ko-KR')}
 */

export interface FontWeight {
  weight: number;
  name: string;
  cssCode: string;
}

export interface NoonnnuFont {
  id: string;
  nameKo: string;
  nameEn: string;
  fontFamily: string;
  category: 'gothic' | 'serif' | 'handwriting' | 'decorative' | 'monospace';
  cssCode: string;
  provider: string;
  originalUrl?: string;
  description?: string;
  weights?: FontWeight[];
}

// 데이터베이스에서 자동 생성된 폰트 목록
export const NOONNU_FONTS: NoonnnuFont[] = [
${fontsCode}
];

// 수집된 폰트들
export const STUDIO_FONTS = [
  // Google Fonts (기존 유지)
  { 
    id: 'noto-sans-kr',
    nameKo: 'Noto Sans KR',
    nameEn: 'Noto Sans KR',
    fontFamily: '"Noto Sans KR", sans-serif',
    category: 'gothic' as const,
    provider: 'Google Fonts',
    cssCode: '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@100;300;400;500;700;900&display=swap");',
    weights: [
      { weight: 100, name: 'Thin', cssCode: '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@100&display=swap");' },
      { weight: 300, name: 'Light', cssCode: '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300&display=swap");' },
      { weight: 400, name: 'Regular', cssCode: '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400&display=swap");' },
      { weight: 500, name: 'Medium', cssCode: '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500&display=swap");' },
      { weight: 700, name: 'Bold', cssCode: '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&display=swap");' },
      { weight: 900, name: 'Black', cssCode: '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@900&display=swap");' }
    ]
  },
  { 
    id: 'noto-serif-kr',
    nameKo: 'Noto Serif KR',
    nameEn: 'Noto Serif KR',
    fontFamily: '"Noto Serif KR", serif',
    category: 'serif' as const,
    provider: 'Google Fonts',
    cssCode: '@import url("https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@200;300;400;500;600;700;900&display=swap");',
    weights: [
      { weight: 200, name: 'ExtraLight', cssCode: '@import url("https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@200&display=swap");' },
      { weight: 300, name: 'Light', cssCode: '@import url("https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300&display=swap");' },
      { weight: 400, name: 'Regular', cssCode: '@import url("https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400&display=swap");' },
      { weight: 500, name: 'Medium', cssCode: '@import url("https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500&display=swap");' },
      { weight: 600, name: 'SemiBold', cssCode: '@import url("https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@600&display=swap");' },
      { weight: 700, name: 'Bold', cssCode: '@import url("https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@700&display=swap");' },
      { weight: 900, name: 'Black', cssCode: '@import url("https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@900&display=swap");' }
    ]
  },
  // 눈누 폰트 추가
  ...NOONNU_FONTS
];
`
}

async function updateNoonenuFontsFile(studioFonts: StudioFont[]) {
  const fontsFilePath = path.join(process.cwd(), 'lib/fonts/noonnu-fonts.ts')
  
  console.log(`📝 ${fontsFilePath} 파일 업데이트 중...`)
  
  // 백업 생성
  const backupPath = `${fontsFilePath}.backup.${Date.now()}`
  if (fs.existsSync(fontsFilePath)) {
    fs.copyFileSync(fontsFilePath, backupPath)
    console.log(`💾 기존 파일 백업: ${backupPath}`)
  }
  
  // 새로운 코드 생성
  const newCode = generateStudioFontsCode(studioFonts)
  
  // 파일 쓰기
  fs.writeFileSync(fontsFilePath, newCode, 'utf8')
  
  console.log(`✅ ${fontsFilePath} 업데이트 완료`)
  console.log(`📊 총 ${studioFonts.length}개 폰트 패밀리 추가`)
  
  // 카테고리별 통계
  const categoryStats = studioFonts.reduce((acc, font) => {
    acc[font.category] = (acc[font.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  console.log('\\n📊 카테고리별 통계:')
  Object.entries(categoryStats).forEach(([category, count]) => {
    console.log(`  - ${category}: ${count}개`)
  })
}

async function main() {
  try {
    console.log('🎨 STUDIO_FONTS 생성 스크립트 시작')
    console.log('=' + '='.repeat(50))
    
    // 1. 데이터베이스에서 폰트 로드
    const studioFonts = await loadFontsFromDatabase()
    
    // 2. noonnu-fonts.ts 파일 업데이트
    await updateNoonenuFontsFile(studioFonts)
    
    console.log('\\n🎉 STUDIO_FONTS 생성 완료!')
    
  } catch (error) {
    console.error('❌ 스크립트 실행 중 오류 발생:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// 스크립트 실행
if (require.main === module) {
  main()
}