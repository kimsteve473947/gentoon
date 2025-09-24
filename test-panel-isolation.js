/**
 * 패널별 상태 격리 테스트 스크립트
 * 
 * 실제 프로젝트 환경에서 A 패널 생성 중 → B 패널 생성 → A 패널 이미지가 사라지는지 확인
 */

const baseUrl = 'http://localhost:3001';

// 실제 프로젝트 ID 사용 (UUID 형식)
const testProjectId = '12345678-1234-4567-8901-123456789012'; // 임시 UUID

// A 패널이 생성 중일 때 B 패널 생성 시나리오 테스트
async function testPanelIsolation() {
  console.log('🎯 패널별 상태 격리 테스트 시작');
  console.log('===============================');
  console.log(`📂 프로젝트 ID: ${testProjectId}`);
  
  try {
    // Step 1: A 패널 (1번) 생성 시작 - 긴 시간이 걸리는 복잡한 프롬프트
    console.log('\n📤 1단계: A 패널 (1번) 생성 시작...');
    const panelAPromise = fetch(`${baseUrl}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dev-token'
      },
      body: JSON.stringify({
        prompt: 'A 패널: 복잡하고 정교한 판타지 세계의 용과 기사가 전투하는 장면, 매우 상세하고 복잡한 배경',
        aspectRatio: '4:5',
        projectId: testProjectId,
        panelId: '1'
      })
    });

    // Step 2: 2초 후 B 패널 (2번) 생성 시작
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('📤 2단계: B 패널 (2번) 생성 시작 (A 패널 생성 중)...');
    
    const panelBPromise = fetch(`${baseUrl}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dev-token'
      },
      body: JSON.stringify({
        prompt: 'B 패널: 간단한 고양이가 앉아있는 모습',
        aspectRatio: '4:5',
        projectId: testProjectId,
        panelId: '2'
      })
    });

    console.log('⏳ 두 패널 생성 완료 대기...');
    
    // Step 3: 두 요청 모두 완료 대기
    const [panelAResponse, panelBResponse] = await Promise.all([panelAPromise, panelBPromise]);
    
    // Step 4: 결과 분석
    console.log('\n📊 테스트 결과 분석:');
    
    const panelAResult = await panelAResponse.json();
    const panelBResult = await panelBResponse.json();
    
    console.log(`A 패널 (1번) - 성공: ${panelAResponse.ok ? '✅' : '❌'}`);
    if (panelAResponse.ok) {
      console.log(`   이미지 URL: ${panelAResult.data?.imageUrl?.substring(0, 50) || 'URL 없음'}...`);
      console.log(`   토큰 사용: ${panelAResult.data?.tokensUsed || 'N/A'}`);
    } else {
      console.log(`   오류: ${panelAResult.error || panelAResult.message || '알 수 없는 오류'}`);
    }
    
    console.log(`B 패널 (2번) - 성공: ${panelBResponse.ok ? '✅' : '❌'}`);
    if (panelBResponse.ok) {
      console.log(`   이미지 URL: ${panelBResult.data?.imageUrl?.substring(0, 50) || 'URL 없음'}...`);
      console.log(`   토큰 사용: ${panelBResult.data?.tokensUsed || 'N/A'}`);
    } else {
      console.log(`   오류: ${panelBResult.error || panelBResult.message || '알 수 없는 오류'}`);
    }
    
    // Step 5: 격리 성공 여부 판정
    const bothSuccessful = panelAResponse.ok && panelBResponse.ok;
    const bothHaveImages = panelAResult.data?.imageUrl && panelBResult.data?.imageUrl;
    
    console.log('\n🎯 핵심 테스트 결과:');
    if (bothSuccessful && bothHaveImages) {
      console.log('✅ 성공: A 패널과 B 패널 모두 독립적으로 생성 완료');
      console.log('✅ 패널별 상태 격리가 올바르게 작동함');
    } else if (bothSuccessful && !bothHaveImages) {
      console.log('⚠️ 부분 성공: API 성공했으나 이미지 누락');
    } else {
      console.log('❌ 실패: 패널 간 상태 충돌 또는 생성 실패');
    }
    
    return bothSuccessful && bothHaveImages;
    
  } catch (error) {
    console.error('💥 테스트 실행 오류:', error);
    return false;
  }
}

