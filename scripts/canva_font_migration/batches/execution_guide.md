# Canva급 폰트 시스템 배치 삽입 가이드

## 📊 배치 현황
- **FontFamily 배치**: 42개 (835개 폰트 패밀리)
- **FontVariant 배치**: 28개 (836개 폰트 variant)

## 🔄 실행 순서

### 1단계: FontFamily 삽입
```bash
# FontFamily 배치 1
mcp__supabase__apply_migration --name="font_families_batch_001" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_001.sql)"
```

```bash
# FontFamily 배치 2
mcp__supabase__apply_migration --name="font_families_batch_002" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_002.sql)"
```

```bash
# FontFamily 배치 3
mcp__supabase__apply_migration --name="font_families_batch_003" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_003.sql)"
```

```bash
# FontFamily 배치 4
mcp__supabase__apply_migration --name="font_families_batch_004" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_004.sql)"
```

```bash
# FontFamily 배치 5
mcp__supabase__apply_migration --name="font_families_batch_005" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_005.sql)"
```

```bash
# FontFamily 배치 6
mcp__supabase__apply_migration --name="font_families_batch_006" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_006.sql)"
```

```bash
# FontFamily 배치 7
mcp__supabase__apply_migration --name="font_families_batch_007" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_007.sql)"
```

```bash
# FontFamily 배치 8
mcp__supabase__apply_migration --name="font_families_batch_008" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_008.sql)"
```

```bash
# FontFamily 배치 9
mcp__supabase__apply_migration --name="font_families_batch_009" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_009.sql)"
```

```bash
# FontFamily 배치 10
mcp__supabase__apply_migration --name="font_families_batch_010" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_010.sql)"
```

```bash
# FontFamily 배치 11
mcp__supabase__apply_migration --name="font_families_batch_011" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_011.sql)"
```

```bash
# FontFamily 배치 12
mcp__supabase__apply_migration --name="font_families_batch_012" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_012.sql)"
```

```bash
# FontFamily 배치 13
mcp__supabase__apply_migration --name="font_families_batch_013" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_013.sql)"
```

```bash
# FontFamily 배치 14
mcp__supabase__apply_migration --name="font_families_batch_014" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_014.sql)"
```

```bash
# FontFamily 배치 15
mcp__supabase__apply_migration --name="font_families_batch_015" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_015.sql)"
```

```bash
# FontFamily 배치 16
mcp__supabase__apply_migration --name="font_families_batch_016" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_016.sql)"
```

```bash
# FontFamily 배치 17
mcp__supabase__apply_migration --name="font_families_batch_017" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_017.sql)"
```

```bash
# FontFamily 배치 18
mcp__supabase__apply_migration --name="font_families_batch_018" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_018.sql)"
```

```bash
# FontFamily 배치 19
mcp__supabase__apply_migration --name="font_families_batch_019" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_019.sql)"
```

```bash
# FontFamily 배치 20
mcp__supabase__apply_migration --name="font_families_batch_020" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_020.sql)"
```

```bash
# FontFamily 배치 21
mcp__supabase__apply_migration --name="font_families_batch_021" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_021.sql)"
```

```bash
# FontFamily 배치 22
mcp__supabase__apply_migration --name="font_families_batch_022" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_022.sql)"
```

```bash
# FontFamily 배치 23
mcp__supabase__apply_migration --name="font_families_batch_023" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_023.sql)"
```

```bash
# FontFamily 배치 24
mcp__supabase__apply_migration --name="font_families_batch_024" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_024.sql)"
```

```bash
# FontFamily 배치 25
mcp__supabase__apply_migration --name="font_families_batch_025" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_025.sql)"
```

```bash
# FontFamily 배치 26
mcp__supabase__apply_migration --name="font_families_batch_026" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_026.sql)"
```

```bash
# FontFamily 배치 27
mcp__supabase__apply_migration --name="font_families_batch_027" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_027.sql)"
```

```bash
# FontFamily 배치 28
mcp__supabase__apply_migration --name="font_families_batch_028" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_028.sql)"
```

```bash
# FontFamily 배치 29
mcp__supabase__apply_migration --name="font_families_batch_029" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_029.sql)"
```

```bash
# FontFamily 배치 30
mcp__supabase__apply_migration --name="font_families_batch_030" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_030.sql)"
```

```bash
# FontFamily 배치 31
mcp__supabase__apply_migration --name="font_families_batch_031" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_031.sql)"
```

```bash
# FontFamily 배치 32
mcp__supabase__apply_migration --name="font_families_batch_032" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_032.sql)"
```

```bash
# FontFamily 배치 33
mcp__supabase__apply_migration --name="font_families_batch_033" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_033.sql)"
```

```bash
# FontFamily 배치 34
mcp__supabase__apply_migration --name="font_families_batch_034" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_034.sql)"
```

```bash
# FontFamily 배치 35
mcp__supabase__apply_migration --name="font_families_batch_035" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_035.sql)"
```

