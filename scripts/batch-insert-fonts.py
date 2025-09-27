#!/usr/bin/env python3
"""
MCP 배치를 사용한 대량 폰트 삽입 스크립트
- 엑셀 데이터를 읽어서 SQL 파일 생성
- Supabase MCP 도구로 배치 실행
"""

import pandas as pd
import re
import uuid
import json
from datetime import datetime
from pathlib import Path

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
        
        return 'UnknownFont'
    except Exception:
        return 'UnknownFont'

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

def escape_sql_string(value):
    """SQL 문자열 이스케이프"""
    if value is None:
        return 'NULL'
    
    # 문자열을 이스케이프하고 따옴표로 감싸기
    escaped = str(value).replace("'", "''")
    return f"'{escaped}'"

def generate_insert_sql(fonts_batch):
    """폰트 배치에 대한 INSERT SQL 생성"""
    
    sql_parts = []
    sql_parts.append("INSERT INTO web_font (")
    sql_parts.append("    id, \"nameKo\", \"nameEn\", \"fontFamily\", category, weight, style,")
    sql_parts.append("    \"cssCode\", \"cdnUrl\", provider, \"licenseType\", \"originalUrl\",")
    sql_parts.append("    description, \"usageCount\", \"isActive\", \"createdAt\", \"updatedAt\"")
    sql_parts.append(") VALUES")
    
    value_parts = []
    for font in fonts_batch:
        values = [
            escape_sql_string(str(uuid.uuid4())),  # id
            escape_sql_string(font.get('name_ko', '알 수 없는 폰트')),  # nameKo
            escape_sql_string(font.get('name_en', font.get('name_ko', 'Unknown Font'))),  # nameEn
            escape_sql_string(extract_font_family(font.get('css_code', ''))),  # fontFamily
            escape_sql_string(map_category(font.get('category'))),  # category
            escape_sql_string(str(font.get('font_weight', '400'))),  # weight
            escape_sql_string('normal'),  # style
            escape_sql_string(font.get('css_code', '')),  # cssCode
            escape_sql_string(font.get('cdn_url')) if font.get('cdn_url') else 'NULL',  # cdnUrl
            escape_sql_string(font.get('provider', '알 수 없는 제공자')),  # provider
            escape_sql_string(font.get('license_embedding', '사용 가능')),  # licenseType
            escape_sql_string(font.get('url')) if font.get('url') else 'NULL',  # originalUrl
            escape_sql_string(font.get('description')) if font.get('description') else 'NULL',  # description
            '0',  # usageCount
            'true',  # isActive
            'NOW()',  # createdAt
            'NOW()'   # updatedAt
        ]
        
        value_parts.append(f"({', '.join(values)})")
    
    sql_parts.append(',\n'.join(value_parts))
    sql_parts.append(';')
    
    return '\n'.join(sql_parts)

def main():
    """메인 함수"""
    print("🎨 대량 폰트 삽입용 SQL 생성 시작")
    
    # 엑셀 데이터 로드
    excel_path = "/Users/gimjunghwi/Desktop/크롤링/noonnu_fonts_commercial_20250926_230422.xlsx"
    df = pd.read_excel(excel_path)
    commercial_safe = df[df['is_commercial_safe'] == True]
    
    print(f"📊 총 {len(commercial_safe)}개 상업적 안전 폰트 발견")
    
    # 이미 삽입된 3개 제외 (샘플로 이미 삽입함)
    remaining_fonts = commercial_safe.iloc[3:]  # 첫 3개 건너뛰기
    
    print(f"📦 {len(remaining_fonts)}개 폰트를 배치로 처리")
    
    # 배치 크기 설정
    batch_size = 20
    total_batches = (len(remaining_fonts) + batch_size - 1) // batch_size
    
    # SQL 파일들 생성
    sql_dir = Path("/Users/gimjunghwi/Desktop/gentoon-saas/scripts/sql_batches")
    sql_dir.mkdir(exist_ok=True)
    
    for batch_idx in range(total_batches):
        start_idx = batch_idx * batch_size
        end_idx = min((batch_idx + 1) * batch_size, len(remaining_fonts))
        batch = remaining_fonts.iloc[start_idx:end_idx]
        
        print(f"🔄 배치 {batch_idx + 1}/{total_batches} 생성 중... ({start_idx + 1}-{end_idx})")
        
        # 배치를 딕셔너리 리스트로 변환
        batch_fonts = batch.to_dict('records')
        
        # SQL 생성
        sql_content = generate_insert_sql(batch_fonts)
        
        # SQL 파일 저장
        sql_file = sql_dir / f"batch_{batch_idx + 1:03d}.sql"
        with open(sql_file, 'w', encoding='utf-8') as f:
            f.write(sql_content)
        
        print(f"  ✅ {sql_file} 생성 완료 ({len(batch_fonts)}개 폰트)")
    
    # 실행 스크립트 생성
    script_content = f"""#!/bin/bash
# 대량 폰트 삽입 실행 스크립트
# 생성된 SQL 파일들을 순차적으로 실행

echo "🚀 {total_batches}개 배치 SQL 파일 실행 시작"

cd "{sql_dir}"

for i in {{1..{total_batches}}}; do
    batch_file="batch_$(printf "%03d" $i).sql"
    
    if [ -f "$batch_file" ]; then
        echo "📦 배치 $i/${{total_batches}} 실행 중: $batch_file"
        
        # 여기에 실제 MCP 명령어나 psql 명령어 추가
        # 예: mcp__supabase__execute_sql < "$batch_file"
        
        echo "  ✅ 배치 $i 완료"
        sleep 1  # 서버 부하 방지
    else
        echo "  ❌ 파일을 찾을 수 없음: $batch_file"
    fi
done

echo "🎉 모든 배치 실행 완료!"
"""
    
    script_file = sql_dir / "run_batches.sh"
    with open(script_file, 'w', encoding='utf-8') as f:
        f.write(script_content)
    
    # 실행 권한 부여
    script_file.chmod(0o755)
    
    print("\n" + "=" * 60)
    print("🎉 SQL 배치 파일 생성 완료!")
    print(f"📁 위치: {sql_dir}")
    print(f"📊 총 {total_batches}개 배치 파일")
    print(f"🔧 실행 스크립트: {script_file}")
    print("=" * 60)
    
    print("\n다음 단계:")
    print("1. 생성된 SQL 파일들을 확인")
    print("2. MCP 도구를 사용해서 배치별로 실행")
    print("3. 각 배치 실행 후 결과 확인")

if __name__ == "__main__":
    main()