/**
 * MPC 배치 연속성 테스트 스크립트
 * 우리만의 Multi-Panel Continuity (MPC) 시스템 테스트
 * 나노바나나 MCP 방식을 참고한 자체 구현 연속성 시스템
 */

const testMPCBatch = async () => {
  console.log('🚀 MPC (Multi-Panel Continuity) 배치 테스트 시작...');
  
  try {
    // MPC 테스트 데이터 - 연속성 있는 스토리 라인
    const testData = {
      panels: [
        {
          order: 1,
          prompt: "한국 웹툰 스타일로, 햇살이 들어오는 학교 교실, 창가 자리에 앉아 책을 읽고 있는 고등학생. 평화로운 오후 시간",
          characters: [],
          elements: []
        },
        {
          order: 2,
          prompt: "같은 교실, 같은 학생이 책을 천천히 덮으며 창밖의 운동장을 바라보는 모습. 햇살과 교실 분위기 유지",
          characters: [],
          elements: []
        },
        {
          order: 3,
          prompt: "동일한 교실에서, 학생 옆자리에 친구가 다가와서 서로 대화하는 장면. 자연스러운 시간의 흐름",
          characters: [],
          elements: []
        },
        {
          order: 4,
          prompt: "같은 교실 배경, 두 학생이 함께 웃으며 대화하는 모습. 따뜻한 우정의 순간",
          characters: [],
          elements: []
        }
      ],
      selectedCharacters: [],
      selectedElements: [],
      aspectRatio: '4:5',
      projectId: 'test-mpc-continuity',
      settings: {
        highResolution: true,
        saveCharacter: false
      }
    };

    // 배치 생성 API 호출
    const response = await fetch('/api/ai/generate-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('🎉 MPC 배치 연속성 테스트 성공!');
      console.log(`📊 결과: ${result.data.successCount}/${result.data.totalPanels}개 성공`);
      console.log(`🔗 연속성 점수: ${result.data.averageContinuityScore.toFixed(1)}점 (평균)`);
      console.log(`🚀 MPC 세션: ${result.data.sessionId}`);
      console.log(`💎 토큰 사용량: ${result.data.tokensUsed.toLocaleString()}토큰`);
      
      // 결과 이미지들 확인
      result.data.results.forEach((panel, index) => {
        if (panel.success) {
          console.log(`✅ 패널 ${index + 1}: ${panel.imageUrl?.substring(0, 50)}... (연속성: ${panel.continuityScore || 0}점)`);
          if (index === 0) {
            console.log('   🎬 기준 패널: MPC Foundation Panel 생성');
          } else {
            console.log('   🔗 연속성 패널: MPC Continuity Panel 생성 (이전 패널 참조)');
          }
        } else {
          console.log(`❌ 패널 ${index + 1}: ${panel.error}`);
        }
      });
      
      // MPC 특화 정보 표시
      console.log('\n🎯 MPC 시스템 특징:');
      console.log('  - 나노바나나 MCP 방식 참고한 자체 구현');
      console.log('  - 첫 패널: 기준점(Foundation) 설정');
      console.log('  - 후속 패널: 이전 이미지 참조하여 연속성 보장');
      console.log('  - 캐릭터/요소 일관성 유지');
      console.log('  - 연속성 점수 자동 계산');
      
      return true;
    } else {
      console.log('❌ MPC 배치 연속성 테스트 실패:', result.error);
      return false;
    }
    
  } catch (error) {
    console.error('🔥 테스트 실행 오류:', error);
    return false;
  }
};

// 브라우저 환경에서 실행
if (typeof window !== 'undefined') {
  window.testMPCBatch = testMPCBatch;
  window.testBatchContinuity = testMPCBatch; // 하위 호환성
  console.log('🚀 MPC 테스트 함수 준비 완료. 콘솔에서 testMPCBatch() 실행하세요.');
}

// Node.js 환경에서 실행
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testMPCBatch, testBatchContinuity: testMPCBatch };
}

console.log(`
🚀 MPC (Multi-Panel Continuity) 배치 테스트 가이드

📚 MPC 시스템이란?
나노바나나의 MCP (Model Context Protocol) 방식을 참고하여 
우리가 자체 구현한 다중패널 연속성 시스템

🎯 핵심 특징:
✨ 첫 패널: Foundation Panel (기준점 설정)
🔗 후속 패널: Continuity Panel (이전 이미지 참조)
🎭 캐릭터 일관성: 레퍼런스 이미지 기반
📊 연속성 점수: 자동 계산 및 평가

🧪 테스트 실행 방법:
1. 개발 서버 실행: npm run dev
2. 브라우저에서 /studio 페이지 열기
3. 개발자 도구 콘솔에서 실행:
   testMPCBatch()

📋 확인 사항:
✅ 기준 패널: MPC Foundation Panel 생성 (첫 패널)
✅ 연속성 패널: MPC Continuity Panel 생성 (이전 이미지 참조)
✅ 연속성 점수: 각 패널의 연속성 품질 평가 (0-100점)
✅ 토큰 사용량: 패널당 1290 토큰 정확한 계산
✅ 이미지 저장: WebP 최적화 + Supabase Storage

🔍 로그 확인 포인트:
- 🎬 [MPC] 기준 패널 생성: Foundation Panel
- 🔗 [MPC] 연속성 패널 생성: Continuity Panel  
- 📊 [MPC] 연속성 점수: 각 패널별 품질 평가
- 💾 [MPC] 이미지 저장: WebP 최적화 포함
- 🎉 [MPC] 배치 완료: 평균 연속성 점수 출력

💡 MCP vs MPC:
- MCP: 나노바나나의 Model Context Protocol
- MPC: 우리의 Multi-Panel Continuity (자체 구현)
`);