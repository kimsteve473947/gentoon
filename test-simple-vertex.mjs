#!/usr/bin/env node

// 단순한 Vertex AI 테스트
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testSimpleVertex() {
  try {
    console.log('🧪 단순한 Vertex AI 테스트 시작...');
    
    // JSON credentials 파싱
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    
    // Private key 개행 처리
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    
    console.log('✅ Credentials 로드 성공');
    
    // GoogleGenAI 초기화
    const genAI = new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT_ID,
      location: process.env.GOOGLE_CLOUD_LOCATION || 'global',
      credentials: credentials
    });
    
    console.log('✅ GoogleGenAI 초기화 성공');
    
    // 모델 가져오기
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash'
    });
    
    console.log('✅ 모델 로드 성공');
    
    // 간단한 텍스트 생성 테스트
    const result = await model.generateContent('안녕하세요! 간단한 테스트입니다.');
    
    console.log('📤 생성 결과:', result.response.text());
    console.log('🎉 테스트 성공!');
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
    if (error.message) console.error('메시지:', error.message);
    if (error.stack) console.error('스택:', error.stack);
  }
}

testSimpleVertex();