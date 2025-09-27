#!/usr/bin/env npx tsx
/**
 * 엑셀 파일에서 직접 STUDIO_FONTS 구조로 변환하는 스크립트
 * - 엑셀에서 폰트 데이터 읽기
 * - 같은 fontFamily끼리 그룹화하여 weights 배열 생성
 * - noonnu-fonts.ts 파일에 추가
 */

import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

interface ExcelFont {
  font_id: number
  url: string
  name_ko: string
  name_en: string
  provider: string
  category: string
  license_embedding: string
  embedding_scope: string
  license_print: string
  license_website: string
  license_packaging: string
  license_video: string
  license_bi_ci: string
  license_ofl: string
  license_modification: string
  license_distribution: string
  license_commercial: string
  css_code: string
  cdn_url: string
  description: string
  download_count: number
  view_count: number
  created_date: string
  font_format: string
  font_weight: string
  is_commercial_safe: boolean
}

interface StudioFont {
  id: string
  nameKo: string
  nameEn: string
  fontFamily: string
  category: 'gothic' | 'serif' | 'handwriting' | 'decorative' | 'monospace'
  provider: string
  cssCode: string
  weights: Array<{
    weight: number
    name: string
    cssCode: string
  }>
}

// 카테고리 매핑
const CATEGORY_MAPPING: Record<string, 'gothic' | 'serif' | 'handwriting' | 'decorative' | 'monospace'> = {
  'gothic': 'gothic',
  'serif': 'serif',
  'handwriting': 'handwriting',
  'decorative': 'decorative',
  'monospace': 'monospace',
  '고딕': 'gothic',
  '명조': 'serif',
  '바탕': 'serif',
  '손글씨': 'handwriting',
  '장식': 'decorative',
  '코딩': 'monospace',
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


function mapCategoryToEnum(category: string): 'gothic' | 'serif' | 'handwriting' | 'decorative' | 'monospace' {
  const normalizedCategory = category?.toLowerCase()?.trim()
  
  // 직접 매핑 시도
  if (CATEGORY_MAPPING[normalizedCategory]) {
    return CATEGORY_MAPPING[normalizedCategory]
  }
  
  // 부분 매칭 시도
  if (normalizedCategory?.includes('gothic') || normalizedCategory?.includes('고딕')) {
    return 'gothic'
  }
  if (normalizedCategory?.includes('serif') || normalizedCategory?.includes('명조') || normalizedCategory?.includes('바탕')) {
    return 'serif'
  }
  if (normalizedCategory?.includes('hand') || normalizedCategory?.includes('손글씨')) {
    return 'handwriting'
  }
  if (normalizedCategory?.includes('decorative') || normalizedCategory?.includes('장식')) {
    return 'decorative'
  }
  if (normalizedCategory?.includes('mono') || normalizedCategory?.includes('코딩')) {
    return 'monospace'
  }
  
  // 기본값: decorative
  console.warn(`⚠️  알 수 없는 카테고리 "${category}", decorative로 분류`)
  return 'decorative'
}

function extractFontFamilyFromCSS(cssCode: string, fontNameKo: string): string {
  try {
    // CSS에서 font-family 값 추출 (이스케이프된 문자도 처리)
    const cleanCss = cssCode.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n')
    const fontFamilyMatch = cleanCss.match(/font-family:\s*['"']([^'"]+)['"']/i)
    if (fontFamilyMatch) {
      return fontFamilyMatch[1]
    }
    
    // font-family가 따옴표 없이 정의된 경우
    const fontFamilyMatch2 = cleanCss.match(/font-family:\s*([^;]+);/i)
    if (fontFamilyMatch2) {
      return fontFamilyMatch2[1].trim()
    }
    
    // CSS에서 추출 실패 시 한국어 이름으로 패밀리명 생성
    return fontNameKo || 'UnknownFont'
  } catch (error) {
    console.warn(`CSS에서 font-family 추출 실패 (${fontNameKo}):`, error)
    return fontNameKo || 'UnknownFont'
  }
}

function parseWeight(weightString: string): number {
  // 문자열에서 숫자 추출
  const match = weightString?.match(/\\d+/)
  if (match) {
    return parseInt(match[0])
  }
  
  // 이름으로 매핑
  const normalizedWeight = weightString?.toLowerCase()?.trim()
  const weightNameMap: Record<string, number> = {
    'thin': 100,
    'extralight': 200,
    'light': 300,
    'regular': 400,
    'normal': 400,
    'medium': 500,
    'semibold': 600,
    'bold': 700,
    'extrabold': 800,
    'black': 900,
  }
  
  return weightNameMap[normalizedWeight] || 400
}

// CSS에서 여러 @font-face를 분리하여 각각의 weight를 추출
function parseMultipleFontFaces(cssCode: string): Array<{weight: number, cssCode: string}> {
  const fontFaces: Array<{weight: number, cssCode: string}> = []
  
  // @font-face 블록들을 분리
  const fontFaceBlocks = cssCode.split(/@font-face\s*{/).filter(block => block.trim())
  
  fontFaceBlocks.forEach(block => {
    const completeFontFace = '@font-face {' + block
    
    // font-weight 값 추출
    const weightMatch = completeFontFace.match(/font-weight:\s*(\d+|normal|bold)/i)
    let weight = 400
    
    if (weightMatch) {
      const weightValue = weightMatch[1].toLowerCase()
      if (weightValue === 'normal') {
        weight = 400
      } else if (weightValue === 'bold') {
        weight = 700
      } else {
        weight = parseInt(weightValue) || 400
      }
    }
    
    fontFaces.push({
      weight,
      cssCode: completeFontFace
    })
  })
  
  return fontFaces.length > 0 ? fontFaces : [{weight: 400, cssCode: cssCode}]
}

async function loadExcelData(filePath: string): Promise<ExcelFont[]> {
  console.log(`📂 엑셀 파일 로드 중: ${filePath}`)
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`엑셀 파일을 찾을 수 없습니다: ${filePath}`)
  }
  
  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(worksheet) as ExcelFont[]
  
  // 상업적 안전 폰트만 필터링
  const commercialSafeFonts = data.filter(font => font.is_commercial_safe === true)
  
  console.log(`✅ 총 ${data.length}개 폰트 중 상업적 안전 폰트 ${commercialSafeFonts.length}개 로드`)
  
  return commercialSafeFonts
}

function convertToStudioFonts(excelFonts: ExcelFont[]): StudioFont[] {
  console.log('🔄 STUDIO_FONTS 구조로 변환 중...')
  
  // fontFamily별로 그룹화
  const fontFamilyGroups = new Map<string, ExcelFont[]>()
  
  excelFonts.forEach(font => {
    const fontFamily = extractFontFamilyFromCSS(font.css_code || '', font.name_ko)
    if (!fontFamilyGroups.has(fontFamily)) {
      fontFamilyGroups.set(fontFamily, [])
    }
    fontFamilyGroups.get(fontFamily)!.push(font)
  })
  
  console.log(`📦 ${fontFamilyGroups.size}개 폰트 패밀리로 그룹화`)
  
  // STUDIO_FONTS 구조로 변환
  const studioFonts: StudioFont[] = []
  const usedIds = new Set<string>() // 중복 ID 방지용
  
  fontFamilyGroups.forEach((fonts, fontFamily) => {
    // 대표 폰트 (첫 번째 폰트)
    const representativeFont = fonts[0]
    
    // weights 배열 생성 - CSS에서 여러 @font-face 파싱
    const allWeights: Array<{weight: number, name: string, cssCode: string}> = []
    
    fonts.forEach(font => {
      // CSS에서 여러 @font-face 파싱
      const parsedFaces = parseMultipleFontFaces(font.css_code || '')
      
      parsedFaces.forEach(face => {
        allWeights.push({
          weight: face.weight,
          name: getWeightName(face.weight),
          cssCode: face.cssCode
        })
      })
    })
    
    // 중복 weight 제거 및 정렬
    const uniqueWeights = allWeights
      .filter((weight, index, arr) => 
        arr.findIndex(w => w.weight === weight.weight) === index
      )
      .sort((a, b) => a.weight - b.weight)
    
    // 고유 ID 생성 (중복 방지)
    let baseId = representativeFont.name_en?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 
                 representativeFont.name_ko?.toLowerCase().replace(/[^a-z0-9가-힣]/g, '-') || 
                 `font-${Date.now()}`
    
    let uniqueId = baseId
    let counter = 1
    while (usedIds.has(uniqueId)) {
      uniqueId = `${baseId}-${counter}`
      counter++
    }
    usedIds.add(uniqueId)
    
    // CSS에서 실제 font-family 이름 추출
    const actualFontFamily = extractFontFamilyFromCSS(representativeFont.css_code || '', representativeFont.name_ko || '');
    
    studioFonts.push({
      id: uniqueId,
      nameKo: representativeFont.name_ko || '알 수 없는 폰트',
      nameEn: representativeFont.name_en || representativeFont.name_ko || 'Unknown Font',
      fontFamily: actualFontFamily,
      category: mapCategoryToEnum(representativeFont.category),
      provider: representativeFont.provider || '알 수 없는 제공자',
      cssCode: representativeFont.css_code || '',
      weights: uniqueWeights
    })
  })
  
  console.log(`🎨 ${studioFonts.length}개 STUDIO_FONTS 생성`)
  
  return studioFonts.sort((a, b) => a.nameKo.localeCompare(b.nameKo))
}

function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/`/g, '\\`')
}

function generateStudioFontsCode(studioFonts: StudioFont[]): string {
  const fontsCode = studioFonts.map(font => {
    const weightsCode = font.weights.map(weight => 
      `      { weight: ${weight.weight}, name: '${escapeString(weight.name)}', cssCode: \`${escapeString(weight.cssCode)}\` }`
    ).join(',\n')
    
    return `  {
    id: '${escapeString(font.id)}',
    nameKo: '${escapeString(font.nameKo)}',
    nameEn: '${escapeString(font.nameEn)}',
    fontFamily: '${escapeString(font.fontFamily)}',
    category: '${font.category}' as const,
    provider: '${escapeString(font.provider)}',
    cssCode: \`${escapeString(font.cssCode)}\`,
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

// 엑셀에서 자동 생성된 폰트 목록
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
  
  // weight별 통계
  const weightStats = studioFonts.reduce((acc, font) => {
    const weightCount = font.weights.length
    acc[weightCount] = (acc[weightCount] || 0) + 1
    return acc
  }, {} as Record<number, number>)
  
  console.log('\\n📊 Weight 개수별 통계:')
  Object.entries(weightStats).forEach(([count, families]) => {
    console.log(`  - ${count}개 weight: ${families}개 패밀리`)
  })
}

async function main() {
  try {
    console.log('🎨 엑셀 기반 STUDIO_FONTS 생성 스크립트 시작')
    console.log('=' + '='.repeat(50))
    
    const excelPath = '/Users/gimjunghwi/Desktop/크롤링/noonnu_fonts_commercial_20250926_230422.xlsx'
    
    // 1. 엑셀 데이터 로드
    const excelFonts = await loadExcelData(excelPath)
    
    // 2. STUDIO_FONTS 구조로 변환
    const studioFonts = convertToStudioFonts(excelFonts)
    
    // 3. noonnu-fonts.ts 파일 업데이트
    await updateNoonenuFontsFile(studioFonts)
    
    console.log('\\n🎉 STUDIO_FONTS 생성 완료!')
    
  } catch (error) {
    console.error('❌ 스크립트 실행 중 오류 발생:', error)
    process.exit(1)
  }
}

// 스크립트 실행
if (require.main === module) {
  main()
}