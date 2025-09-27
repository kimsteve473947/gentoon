#!/usr/bin/env node

// 프로덕션 AI generation 테스트 (개발모드 사용)
async function testProductionAI() {
  try {
    console.log('🔍 Testing production AI generation (development mode)...');
    
    // 새로 배포된 URL 사용
    const response = await fetch('https://gentoon-saas-5757uwl1c-kimsteves-projects.vercel.app/api/ai/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-development-mode': 'true', // 개발 모드 헤더
      },
      body: JSON.stringify({
        prompt: "귀여운 고양이가 공원에서 놀고 있는 모습",
        aspectRatio: "1:1",
        characters: [],
        developmentMode: true
      })
    });

    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.status === 401) {
      console.log('🔒 Authentication required - expected for production environment');
      console.log('✅ API endpoint is properly secured');
      return;
    }
    
    const result = await response.text();
    console.log('📊 Response body:', result.substring(0, 500));
    
    if (response.ok) {
      console.log('✅ Production AI generation working!');
    } else {
      console.log('❌ Production AI generation failing');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testProductionAI();
