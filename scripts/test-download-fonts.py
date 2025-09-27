#!/usr/bin/env python3
"""
눈누(noonnu.cc) 폰트 다운로드 테스트 스크립트 (처음 5개만)
"""

import pandas as pd
import requests
from bs4 import BeautifulSoup
import os
import time
import random
from urllib.parse import urljoin, urlparse
from pathlib import Path
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_font_download():
    """5개 폰트만 테스트 다운로드"""
    excel_path = "/Users/gimjunghwi/Desktop/크롤링/noonnu_fonts_commercial_20250926_230422.xlsx"
    output_dir = Path("/Users/gimjunghwi/Desktop/gentoon-saas/public/fonts/test")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 엑셀 데이터 로드
    df = pd.read_excel(excel_path)
    commercial_safe = df[df['is_commercial_safe'] == True]
    
    # 처음 5개만 테스트
    test_fonts = commercial_safe.head(5)
    
    logger.info(f"테스트용 {len(test_fonts)}개 폰트 다운로드 시작")
    
    for index, font in test_fonts.iterrows():
        font_name = font['name_ko']
        font_url = font['url']
        
        logger.info(f"[{index+1}/5] 테스트 중: {font_name}")
        logger.info(f"URL: {font_url}")
        
        try:
            # 폰트 페이지 접속
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            response = requests.get(font_url, headers=headers, timeout=30)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # 페이지 구조 분석
            logger.info("페이지 구조 분석:")
            
            # 다운로드 관련 링크 찾기
            download_links = []
            
            # 다양한 선택자로 다운로드 링크 찾기
            selectors = [
                'a[href*="download"]',
                'a[href*=".zip"]',
                'a[href*=".ttf"]',
                'a[href*=".otf"]',
                '.download',
                '.btn-download',
                'button',
                'a'
            ]
            
            for selector in selectors:
                elements = soup.select(selector)
                for element in elements:
                    href = element.get('href')
                    text = element.get_text(strip=True)
                    onclick = element.get('onclick')
                    
                    if href or onclick or '다운로드' in text.lower():
                        logger.info(f"  - 요소: {element.name}, href: {href}, text: {text[:50]}, onclick: {onclick}")
                        
                        if href and any(keyword in href.lower() for keyword in ['download', '.zip', '.ttf', '.otf']):
                            download_links.append(urljoin(font_url, href))
            
            if download_links:
                logger.info(f"발견된 다운로드 링크: {download_links}")
                
                # 첫 번째 다운로드 링크 시도
                download_url = download_links[0]
                logger.info(f"다운로드 시도: {download_url}")
                
                # 파일 다운로드
                download_response = requests.get(download_url, headers=headers, timeout=60)
                download_response.raise_for_status()
                
                # 파일 저장
                safe_name = "".join(c for c in font_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
                file_path = output_dir / f"{safe_name}.zip"
                
                with open(file_path, 'wb') as f:
                    f.write(download_response.content)
                
                logger.info(f"✅ 다운로드 성공: {file_path}")
                
            else:
                logger.warning(f"❌ 다운로드 링크를 찾을 수 없음: {font_name}")
                
                # 페이지 전체 HTML 일부 출력 (디버깅용)
                logger.info("페이지 HTML 샘플:")
                logger.info(str(soup)[:1000] + "...")
        
        except Exception as e:
            logger.error(f"❌ 오류 발생 {font_name}: {e}")
        
        # 요청 간격
        time.sleep(2)
        logger.info("-" * 50)

if __name__ == "__main__":
    test_font_download()