// 연속 테스트: 더 복잡한 시나리오
async function testRapidSequentialGeneration() {
  console.log('\n🚀 연속 생성 테스트 (빠른 연속 요청)');
  console.log('======================================');
  
  const panels = [
    { id: '1', prompt: '첫 번째 패널: 해돋이 풍경' },
    { id: '2', prompt: '두 번째 패널: 바다 풍경' },
    { id: '3', prompt: '세 번째 패널: 산 풍경' },
    { id: '4', prompt: '네 번째 패널: 숲 풍경' }
  ];
  
  console.log(`📊 ${panels.length}개 패널을 0.5초 간격으로 연속 요청`);
  
  const promises = [];
  
  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i];
    
    // 0.5초 간격으로 요청
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log(`📤 ${panel.id}번 패널 요청: ${panel.prompt}`);
    
    const promise = fetch(`${baseUrl}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dev-token'
      },
      body: JSON.stringify({
        prompt: panel.prompt,
        aspectRatio: '4:5',
        projectId: testProjectId,
        panelId: panel.id
      })
    });
    
    promises.push({ panelId: panel.id, promise });
  }
  
  console.log('⏳ 모든 연속 요청 완료 대기...');
  
  const results = [];
  for (const { panelId, promise } of promises) {
    try {
      const response = await promise;
      const result = await response.json();
      
      results.push({
        panelId,
        success: response.ok,
        hasImage: result.data?.imageUrl ? true : false,
        error: response.ok ? null : (result.error || result.message)
      });
      
      console.log(`${response.ok ? '✅' : '❌'} ${panelId}번 패널 ${response.ok ? '완료' : '실패'}`);
      
    } catch (error) {
      results.push({
        panelId,
        success: false,
        hasImage: false,
        error: error.message
      });
      console.log(`❌ ${panelId}번 패널 오류: ${error.message}`);
    }
  }
  
  const successCount = results.filter(r => r.success && r.hasImage).length;
  const totalCount = results.length;
  
  console.log('\n📈 연속 생성 테스트 결과:');
  console.log(`성공률: ${successCount}/${totalCount} (${Math.round(successCount/totalCount*100)}%)`);
  
  if (successCount === totalCount) {
    console.log('✅ 모든 패널이 독립적으로 생성됨 - 상태 격리 성공');
  } else {
    console.log('⚠️ 일부 패널 실패 - 상태 충돌 가능성 있음');
    
    const failedPanels = results.filter(r => !r.success || !r.hasImage);
    failedPanels.forEach(panel => {
      console.log(`   - ${panel.panelId}번: ${panel.error || '이미지 누락'}`);
    });
  }
  
  return successCount === totalCount;
}

// 메인 실행
async function main() {
  console.log('🧪 패널별 상태 격리 종합 테스트');
  console.log('================================');
  
  try {
    // 테스트 1: 기본 격리 테스트
    const isolationSuccess = await testPanelIsolation();
    
    if (isolationSuccess) {
      console.log('\n✅ 기본 격리 테스트 통과 - 연속 테스트 진행');
      
      // 테스트 2: 연속 생성 테스트
      const sequentialSuccess = await testRapidSequentialGeneration();
      
      if (sequentialSuccess) {
        console.log('\n🎉 모든 테스트 통과! 패널별 상태 격리가 완벽하게 작동합니다.');
      } else {
        console.log('\n⚠️ 연속 테스트에서 문제 발견 - 추가 개선 필요');
      }
    } else {
      console.log('\n❌ 기본 격리 테스트 실패 - 근본적인 상태 관리 문제');
    }
    
  } catch (error) {
    console.error('💥 테스트 전체 실행 오류:', error);
  }
  
  console.log('\n✅ 테스트 완료');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testPanelIsolation, testRapidSequentialGeneration };