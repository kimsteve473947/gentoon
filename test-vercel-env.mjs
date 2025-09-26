#!/usr/bin/env node

// Vercel 환경변수 확인 테스트
console.log('🔍 Vercel 환경변수 확인...');

// Vertex AI 관련 환경변수 확인
const requiredEnvs = [
  'GOOGLE_CLOUD_PROJECT_ID',
  'GOOGLE_CLOUD_LOCATION', 
  'GOOGLE_APPLICATION_CREDENTIALS_JSON'
];

console.log('📊 필수 환경변수 확인:');
requiredEnvs.forEach(env => {
  const value = process.env[env];
  if (value) {
    if (env === 'GOOGLE_APPLICATION_CREDENTIALS_JSON') {
      try {
        const parsed = JSON.parse(value);
        console.log(`✅ ${env}: JSON 파싱 성공 (project_id: ${parsed.project_id})`);
      } catch (error) {
        console.log(`❌ ${env}: JSON 파싱 실패 - ${error.message}`);
      }
    } else {
      console.log(`✅ ${env}: ${value}`);
    }
  } else {
    console.log(`❌ ${env}: 설정되지 않음`);
  }
});

// Vercel 환경 확인
console.log('\n🌍 환경 정보:');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`VERCEL: ${process.env.VERCEL}`);
console.log(`VERCEL_ENV: ${process.env.VERCEL_ENV}`);

// AI 키도 확인
console.log(`\n🔑 GOOGLE_AI_API_KEY: ${process.env.GOOGLE_AI_API_KEY ? '설정됨' : '미설정'}`);