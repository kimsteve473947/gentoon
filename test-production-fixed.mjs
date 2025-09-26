#!/usr/bin/env node

// 수정된 프로덕션 AI generation 테스트
async function testProductionAI() {
  try {
    console.log('🔍 Testing fixed production AI generation...');
    
    // 최신 배포 URL 사용
    const response = await fetch('https://gentoon-saas-3xwd3l0bh-kimsteves-projects.vercel.app/api/ai/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token', // Mock auth for testing
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
    
    const result = await response.text();
    console.log('📊 Response body:', result.substring(0, 500));
    
    if (response.ok) {
      console.log('✅ Fixed production AI generation working!');
    } else {
      console.log('❌ Production AI generation still failing');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testProductionAI();