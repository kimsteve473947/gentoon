/**
 * 캐릭터 이미지 재처리 테스트 스크립트
 * 김중휘 캐릭터를 새로운 center crop 로직으로 재처리
 */

const { reprocessExistingCharacterImages } = require('./lib/services/character-image-processor-supabase');

async function testReprocessCharacter() {
  console.log('🔄 Testing character reprocessing with updated center crop logic...\n');
  
  const characterId = '8ed94bde-0abe-4af3-8a1d-47e3b9c13bc9';
  const referenceImages = [
    'https://lzxkvtwuatsrczhctsxb.supabase.co/storage/v1/object/public/character-images/characters/1757535458064-resized.png'
  ];
  
  try {
    console.log(`📸 Reprocessing character ${characterId}...`);
    console.log(`🖼️ Reference image: ${referenceImages[0]}`);
    
    const result = await reprocessExistingCharacterImages(characterId, referenceImages);
    
    if (result.success) {
      console.log('✅ Character reprocessing successful!');
      console.log(`📊 Processed ${result.processedCount} image(s)`);
      
      if (result.ratioImages) {
        console.log('\n🎨 New ratio images generated:');
        
        if (result.ratioImages['1:1'] && result.ratioImages['1:1'].length > 0) {
          console.log(`🟦 1:1 (1080x1080): ${result.ratioImages['1:1'][0]}`);
        }
        
        if (result.ratioImages['4:5'] && result.ratioImages['4:5'].length > 0) {
          console.log(`📱 4:5 (1080x1350): ${result.ratioImages['4:5'][0]}`);
        }
      }
      
    } else {
      console.log('❌ Character reprocessing failed:');
      console.log(`💥 Error: ${result.error}`);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
    throw error;
  }
}

// 스크립트 실행
if (require.main === module) {
  testReprocessCharacter()
    .then(() => {
      console.log('\n🎉 Character reprocessing test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testReprocessCharacter };