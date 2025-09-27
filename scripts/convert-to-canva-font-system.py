#!/usr/bin/env python3
"""
엑셀 데이터를 Canva급 FontFamily + FontVariant 구조로 변환
- 871개 상업적 안전 폰트를 FontFamily와 FontVariant로 분리
- 동일한 fontFamily는 하나의 FontFamily로 통합
- 각 weight는 별도의 FontVariant로 생성
"""

import pandas as pd
import re
import uuid
import json
from datetime import datetime
from pathlib import Path
from collections import defaultdict

def extract_font_family(css_code):
    """CSS 코드에서 font-family 추출"""
    if not css_code:
        return 'UnknownFont'
    
    try:
        # font-family: 'FontName' 패턴
        match = re.search(r"font-family:\s*['\"]([^'\"]+)['\"]", css_code, re.IGNORECASE)
        if match:
            return match.group(1)
        
        # font-family: FontName; 패턴 (따옴표 없음)
        match = re.search(r"font-family:\s*([^;]+);", css_code, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        
        # @import 형태에서 family 추출
        match = re.search(r"family=([^&]+)", css_code)
        if match:
            family_name = match.group(1).replace('+', ' ')
            return family_name
        
        return 'UnknownFont'
    except Exception:
        return 'UnknownFont'

def extract_font_weight(css_code, fallback_weight=400):
    """CSS 코드에서 font-weight 추출"""
    if not css_code:
        return fallback_weight
    
    try:
        # font-weight: 숫자 패턴
        match = re.search(r"font-weight:\s*(\d+)", css_code, re.IGNORECASE)
        if match:
            return int(match.group(1))
        
        # font-weight: bold/normal 패턴
        if 'font-weight: bold' in css_code.lower():
            return 700
        elif 'font-weight: normal' in css_code.lower():
            return 400
        
        return fallback_weight
    except Exception:
        return fallback_weight

def get_weight_name(weight):
    """Weight 숫자를 이름으로 변환"""
    weight_names = {
        100: 'Thin',
        200: 'ExtraLight',
        300: 'Light',
        400: 'Regular',
        500: 'Medium',
        600: 'SemiBold',
        700: 'Bold',
        800: 'ExtraBold',
        900: 'Black'
    }
    return weight_names.get(weight, 'Regular')

def map_category(category):
    """카테고리를 enum 값으로 매핑"""
    if not category:
        return 'decorative'
    
    category_mapping = {
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
    
    category_lower = category.lower().strip()
    
    # 직접 매핑
    if category_lower in category_mapping:
        return category_mapping[category_lower]
    
    # 부분 매칭
    if 'gothic' in category_lower or '고딕' in category_lower:
        return 'gothic'
    elif 'serif' in category_lower or '명조' in category_lower or '바탕' in category_lower:
        return 'serif'
    elif 'hand' in category_lower or '손글씨' in category_lower:
        return 'handwriting'
    elif 'decorative' in category_lower or '장식' in category_lower:
        return 'decorative'
    elif 'mono' in category_lower or '코딩' in category_lower:
        return 'monospace'
    
    return 'decorative'

def group_fonts_by_family(df):
    """폰트를 family별로 그룹핑"""
    font_families = defaultdict(list)
    
    for _, row in df.iterrows():
        # 기본 정보 추출
        css_code = str(row.get('css_code', ''))
        font_family = extract_font_family(css_code)
        weight = extract_font_weight(css_code)
        
        # 패밀리별 그룹핑
        family_key = font_family.lower().strip()
        font_families[family_key].append({
            'original_data': row,
            'font_family': font_family,
            'weight': weight,
            'css_code': css_code
        })
    
    return font_families

def generate_font_family_sql(family_data):
    """FontFamily INSERT SQL 생성"""
    first_font = family_data[0]['original_data']
    
    family_id = str(uuid.uuid4())
    name_ko = first_font.get('name_ko', '알 수 없는 폰트')
    name_en = first_font.get('name_en', name_ko)
    font_family = family_data[0]['font_family']
    category = map_category(first_font.get('category'))
    provider = first_font.get('provider', '알 수 없는 제공자')
    original_url = first_font.get('url', '')
    description = first_font.get('description', '')
    
    # 데이터 정리
    if pd.isna(name_en) or str(name_en) == 'nan':
        name_en = name_ko
    if pd.isna(original_url) or str(original_url) == 'nan':
        original_url = None
    if pd.isna(description) or str(description) == 'nan':
        description = None
    
    sql = f"""INSERT INTO font_family (
    id, "nameKo", "nameEn", "fontFamily", category, provider, 
    "licenseType", "originalUrl", description, "totalUsageCount", 
    "isActive", "isFeatured", "createdAt", "updatedAt"
) VALUES (
    '{family_id}',
    '{name_ko.replace("'", "''")}',
    '{name_en.replace("'", "''")}',
    '{font_family.replace("'", "''")}',
    '{category}',
    '{provider.replace("'", "''")}',
    '사용 가능',
    {'NULL' if not original_url else f"'{original_url}'"},
    {'NULL' if not description else f"'{description.replace("'", "''")}'"},
    0,
    true,
    false,
    NOW(),
    NOW()
);"""
    
    return family_id, sql

def generate_font_variants_sql(family_id, family_data):
    """FontVariant INSERT SQL들 생성"""
    variants_sql = []
    
    # weight별로 중복 제거
    weights_seen = set()
    
    for font_data in family_data:
        weight = font_data['weight']
        
        # 이미 처리된 weight는 건너뛰기
        if weight in weights_seen:
            continue
        weights_seen.add(weight)
        
        variant_id = str(uuid.uuid4())
        weight_name = get_weight_name(weight)
        css_code = font_data['css_code']
        original_data = font_data['original_data']
        
        # CDN URL 추출
        cdn_url = original_data.get('cdn_url', '')
        if pd.isna(cdn_url) or str(cdn_url) == 'nan':
            cdn_url = None
        
        sql = f"""INSERT INTO font_variant (
    id, "fontFamilyId", weight, "weightName", style, "cssCode", 
    "cdnUrl", "fileUrl", "fileFormat", "usageCount", "isActive", 
    "createdAt", "updatedAt"
) VALUES (
    '{variant_id}',
    '{family_id}',
    {weight},
    '{weight_name}',
    'normal',
    '{css_code.replace("'", "''")}',
    {'NULL' if not cdn_url else f"'{cdn_url}'"},
    {'NULL' if not cdn_url else f"'{cdn_url}'"},
    'woff2',
    0,
    true,
    NOW(),
    NOW()
);"""
        
        variants_sql.append(sql)
    
    return variants_sql

def main():
    """메인 함수"""
    print("🎨 Canva급 폰트 시스템 변환 시작")
    
    # 엑셀 데이터 로드
    excel_path = "/Users/gimjunghwi/Desktop/크롤링/noonnu_fonts_commercial_20250926_230422.xlsx"
    df = pd.read_excel(excel_path)
    commercial_safe = df[df['is_commercial_safe'] == True]
    
    print(f"📊 총 {len(commercial_safe)}개 상업적 안전 폰트 발견")
    
    # 폰트 패밀리별 그룹핑
    font_families = group_fonts_by_family(commercial_safe)
    
    print(f"👨‍👩‍👧‍👦 {len(font_families)}개 폰트 패밀리로 그룹핑됨")
    
    # SQL 생성
    output_dir = Path("/Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration")
    output_dir.mkdir(exist_ok=True)
    
    families_sql = []
    variants_sql = []
    
    for family_key, family_data in font_families.items():
        print(f"🔄 처리 중: {family_data[0]['font_family']} ({len(family_data)}개 weight)")
        
        # FontFamily SQL 생성
        family_id, family_sql = generate_font_family_sql(family_data)
        families_sql.append(family_sql)
        
        # FontVariant SQL들 생성
        family_variants_sql = generate_font_variants_sql(family_id, family_data)
        variants_sql.extend(family_variants_sql)
    
    # FontFamily SQL 파일 생성
    families_file = output_dir / "font_families.sql"
    with open(families_file, 'w', encoding='utf-8') as f:
        f.write("-- FontFamily 데이터 삽입\n\n")
        f.write('\n\n'.join(families_sql))
    
    # FontVariant SQL 파일 생성
    variants_file = output_dir / "font_variants.sql"
    with open(variants_file, 'w', encoding='utf-8') as f:
        f.write("-- FontVariant 데이터 삽입\n\n")
        f.write('\n\n'.join(variants_sql))
    
    # 실행 스크립트 생성
    run_script = output_dir / "run_migration.sh"
    with open(run_script, 'w', encoding='utf-8') as f:
        f.write(f"""#!/bin/bash
# Canva급 폰트 시스템 마이그레이션 실행

echo "🎨 Canva급 폰트 시스템 마이그레이션 시작"

echo "📦 FontFamily 데이터 삽입 중..."
# FontFamily 데이터 삽입 (MCP 도구 사용)

echo "🎯 FontVariant 데이터 삽입 중..."
# FontVariant 데이터 삽입 (MCP 도구 사용)

echo "🎉 마이그레이션 완료!"
echo "📊 총 {len(families_sql)}개 폰트 패밀리"
echo "🎨 총 {len(variants_sql)}개 폰트 variant"
""")
    
    run_script.chmod(0o755)
    
    print("\n" + "=" * 60)
    print("🎉 Canva급 폰트 시스템 변환 완료!")
    print(f"📁 위치: {output_dir}")
    print(f"👨‍👩‍👧‍👦 총 {len(families_sql)}개 폰트 패밀리")
    print(f"🎨 총 {len(variants_sql)}개 폰트 variant")
    print(f"📄 FontFamily SQL: {families_file}")
    print(f"📄 FontVariant SQL: {variants_file}")
    print(f"🔧 실행 스크립트: {run_script}")
    print("=" * 60)
    
    print("\n📋 다음 단계:")
    print("1. MCP 도구로 font_families.sql 실행")
    print("2. MCP 도구로 font_variants.sql 실행")
    print("3. 새로운 FontSelector 컴포넌트 테스트")

if __name__ == "__main__":
    main()