/**
 * 동시 AI 생성 요청 테스트 스크립트
 * 
 * 사용법:
 * node test-concurrent-generation.js
 */

const baseUrl = 'http://localhost:3001';

// 테스트용 요청 데이터 (패널별 독립성 테스트)
const testRequests = [
  {
    panelId: 'panel-1',
    prompt: '귀여운 고양이가 놀고 있는 모습',
    aspectRatio: '4:5'
  },
  {
    panelId: 'panel-2', 
    prompt: '강아지가 공원에서 뛰어노는 모습',
    aspectRatio: '4:5'
  },
  {
    panelId: 'panel-3',
    prompt: '아름다운 풍경과 함께하는 새',
    aspectRatio: '1:1'
  },
  {
    panelId: 'panel-4',
    prompt: '도서관에서 책을 읽는 사람',
    aspectRatio: '4:5'
  }
];

// 패널별 순차 테스트 (실제 사용 시나리오)
const sequentialPanelTest = [
  {
    panelId: 'panel-2',
    prompt: '2번 패널: 먼저 요청된 이미지',
    aspectRatio: '4:5'
  },
  {
    panelId: 'panel-3',
    prompt: '3번 패널: 바로 다음에 요청된 이미지',
    aspectRatio: '4:5',
    delay: 1000 // 1초 후 요청
  }
];

async function testConcurrentGeneration() {
  console.log('🚀 동시 AI 생성 요청 테스트 시작...');
  console.log(`📊 테스트 요청 수: ${testRequests.length}개`);
  
  const startTime = Date.now();
  
  try {
    // 모든 요청을 동시에 시작
    const promises = testRequests.map(async (reqData, index) => {
      const requestStartTime = Date.now();
      
      console.log(`📤 요청 ${index + 1} 시작: ${reqData.panelId}`);
      
      try {
        const response = await fetch(`${baseUrl}/api/ai/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // 개발 환경이므로 임시 인증 헤더 (실제로는 인증 토큰 필요)
            'Authorization': 'Bearer dev-token'
          },
          body: JSON.stringify(reqData)
        });
        
        let result;
        const requestTime = Date.now() - requestStartTime;
        
        // 응답 내용 확인
        const responseText = await response.text();
        console.log(`📄 응답 내용 (처음 200자): ${responseText.substring(0, 200)}`);
        
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.error(`❌ JSON 파싱 실패: ${parseError.message}`);
          result = { error: 'Invalid JSON response', rawResponse: responseText.substring(0, 500) };
        }
        
        if (response.ok) {
          console.log(`✅ 요청 ${index + 1} 성공 (${requestTime}ms): ${reqData.panelId}`);
          console.log(`   - 이미지 URL: ${result.data?.imageUrl?.substring(0, 50) || 'URL 없음'}...`);
          console.log(`   - 토큰 사용: ${result.data?.tokensUsed || 'N/A'}`);
        } else {
          console.log(`❌ 요청 ${index + 1} 실패 (${requestTime}ms): ${result.error || result.message}`);
        }
        
        return {
          index: index + 1,
          panelId: reqData.panelId,
          success: response.ok,
          responseTime: requestTime,
          result
        };
        
      } catch (error) {
        const requestTime = Date.now() - requestStartTime;
        console.log(`💥 요청 ${index + 1} 오류 (${requestTime}ms):`, error.message);
        
        return {
          index: index + 1,
          panelId: reqData.panelId,
          success: false,
          responseTime: requestTime,
          error: error.message
        };
      }
    });
    
    // 모든 요청 완료 대기
    console.log('⏳ 모든 요청 완료 대기 중...');
    const results = await Promise.all(promises);
    
    const totalTime = Date.now() - startTime;
    
    // 결과 분석
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log('\n📈 테스트 결과 요약:');
    console.log(`총 소요 시간: ${totalTime}ms`);
    console.log(`성공: ${successful.length}/${testRequests.length}개`);
    console.log(`실패: ${failed.length}/${testRequests.length}개`);
    
    if (successful.length > 0) {
      const avgResponseTime = successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length;
      console.log(`평균 응답 시간: ${Math.round(avgResponseTime)}ms`);
      console.log(`최고 응답 시간: ${Math.max(...successful.map(r => r.responseTime))}ms`);
      console.log(`최저 응답 시간: ${Math.min(...successful.map(r => r.responseTime))}ms`);
    }
    
    if (failed.length > 0) {
      console.log('\n❌ 실패한 요청들:');
      failed.forEach(r => {
        console.log(`   - ${r.panelId}: ${r.error || '알 수 없는 오류'}`);
      });
    }
    
    // 큐 상태 확인
    await checkQueueStatus();
    
  } catch (error) {
    console.error('💥 테스트 실행 중 오류:', error);
  }
}

async function checkQueueStatus() {
  try {
    console.log('\n🔍 큐 상태 확인 중...');
    
    const response = await fetch(`${baseUrl}/api/ai/generate/queue-status`, {
      headers: {
        'Authorization': 'Bearer dev-token'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('📊 큐 상태:', JSON.stringify(data.status, null, 2));
    } else {
      console.log('⚠️ 큐 상태 조회 실패');
    }
    
  } catch (error) {
    console.log('⚠️ 큐 상태 확인 오류:', error.message);
  }
}

async function testSequentialGeneration() {
  console.log('\n🔄 순차 처리 테스트 (비교용)...');
  
  const startTime = Date.now();
  const results = [];
  
  for (let i = 0; i < testRequests.length; i++) {
    const reqData = testRequests[i];
    const requestStartTime = Date.now();
    
    try {
      console.log(`📤 순차 요청 ${i + 1}: ${reqData.panelId}`);
      
      const response = await fetch(`${baseUrl}/api/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dev-token'
        },
        body: JSON.stringify(reqData)
      });
      
      const result = await response.json();
      const requestTime = Date.now() - requestStartTime;
      
      if (response.ok) {
        console.log(`✅ 순차 요청 ${i + 1} 성공 (${requestTime}ms)`);
      } else {
        console.log(`❌ 순차 요청 ${i + 1} 실패 (${requestTime}ms)`);
      }
      
      results.push({
        success: response.ok,
        responseTime: requestTime
      });
      
    } catch (error) {
      console.log(`💥 순차 요청 ${i + 1} 오류:`, error.message);
      results.push({
        success: false,
        responseTime: Date.now() - requestStartTime
      });
    }
  }
  
  const totalTime = Date.now() - startTime;
  const successful = results.filter(r => r.success);
  
  console.log(`\n📊 순차 처리 결과: ${totalTime}ms (성공: ${successful.length}/${testRequests.length})`);
}

