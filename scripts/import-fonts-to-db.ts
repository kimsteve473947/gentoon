#!/usr/bin/env npx tsx
/**
 * 눈누(noonnu.cc) 상업적 안전 폰트를 데이터베이스에 대량 삽입하는 스크립트
 * - 엑셀 파일에서 상업적 안전 폰트 데이터 읽기
 * - WebFont 모델에 맞게 데이터 변환
 * - Prisma를 사용해서 데이터베이스에 삽입
 */

import { PrismaClient, FontCategory } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

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

// 카테고리 매핑 (엑셀의 카테고리 -> Prisma enum)
const CATEGORY_MAPPING: Record<string, FontCategory> = {
  'gothic': FontCategory.gothic,
  'serif': FontCategory.serif,
  'handwriting': FontCategory.handwriting,
  'decorative': FontCategory.decorative,
  'monospace': FontCategory.monospace,
  // 추가 매핑
  '고딕': FontCategory.gothic,
  '명조': FontCategory.serif,
  '바탕': FontCategory.serif,
  '손글씨': FontCategory.handwriting,
  '장식': FontCategory.decorative,
  '코딩': FontCategory.monospace,
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

function mapCategoryToEnum(category: string): FontCategory {
  const normalizedCategory = category?.toLowerCase()?.trim()
  
  // 직접 매핑 시도
  if (CATEGORY_MAPPING[normalizedCategory]) {
    return CATEGORY_MAPPING[normalizedCategory]
  }
  
  // 부분 매칭 시도
  if (normalizedCategory?.includes('gothic') || normalizedCategory?.includes('고딕')) {
    return FontCategory.gothic
  }
  if (normalizedCategory?.includes('serif') || normalizedCategory?.includes('명조') || normalizedCategory?.includes('바탕')) {
    return FontCategory.serif
  }
  if (normalizedCategory?.includes('hand') || normalizedCategory?.includes('손글씨')) {
    return FontCategory.handwriting
  }
  if (normalizedCategory?.includes('decorative') || normalizedCategory?.includes('장식')) {
    return FontCategory.decorative
  }
  if (normalizedCategory?.includes('mono') || normalizedCategory?.includes('코딩')) {
    return FontCategory.monospace
  }
  
  // 기본값: decorative
  console.warn(`⚠️  알 수 없는 카테고리 "${category}", decorative로 분류`)
  return FontCategory.decorative
}

function extractFontFamilyFromCSS(cssCode: string): string {
  try {
    // CSS에서 font-family 값 추출
    const fontFamilyMatch = cssCode.match(/font-family:\\s*['"']([^'"]+)['"']/i)
    if (fontFamilyMatch) {
      return fontFamilyMatch[1]
    }
    
    // font-family가 따옴표 없이 정의된 경우
    const fontFamilyMatch2 = cssCode.match(/font-family:\\s*([^;]+);/i)
    if (fontFamilyMatch2) {
      return fontFamilyMatch2[1].trim()
    }
    
    return 'UnknownFont'
  } catch (error) {
    console.warn('CSS에서 font-family 추출 실패:', error)
    return 'UnknownFont'
  }
}

function convertExcelToWebFont(excelFont: ExcelFont) {
  return {
    nameKo: excelFont.name_ko || '알 수 없는 폰트',
    nameEn: excelFont.name_en || excelFont.name_ko || 'Unknown Font',
    fontFamily: extractFontFamilyFromCSS(excelFont.css_code || ''),
    category: mapCategoryToEnum(excelFont.category),
    weight: excelFont.font_weight || '400',
    style: 'normal',
    cssCode: excelFont.css_code || '',
    cdnUrl: excelFont.cdn_url || null,
    provider: excelFont.provider || '알 수 없는 제공자',
    licenseType: excelFont.license_embedding || '사용 가능',
    originalUrl: excelFont.url || null,
    description: excelFont.description || null,
    usageCount: 0,
    isActive: true,
  }
}

async function importFontsToDatabase(fonts: ExcelFont[]) {
  console.log(`🚀 ${fonts.length}개 폰트를 데이터베이스에 삽입 시작`)
  
  let successCount = 0
  let errorCount = 0
  const errors: Array<{ font: string; error: string }> = []
  
  // 기존 폰트 데이터 삭제 (선택사항)
  console.log('🗑️  기존 WebFont 데이터 삭제 중...')
  await prisma.webFont.deleteMany({})
  console.log('✅ 기존 데이터 삭제 완료')
  
  // 배치 단위로 처리 (성능 최적화)
  const BATCH_SIZE = 50
  
  for (let i = 0; i < fonts.length; i += BATCH_SIZE) {
    const batch = fonts.slice(i, i + BATCH_SIZE)
    
    console.log(`📦 배치 ${Math.floor(i / BATCH_SIZE) + 1} 처리 중... (${i + 1}-${Math.min(i + BATCH_SIZE, fonts.length)}/${fonts.length})`)
    
    try {
      const webFonts = batch.map(convertExcelToWebFont)
      
      // Prisma createMany 사용 (빠른 대량 삽입)
      const result = await prisma.webFont.createMany({
        data: webFonts,
        skipDuplicates: true, // 중복 데이터 건너뛰기
      })
      
      successCount += result.count
      console.log(`  ✅ ${result.count}개 폰트 삽입 성공`)
      
    } catch (error) {
      console.error(`  ❌ 배치 삽입 실패:`, error)
      
      // 개별 삽입으로 재시도
      for (const font of batch) {
        try {
          const webFont = convertExcelToWebFont(font)
          await prisma.webFont.create({ data: webFont })
          successCount++
        } catch (individualError) {
          errorCount++
          errors.push({
            font: font.name_ko,
            error: individualError instanceof Error ? individualError.message : String(individualError)
          })
          console.error(`    ❌ ${font.name_ko} 삽입 실패:`, individualError)
        }
      }
    }
    
    // 진행 상황 표시
    if ((i + BATCH_SIZE) % 200 === 0) {
      console.log(`📊 진행 상황: ${Math.min(i + BATCH_SIZE, fonts.length)}/${fonts.length} (${Math.round((Math.min(i + BATCH_SIZE, fonts.length) / fonts.length) * 100)}%)`)
    }
  }
  
  // 최종 결과 출력
  console.log('\\n' + '='.repeat(60))
  console.log('🎉 폰트 데이터베이스 삽입 완료!')
  console.log(`✅ 성공: ${successCount}개`)
  console.log(`❌ 실패: ${errorCount}개`)
  console.log('='.repeat(60))
  
  if (errors.length > 0) {
    console.log('\\n❌ 실패한 폰트들:')
    errors.slice(0, 10).forEach(({ font, error }) => {
      console.log(`  - ${font}: ${error}`)
    })
    if (errors.length > 10) {
      console.log(`  ... 그 외 ${errors.length - 10}개`)
    }
  }
  
  // 카테고리별 통계
  console.log('\\n📊 카테고리별 통계:')
  const stats = await prisma.webFont.groupBy({
    by: ['category'],
    _count: {
      category: true,
    },
  })
  
  stats.forEach(stat => {
    console.log(`  - ${stat.category}: ${stat._count.category}개`)
  })
}

async function main() {
  try {
    console.log('🎨 눈누 폰트 데이터베이스 삽입 스크립트 시작')
    console.log('=' + '='.repeat(50))
    
    const excelPath = '/Users/gimjunghwi/Desktop/크롤링/noonnu_fonts_commercial_20250926_230422.xlsx'
    
    // 1. 엑셀 데이터 로드
    const fonts = await loadExcelData(excelPath)
    
    // 2. 데이터베이스에 삽입
    await importFontsToDatabase(fonts)
    
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