/**
 * 캐릭터 이미지 API 테스트 스크립트
 * 새로운 center crop 로직을 테스트하기 위해 새 캐릭터를 생성
 */

async function testCharacterCreation() {
  console.log('🧪 Testing character creation with updated center crop logic...\n');
  
  try {
    // 테스트용 캐릭터 데이터
    const characterData = {
      name: '테스트캐릭터_' + Date.now(),
      description: '새로운 center crop 로직 테스트용 캐릭터',
      referenceImages: [
        'https://lzxkvtwuatsrczhctsxb.supabase.co/storage/v1/object/public/character-images/characters/1757535458064-resized.png'
      ]
    };
    
    console.log(`📸 Creating test character: ${characterData.name}`);
    console.log(`🖼️ Using reference image: ${characterData.referenceImages[0]}`);
    
    const response = await fetch('http://localhost:3000/api/characters', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(characterData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API Error ${response.status}: ${errorData.error || 'Unknown error'}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Character creation successful!');
      console.log(`🆔 Character ID: ${result.data.id}`);
      console.log(`📛 Character Name: ${result.data.name}`);
      
      if (result.data.ratioImages) {
        console.log('\n🎨 Ratio images generated:');
        
        if (result.data.ratioImages['1:1'] && result.data.ratioImages['1:1'].length > 0) {
          console.log(`🟦 1:1 (1080x1080): ${result.data.ratioImages['1:1'][0]}`);
        }
        
        if (result.data.ratioImages['4:5'] && result.data.ratioImages['4:5'].length > 0) {
          console.log(`📱 4:5 (1080x1350): ${result.data.ratioImages['4:5'][0]}`);
        }
      }
      
      return result.data;
      
    } else {
      console.log('❌ Character creation failed:');
      console.log(`💥 Error: ${result.error}`);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
    throw error;
  }
}

// 스크립트 실행
if (require.main === module) {
  testCharacterCreation()
    .then((character) => {
      console.log('\n🎉 Character creation test completed!');
      console.log('\n💡 Check the new ratio images to verify white padding has been removed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testCharacterCreation };