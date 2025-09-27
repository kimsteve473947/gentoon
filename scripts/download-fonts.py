#!/usr/bin/env python3
"""
눈누(noonnu.cc) 상업적 안전 폰트 다운로드 자동화 스크립트
- 엑셀 파일에서 상업적 안전 폰트 목록 읽기
- 각 폰트 페이지에서 다운로드 URL 추출
- TTF/OTF 폰트 파일 다운로드
- 웹폰트 변환을 위한 준비
"""

import pandas as pd
import requests
from bs4 import BeautifulSoup
import os
import time
import random
from urllib.parse import urljoin, urlparse
import zipfile
import tempfile
import shutil
from pathlib import Path
import logging

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/Users/gimjunghwi/Desktop/gentoon-saas/scripts/font-download.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class NoonuFontDownloader:
    def __init__(self, excel_path: str, output_dir: str):
        self.excel_path = excel_path
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # 사용자 에이전트 목록 (차단 방지)
        self.user_agents = [
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ]
        
        # 다운로드 통계
        self.stats = {
            'total': 0,
            'success': 0,
            'failed': 0,
            'skipped': 0
        }

    def get_random_headers(self):
        """랜덤 헤더 생성 (차단 방지)"""
        return {
            'User-Agent': random.choice(self.user_agents),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }

    def load_excel_data(self):
        """엑셀 파일에서 상업적 안전 폰트 목록 로드"""
        logger.info(f"엑셀 파일 로드 중: {self.excel_path}")
        
        df = pd.read_excel(self.excel_path)
        commercial_safe = df[df['is_commercial_safe'] == True]
        
        logger.info(f"총 {len(df)}개 폰트 중 상업적 안전 폰트 {len(commercial_safe)}개 발견")
        return commercial_safe

    def extract_download_url(self, font_page_url: str) -> str:
        """폰트 페이지에서 실제 다운로드 URL 추출"""
        try:
            headers = self.get_random_headers()
            response = requests.get(font_page_url, headers=headers, timeout=30)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # 다운로드 버튼 찾기 (여러 패턴 시도)
            download_selectors = [
                'a[href*="download"]',
                'a[href*=".zip"]',
                'a[href*=".ttf"]',
                'a[href*=".otf"]',
                '.download-btn',
                '.btn-download',
                '#download-link',
                'a:contains("다운로드")',
                'button[onclick*="download"]'
            ]
            
            for selector in download_selectors:
                elements = soup.select(selector)
                for element in elements:
                    href = element.get('href')
                    onclick = element.get('onclick')
                    
                    if href and any(ext in href for ext in ['.zip', '.ttf', '.otf', 'download']):
                        return urljoin(font_page_url, href)
                    
                    if onclick and 'download' in onclick.lower():
                        # onclick에서 URL 추출 시도
                        import re
                        url_match = re.search(r'["\']([^"\']*(?:\.zip|\.ttf|\.otf|download)[^"\']*)["\']', onclick)
                        if url_match:
                            return urljoin(font_page_url, url_match.group(1))
            
            logger.warning(f"다운로드 URL을 찾을 수 없음: {font_page_url}")
            return None
            
        except Exception as e:
            logger.error(f"다운로드 URL 추출 실패 {font_page_url}: {e}")
            return None

    def download_font_file(self, download_url: str, font_name: str) -> bool:
        """폰트 파일 다운로드"""
        try:
            headers = self.get_random_headers()
            response = requests.get(download_url, headers=headers, timeout=60, stream=True)
            response.raise_for_status()
            
            # 파일명 생성 (안전한 파일명으로 변환)
            safe_name = "".join(c for c in font_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
            
            # 파일 확장자 결정
            content_type = response.headers.get('content-type', '').lower()
            if 'zip' in content_type or download_url.endswith('.zip'):
                file_extension = '.zip'
            elif 'font' in content_type or download_url.endswith(('.ttf', '.otf')):
                file_extension = '.ttf' if 'truetype' in content_type else '.otf'
            else:
                # Content-Disposition 헤더 확인
                content_disposition = response.headers.get('content-disposition', '')
                if 'filename=' in content_disposition:
                    import re
                    filename_match = re.search(r'filename[^;=\n]*=(([\'"]).*?\2|[^;\n]*)', content_disposition)
                    if filename_match:
                        filename = filename_match.group(1).strip('\'"')
                        file_extension = '.' + filename.split('.')[-1] if '.' in filename else '.zip'
                    else:
                        file_extension = '.zip'
                else:
                    file_extension = '.zip'
            
            file_path = self.output_dir / f"{safe_name}{file_extension}"
            
            # 파일 다운로드
            with open(file_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            
            logger.info(f"다운로드 완료: {safe_name} -> {file_path}")
            
            # ZIP 파일인 경우 압축 해제
            if file_extension == '.zip':
                self.extract_zip_file(file_path, safe_name)
            
            return True
            
        except Exception as e:
            logger.error(f"폰트 다운로드 실패 {font_name}: {e}")
            return False

    def extract_zip_file(self, zip_path: Path, font_name: str):
        """ZIP 파일 압축 해제 및 폰트 파일 추출"""
        try:
            extract_dir = self.output_dir / f"{font_name}_extracted"
            extract_dir.mkdir(exist_ok=True)
            
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
            
            # 폰트 파일만 상위 디렉토리로 이동
            font_extensions = ['.ttf', '.otf', '.woff', '.woff2']
            for root, dirs, files in os.walk(extract_dir):
                for file in files:
                    if any(file.lower().endswith(ext) for ext in font_extensions):
                        src_path = Path(root) / file
                        dst_path = self.output_dir / file
                        shutil.move(str(src_path), str(dst_path))
                        logger.info(f"폰트 파일 추출: {file}")
            
            # 임시 디렉토리 및 ZIP 파일 삭제
            shutil.rmtree(extract_dir)
            zip_path.unlink()
            
        except Exception as e:
            logger.error(f"ZIP 압축 해제 실패 {zip_path}: {e}")

    def process_fonts(self):
        """전체 폰트 처리 프로세스"""
        fonts_data = self.load_excel_data()
        self.stats['total'] = len(fonts_data)
        
        logger.info(f"총 {self.stats['total']}개 폰트 다운로드 시작")
        
        for index, font in fonts_data.iterrows():
            try:
                font_name = font['name_ko']
                font_url = font['url']
                
                logger.info(f"[{index+1}/{self.stats['total']}] 처리 중: {font_name}")
                
                # 이미 다운로드된 파일 확인
                safe_name = "".join(c for c in font_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
                existing_files = list(self.output_dir.glob(f"{safe_name}*"))
                
                if existing_files:
                    logger.info(f"이미 다운로드됨, 건너뛰기: {font_name}")
                    self.stats['skipped'] += 1
                    continue
                
                # 다운로드 URL 추출
                download_url = self.extract_download_url(font_url)
                if not download_url:
                    logger.warning(f"다운로드 URL을 찾을 수 없음: {font_name}")
                    self.stats['failed'] += 1
                    continue
                
                # 폰트 다운로드
                if self.download_font_file(download_url, font_name):
                    self.stats['success'] += 1
                else:
                    self.stats['failed'] += 1
                
                # 요청 간격 (서버 부하 방지)
                time.sleep(random.uniform(1, 3))
                
            except Exception as e:
                logger.error(f"폰트 처리 중 오류 {font_name}: {e}")
                self.stats['failed'] += 1
                continue
        
        # 최종 통계 출력
        logger.info("=" * 50)
        logger.info("폰트 다운로드 완료!")
        logger.info(f"총 시도: {self.stats['total']}")
        logger.info(f"성공: {self.stats['success']}")
        logger.info(f"실패: {self.stats['failed']}")
        logger.info(f"건너뛰기: {self.stats['skipped']}")
        logger.info("=" * 50)

def main():
    """메인 실행 함수"""
    excel_path = "/Users/gimjunghwi/Desktop/크롤링/noonnu_fonts_commercial_20250926_230422.xlsx"
    output_dir = "/Users/gimjunghwi/Desktop/gentoon-saas/public/fonts/downloads"
    
    if not os.path.exists(excel_path):
        logger.error(f"엑셀 파일을 찾을 수 없습니다: {excel_path}")
        return
    
    downloader = NoonuFontDownloader(excel_path, output_dir)
    downloader.process_fonts()

if __name__ == "__main__":
    main()