#!/usr/bin/env node
/**
 * 캐릭터 레퍼런스 시스템 통합 테스트
 * 비율 기반 캐릭터 레퍼런스 시스템이 정상 작동하는지 확인
 */

const url = 'http://localhost:3001/api/ai/generate';

async function testCharacterReferenceSystem() {
  console.log('🧪 캐릭터 레퍼런스 시스템 통합 테스트 시작...\n');

  // 테스트 케이스들
  const testCases = [
    {
      name: '4:5 비율 + 캐릭터 선택',
      payload: {
        prompt: '규리가 카페에서 커피를 마시고 있는 모습',
        characterIds: ['f5231afa-0624-4f03-8c25-dcb8ef4f35a2'], // 개발 모드 더미 규리 캐릭터
        aspectRatio: '4:5',
        settings: {
          batchCount: 1
        }
      }
    },
    {
      name: '1:1 비율 + 캐릭터 선택',
      payload: {
        prompt: '규리가 공원에서 산책하는 모습',
        characterIds: ['f5231afa-0624-4f03-8c25-dcb8ef4f35a2'],
        aspectRatio: '1:1',
        settings: {
          batchCount: 1
        }
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`📋 테스트: ${testCase.name}`);
    console.log(`📝 프롬프트: ${testCase.payload.prompt}`);
    console.log(`📐 비율: ${testCase.payload.aspectRatio}`);
    console.log(`🎭 캐릭터: ${testCase.payload.characterIds.length}개 선택`);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase.payload)
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ 테스트 성공!');
        console.log(`📸 생성된 이미지: ${result.imageUrl.substring(0, 50)}...`);
        console.log(`🪙 사용된 토큰: ${result.tokensUsed}`);
        console.log(`⏱️ 생성 시간: ${result.generationTime || 'N/A'}ms`);
      } else {
        console.log('❌ 테스트 실패:', result.error);
      }
      
    } catch (error) {
      console.log('💥 API 호출 오류:', error.message);
    }
    
    console.log('─'.repeat(60));
  }
  
  console.log('🏁 테스트 완료!\n');
  console.log('📊 예상 결과:');
  console.log('- 4:5 비율 테스트: 규리의 4:5 비율 레퍼런스 이미지 사용 (1080x1350)');
  console.log('- 1:1 비율 테스트: 규리의 1:1 비율 레퍼런스 이미지 사용 (1080x1080)');
  console.log('- 각 테스트에서 Google Gemini 2.5 Flash Image Preview 모델로 실제 이미지 생성');
  console.log('- 콘솔 로그에서 "🎯 캐릭터 규리: [비율] 비율 이미지 [개수]개 사용" 확인');
}

// 실행
testCharacterReferenceSystem().catch(console.error);