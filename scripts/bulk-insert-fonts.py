#!/usr/bin/env python3
"""
Canva급 폰트 시스템 대량 삽입 스크립트
- font_families.sql과 font_variants.sql을 배치로 나누어 삽입
- MCP Supabase 도구를 사용하여 안전하게 삽입
"""

import re
import time
from pathlib import Path

def parse_sql_file(file_path):
    """SQL 파일을 개별 INSERT 문장으로 파싱"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # INSERT 문장들을 찾기
    insert_pattern = r'INSERT INTO \w+.*?;'
    inserts = re.findall(insert_pattern, content, re.DOTALL | re.IGNORECASE)
    
    # 각 INSERT 문장을 정리
    cleaned_inserts = []
    for insert in inserts:
        # 불필요한 공백과 줄바꿈 정리
        cleaned = re.sub(r'\s+', ' ', insert.strip())
        if cleaned and 'VALUES' in cleaned.upper():
            cleaned_inserts.append(cleaned)
    
    return cleaned_inserts

def create_batch_inserts(inserts, batch_size=20):
    """INSERT 문장들을 배치로 나누기"""
    batches = []
    for i in range(0, len(inserts), batch_size):
        batch = inserts[i:i + batch_size]
        batches.append('\n\n'.join(batch))
    return batches

def save_batch_files(batches, output_dir, prefix):
    """배치 파일들을 저장"""
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    
    batch_files = []
    for i, batch_sql in enumerate(batches, 1):
        file_name = f"{prefix}_batch_{i:03d}.sql"
        file_path = output_path / file_name
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(f"-- {prefix} 배치 {i}\n\n")
            f.write(batch_sql)
            f.write('\n')
        
        batch_files.append(file_path)
        print(f"📦 배치 {i} 생성: {file_name}")
    
    return batch_files

def main():
    """메인 함수"""
    print("🚀 Canva급 폰트 시스템 대량 삽입 시작")
    
    base_dir = Path("/Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration")
    output_dir = base_dir / "batches"
    
    # FontFamily SQL 파싱
    families_file = base_dir / "font_families.sql"
    print(f"📄 FontFamily SQL 파싱: {families_file}")
    
    if families_file.exists():
        family_inserts = parse_sql_file(families_file)
        print(f"🔍 {len(family_inserts)}개 FontFamily INSERT 문장 발견")
        
        # 배치로 나누기 (20개씩)
        family_batches = create_batch_inserts(family_inserts, batch_size=20)
        print(f"📦 {len(family_batches)}개 FontFamily 배치 생성")
        
        # 배치 파일 저장
        family_batch_files = save_batch_files(family_batches, output_dir, "font_families")
    else:
        print(f"❌ FontFamily SQL 파일을 찾을 수 없음: {families_file}")
        return
    
    # FontVariant SQL 파싱
    variants_file = base_dir / "font_variants.sql"
    print(f"📄 FontVariant SQL 파싱: {variants_file}")
    
    if variants_file.exists():
        variant_inserts = parse_sql_file(variants_file)
        print(f"🔍 {len(variant_inserts)}개 FontVariant INSERT 문장 발견")
        
        # 배치로 나누기 (30개씩 - variants는 더 간단함)
        variant_batches = create_batch_inserts(variant_inserts, batch_size=30)
        print(f"📦 {len(variant_batches)}개 FontVariant 배치 생성")
        
        # 배치 파일 저장
        variant_batch_files = save_batch_files(variant_batches, output_dir, "font_variants")
    else:
        print(f"❌ FontVariant SQL 파일을 찾을 수 없음: {variants_file}")
        return
    
    # 실행 가이드 생성
    guide_file = output_dir / "execution_guide.md"
    with open(guide_file, 'w', encoding='utf-8') as f:
        f.write(f"""# Canva급 폰트 시스템 배치 삽입 가이드

## 📊 배치 현황
- **FontFamily 배치**: {len(family_batches)}개 ({len(family_inserts)}개 폰트 패밀리)
- **FontVariant 배치**: {len(variant_batches)}개 ({len(variant_inserts)}개 폰트 variant)

## 🔄 실행 순서

### 1단계: FontFamily 삽입
""")
        
        for i, file_path in enumerate(family_batch_files, 1):
            f.write(f"```bash\n# FontFamily 배치 {i}\nmcp__supabase__apply_migration --name=\"font_families_batch_{i:03d}\" --query=\"$(cat {file_path})\"\n```\n\n")
        
        f.write(f"""
### 2단계: FontVariant 삽입
""")
        
        for i, file_path in enumerate(variant_batch_files, 1):
            f.write(f"```bash\n# FontVariant 배치 {i}\nmcp__supabase__apply_migration --name=\"font_variants_batch_{i:03d}\" --query=\"$(cat {file_path})\"\n```\n\n")
        
        f.write(f"""
## ✅ 검증 쿼리
```sql
-- 전체 폰트 패밀리 수 확인
SELECT COUNT(*) as total_families FROM font_family WHERE "isActive" = true;

-- 전체 폰트 variant 수 확인  
SELECT COUNT(*) as total_variants FROM font_variant WHERE "isActive" = true;

-- 카테고리별 통계
SELECT category, COUNT(*) as count 
FROM font_family 
WHERE "isActive" = true 
GROUP BY category 
ORDER BY count DESC;
```
""")
    
    print("\n" + "=" * 60)
    print("🎉 배치 파일 생성 완료!")
    print(f"📁 위치: {output_dir}")
    print(f"📄 실행 가이드: {guide_file}")
    print(f"👨‍👩‍👧‍👦 FontFamily 배치: {len(family_batches)}개")
    print(f"🎨 FontVariant 배치: {len(variant_batches)}개")
    print("=" * 60)

if __name__ == "__main__":
    main()