// 패널별 독립성 테스트 (핵심 문제 검증)
async function testPanelIndependence() {
  console.log('\n🎯 패널별 독립성 테스트 (2번 → 3번 패널 시나리오)');
  console.log('===============================================');
  
  const results = [];
  const startTime = Date.now();
  
  try {
    // 2번 패널 요청 시작
    console.log('📤 2번 패널 요청 시작...');
    const panel2Promise = fetch(`${baseUrl}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dev-token'
      },
      body: JSON.stringify(sequentialPanelTest[0])
    });
    
    // 1초 후 3번 패널 요청
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('📤 3번 패널 요청 시작 (1초 후)...');
    
    const panel3Promise = fetch(`${baseUrl}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dev-token'
      },
      body: JSON.stringify(sequentialPanelTest[1])
    });
    
    // 큐 상태 모니터링
    console.log('📊 큐 상태 확인...');
    await checkQueueStatus();
    
    // 두 요청 모두 완료 대기
    console.log('⏳ 두 패널 요청 완료 대기...');
    const [panel2Response, panel3Response] = await Promise.all([panel2Promise, panel3Promise]);
    
    const panel2Result = await panel2Response.json();
    const panel3Result = await panel3Response.json();
    
    console.log('\n📈 패널별 독립성 테스트 결과:');
    console.log(`2번 패널 - 성공: ${panel2Response.ok ? '✅' : '❌'}`);
    if (panel2Response.ok) {
      console.log(`   이미지 URL: ${panel2Result.data?.imageUrl?.substring(0, 50) || 'URL 없음'}...`);
    } else {
      console.log(`   오류: ${panel2Result.error || panel2Result.message || '알 수 없는 오류'}`);
    }
    
    console.log(`3번 패널 - 성공: ${panel3Response.ok ? '✅' : '❌'}`);
    if (panel3Response.ok) {
      console.log(`   이미지 URL: ${panel3Result.data?.imageUrl?.substring(0, 50) || 'URL 없음'}...`);
    } else {
      console.log(`   오류: ${panel3Result.error || panel3Result.message || '알 수 없는 오류'}`);
    }
    
    const bothSuccessful = panel2Response.ok && panel3Response.ok;
    console.log(`\n🎯 핵심 테스트 결과: ${bothSuccessful ? '✅ 성공 - 두 패널 모두 완료' : '❌ 실패 - 일부 패널 누락'}`);
    
    return bothSuccessful;
    
  } catch (error) {
    console.error('💥 패널 독립성 테스트 오류:', error);
    return false;
  }
}

// 메인 실행
async function main() {
  console.log('🧪 GenToon AI 생성 패널별 독립성 테스트');
  console.log('==========================================\n');
  
  // 1. 핵심 문제 검증 (2번 → 3번 패널)
  const panelTestSuccess = await testPanelIndependence();
  
  if (panelTestSuccess) {
    console.log('\n✅ 패널 독립성 검증 성공! 전체 동시성 테스트 진행...\n');
    
    // 2. 전체 동시 요청 테스트
    await testConcurrentGeneration();
    
    // 3. 큐 상태 최종 확인
    console.log('\n📊 최종 큐 상태:');
    await checkQueueStatus();
    
  } else {
    console.log('\n❌ 패널 독립성 문제 발견! 추가 디버깅 필요');
  }
  
  console.log('\n✅ 모든 테스트 완료');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testConcurrentGeneration, checkQueueStatus };