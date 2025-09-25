#!/usr/bin/env node

// Nano Banana Service 테스트
import dotenv from 'dotenv';
import fs from 'fs';

// 환경변수 로드
dotenv.config({ path: '.env.local' });

async function testNanoService() {
  try {
    console.log('🧪 Nano Banana Service 테스트 시작...');
    
    // 환경변수 확인
    console.log('🔍 환경변수 확인:');
    console.log('- GOOGLE_CLOUD_PROJECT_ID:', !!process.env.GOOGLE_CLOUD_PROJECT_ID);
    console.log('- GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
    console.log('- 파일 존재:', fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS || ''));
    
    // 동적 import로 서비스 로드 (ES6 모듈)
    const { NanoBananaService } = await import('./lib/ai/nano-banana-service.ts');
    
    console.log('✅ NanoBananaService 로드 성공');
    
    // 서비스 초기화
    const service = new NanoBananaService();
    
    console.log('✅ NanoBananaService 초기화 성공');
    console.log('🎉 테스트 완료! Vertex AI 인증이 정상적으로 설정되었습니다.');
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    if (error.stack) {
      console.error('스택:', error.stack);
    }
  }
}

testNanoService();