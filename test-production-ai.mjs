#!/usr/bin/env node

// Production AI generation test
async function testProductionAI() {
  try {
    console.log('🔍 Testing production AI generation...');
    
    const response = await fetch('https://gentoon-saas-88xrkctss-kimsteves-projects.vercel.app/api/ai/generate', {
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
      console.log('✅ Production AI generation working!');
    } else {
      console.log('❌ Production AI generation failed');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testProductionAI();