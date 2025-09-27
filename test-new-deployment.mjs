#!/usr/bin/env node

// 새로운 배포 버전 AI generation 테스트
async function testNewDeployment() {
  try {
    console.log('🔍 Testing new deployment AI generation...');
    
    // 새로 배포된 URL 사용
    const response = await fetch('https://gentoon-saas-5757uwl1c-kimsteves-projects.vercel.app/api/ai/generate', {
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
      console.log('✅ New deployment AI generation working!');
    } else {
      console.log('❌ New deployment AI generation failing');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testNewDeployment();