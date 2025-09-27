#!/usr/bin/env python3
"""
눈누(noonnu.cc) 상업적 안전 폰트를 Supabase 데이터베이스에 직접 삽입하는 스크립트
- 엑셀 파일에서 상업적 안전 폰트 데이터 읽기
- PostgreSQL에 직접 연결하여 데이터 삽입
"""

import pandas as pd
import psycopg2
import re
import uuid
from datetime import datetime
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 데이터베이스 연결 설정
DATABASE_CONFIG = {
    'host': 'lzxkvtwuatsrczhctsxb.supabase.co',
    'port': 5432,
    'database': 'postgres',
    'user': 'postgres',
    'password': '@rlawndgnl0206'
}

# 카테고리 매핑
CATEGORY_MAPPING = {
    'gothic': 'gothic',
    'serif': 'serif',
    'handwriting': 'handwriting',
    'decorative': 'decorative',
    'monospace': 'monospace',
    # 한글 매핑
    '고딕': 'gothic',
    '명조': 'serif',
    '바탕': 'serif',
    '손글씨': 'handwriting',
    '장식': 'decorative',
    '코딩': 'monospace',
}

def map_category(category):
    """카테고리를 enum 값으로 매핑"""
    if not category:
        return 'decorative'
    
    category_lower = category.lower().strip()
    
    # 직접 매핑
    if category_lower in CATEGORY_MAPPING:
        return CATEGORY_MAPPING[category_lower]
    
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
    
    # 기본값
    logger.warning(f"알 수 없는 카테고리: {category}, decorative로 설정")
    return 'decorative'

def extract_font_family(css_code):
    """CSS 코드에서 font-family 추출"""
    if not css_code:
        return 'UnknownFont'
    
    try:
        # font-family: 'FontName' 패턴
        match = re.search(r"font-family:\\s*['\"]([^'\"]+)['\"]", css_code, re.IGNORECASE)
        if match:
            return match.group(1)
        
        # font-family: FontName; 패턴 (따옴표 없음)
        match = re.search(r"font-family:\\s*([^;]+);", css_code, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        
        return 'UnknownFont'
    except Exception as e:
        logger.warning(f"CSS에서 font-family 추출 실패: {e}")
        return 'UnknownFont'

def load_excel_data(file_path):
    """엑셀 파일에서 상업적 안전 폰트 데이터 로드"""
    logger.info(f"엑셀 파일 로드: {file_path}")
    
    df = pd.read_excel(file_path)
    commercial_safe = df[df['is_commercial_safe'] == True]
    
    logger.info(f"총 {len(df)}개 폰트 중 상업적 안전 폰트 {len(commercial_safe)}개 발견")
    return commercial_safe

def convert_font_data(row):
    """엑셀 행을 데이터베이스 형식으로 변환"""
    return {
        'id': str(uuid.uuid4()),
        'nameKo': row.get('name_ko', '알 수 없는 폰트'),
        'nameEn': row.get('name_en', row.get('name_ko', 'Unknown Font')),
        'fontFamily': extract_font_family(row.get('css_code', '')),
        'category': map_category(row.get('category')),
        'weight': str(row.get('font_weight', '400')),
        'style': 'normal',
        'cssCode': row.get('css_code', ''),
        'cdnUrl': row.get('cdn_url'),
        'provider': row.get('provider', '알 수 없는 제공자'),
        'licenseType': row.get('license_embedding', '사용 가능'),
        'originalUrl': row.get('url'),
        'description': row.get('description'),
        'usageCount': 0,
        'isActive': True,
        'createdAt': datetime.now(),
        'updatedAt': datetime.now()
    }

def insert_fonts_to_db(fonts_df):
    """폰트 데이터를 데이터베이스에 삽입"""
    logger.info(f"{len(fonts_df)}개 폰트를 데이터베이스에 삽입 시작")
    
    conn = None
    try:
        # 데이터베이스 연결
        conn = psycopg2.connect(**DATABASE_CONFIG)
        cursor = conn.cursor()
        
        # 기존 데이터 삭제
        logger.info("기존 web_font 데이터 삭제 중...")
        cursor.execute("DELETE FROM web_font")
        conn.commit()
        logger.info("기존 데이터 삭제 완료")
        
        # 삽입 쿼리 준비
        insert_query = """
        INSERT INTO web_font (
            id, "nameKo", "nameEn", "fontFamily", category, weight, style,
            "cssCode", "cdnUrl", provider, "licenseType", "originalUrl",
            description, "usageCount", "isActive", "createdAt", "updatedAt"
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        """
        
        success_count = 0
        error_count = 0
        
        # 배치 처리
        batch_size = 50
        total_batches = (len(fonts_df) + batch_size - 1) // batch_size
        
        for batch_idx in range(total_batches):
            start_idx = batch_idx * batch_size
            end_idx = min((batch_idx + 1) * batch_size, len(fonts_df))
            batch = fonts_df.iloc[start_idx:end_idx]
            
            logger.info(f"배치 {batch_idx + 1}/{total_batches} 처리 중... ({start_idx + 1}-{end_idx}/{len(fonts_df)})")
            
            batch_data = []
            for _, row in batch.iterrows():
                try:
                    font_data = convert_font_data(row)
                    batch_data.append(tuple(font_data.values()))
                except Exception as e:
                    logger.error(f"폰트 데이터 변환 실패 {row.get('name_ko', 'Unknown')}: {e}")
                    error_count += 1
            
            # 배치 삽입
            try:
                cursor.executemany(insert_query, batch_data)
                conn.commit()
                success_count += len(batch_data)
                logger.info(f"  ✅ {len(batch_data)}개 폰트 삽입 성공")
            except Exception as e:
                logger.error(f"  ❌ 배치 삽입 실패: {e}")
                conn.rollback()
                
                # 개별 삽입 재시도
                for data in batch_data:
                    try:
                        cursor.execute(insert_query, data)
                        conn.commit()
                        success_count += 1
                    except Exception as individual_error:
                        logger.error(f"    개별 삽입 실패: {individual_error}")
                        error_count += 1
                        conn.rollback()
        
        # 최종 통계 확인
        cursor.execute("SELECT COUNT(*) FROM web_font")
        total_inserted = cursor.fetchone()[0]
        
        cursor.execute("SELECT category, COUNT(*) FROM web_font GROUP BY category ORDER BY category")
        category_stats = cursor.fetchall()
        
        logger.info("=" * 60)
        logger.info("🎉 폰트 데이터베이스 삽입 완료!")
        logger.info(f"✅ 성공: {success_count}개")
        logger.info(f"❌ 실패: {error_count}개")
        logger.info(f"📊 총 삽입된 폰트: {total_inserted}개")
        logger.info("=" * 60)
        
        logger.info("📊 카테고리별 통계:")
        for category, count in category_stats:
            logger.info(f"  - {category}: {count}개")
        
    except Exception as e:
        logger.error(f"데이터베이스 작업 중 오류: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            cursor.close()
            conn.close()

def main():
    """메인 함수"""
    try:
        excel_path = "/Users/gimjunghwi/Desktop/크롤링/noonnu_fonts_commercial_20250926_230422.xlsx"
        
        # 1. 엑셀 데이터 로드
        fonts_df = load_excel_data(excel_path)
        
        # 2. 데이터베이스에 삽입
        insert_fonts_to_db(fonts_df)
        
        logger.info("🎨 모든 작업이 성공적으로 완료되었습니다!")
        
    except Exception as e:
        logger.error(f"스크립트 실행 중 오류: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())