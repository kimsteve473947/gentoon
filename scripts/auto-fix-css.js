#!/usr/bin/env node

const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

console.log('🔍 Next.js CSS 문제 자동 감지 및 수정...');

// CSS 파일이 제대로 생성되었는지 확인
const cssPath = path.join('.next', 'static', 'css');

if (!fs.existsSync(cssPath)) {
  console.log('❌ CSS 파일이 없습니다. 캐시를 정리합니다...');
  
  exec('rm -rf .next/cache .next/static .next/server/static', (error) => {
    if (error) {
      console.error('오류:', error);
      return;
    }
    console.log('✅ 캐시 정리 완료!');
    console.log('🔄 브라우저를 새로고침하거나 F5를 누르세요.');
  });
} else {
  console.log('✅ CSS가 정상적으로 로드되고 있습니다.');
}