```bash
# FontFamily 배치 36
mcp__supabase__apply_migration --name="font_families_batch_036" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_036.sql)"
```

```bash
# FontFamily 배치 37
mcp__supabase__apply_migration --name="font_families_batch_037" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_037.sql)"
```

```bash
# FontFamily 배치 38
mcp__supabase__apply_migration --name="font_families_batch_038" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_038.sql)"
```

```bash
# FontFamily 배치 39
mcp__supabase__apply_migration --name="font_families_batch_039" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_039.sql)"
```

```bash
# FontFamily 배치 40
mcp__supabase__apply_migration --name="font_families_batch_040" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_040.sql)"
```

```bash
# FontFamily 배치 41
mcp__supabase__apply_migration --name="font_families_batch_041" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_041.sql)"
```

```bash
# FontFamily 배치 42
mcp__supabase__apply_migration --name="font_families_batch_042" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_families_batch_042.sql)"
```


### 2단계: FontVariant 삽입
```bash
# FontVariant 배치 1
mcp__supabase__apply_migration --name="font_variants_batch_001" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_001.sql)"
```

```bash
# FontVariant 배치 2
mcp__supabase__apply_migration --name="font_variants_batch_002" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_002.sql)"
```

```bash
# FontVariant 배치 3
mcp__supabase__apply_migration --name="font_variants_batch_003" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_003.sql)"
```

```bash
# FontVariant 배치 4
mcp__supabase__apply_migration --name="font_variants_batch_004" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_004.sql)"
```

```bash
# FontVariant 배치 5
mcp__supabase__apply_migration --name="font_variants_batch_005" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_005.sql)"
```

```bash
# FontVariant 배치 6
mcp__supabase__apply_migration --name="font_variants_batch_006" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_006.sql)"
```

```bash
# FontVariant 배치 7
mcp__supabase__apply_migration --name="font_variants_batch_007" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_007.sql)"
```

```bash
# FontVariant 배치 8
mcp__supabase__apply_migration --name="font_variants_batch_008" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_008.sql)"
```

```bash
# FontVariant 배치 9
mcp__supabase__apply_migration --name="font_variants_batch_009" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_009.sql)"
```

```bash
# FontVariant 배치 10
mcp__supabase__apply_migration --name="font_variants_batch_010" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_010.sql)"
```

```bash
# FontVariant 배치 11
mcp__supabase__apply_migration --name="font_variants_batch_011" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_011.sql)"
```

```bash
# FontVariant 배치 12
mcp__supabase__apply_migration --name="font_variants_batch_012" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_012.sql)"
```

```bash
# FontVariant 배치 13
mcp__supabase__apply_migration --name="font_variants_batch_013" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_013.sql)"
```

```bash
# FontVariant 배치 14
mcp__supabase__apply_migration --name="font_variants_batch_014" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_014.sql)"
```

```bash
# FontVariant 배치 15
mcp__supabase__apply_migration --name="font_variants_batch_015" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_015.sql)"
```

```bash
# FontVariant 배치 16
mcp__supabase__apply_migration --name="font_variants_batch_016" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_016.sql)"
```

```bash
# FontVariant 배치 17
mcp__supabase__apply_migration --name="font_variants_batch_017" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_017.sql)"
```

```bash
# FontVariant 배치 18
mcp__supabase__apply_migration --name="font_variants_batch_018" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_018.sql)"
```

```bash
# FontVariant 배치 19
mcp__supabase__apply_migration --name="font_variants_batch_019" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_019.sql)"
```

```bash
# FontVariant 배치 20
mcp__supabase__apply_migration --name="font_variants_batch_020" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_020.sql)"
```

```bash
# FontVariant 배치 21
mcp__supabase__apply_migration --name="font_variants_batch_021" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_021.sql)"
```

```bash
# FontVariant 배치 22
mcp__supabase__apply_migration --name="font_variants_batch_022" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_022.sql)"
```

```bash
# FontVariant 배치 23
mcp__supabase__apply_migration --name="font_variants_batch_023" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_023.sql)"
```

```bash
# FontVariant 배치 24
mcp__supabase__apply_migration --name="font_variants_batch_024" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_024.sql)"
```

```bash
# FontVariant 배치 25
mcp__supabase__apply_migration --name="font_variants_batch_025" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_025.sql)"
```

```bash
# FontVariant 배치 26
mcp__supabase__apply_migration --name="font_variants_batch_026" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_026.sql)"
```

```bash
# FontVariant 배치 27
mcp__supabase__apply_migration --name="font_variants_batch_027" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_027.sql)"
```

```bash
# FontVariant 배치 28
mcp__supabase__apply_migration --name="font_variants_batch_028" --query="$(cat /Users/gimjunghwi/Desktop/gentoon-saas/scripts/canva_font_migration/batches/font_variants_batch_028.sql)"
```


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
