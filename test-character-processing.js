/**
 * 캐릭터 이미지 처리 테스트 스크립트
 * 김중휘 캐릭터의 비율 이미지 크기를 확인
 */

const Sharp = require('sharp');

async function checkImageDimensions(imageUrl) {
  try {
    console.log(`🔍 Checking dimensions for: ${imageUrl}`);
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const metadata = await Sharp(imageBuffer).metadata();
    
    console.log(`📐 Dimensions: ${metadata.width}x${metadata.height}`);
    console.log(`📊 Format: ${metadata.format}`);
    console.log(`💾 Size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
    
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: imageBuffer.length
    };
    
  } catch (error) {
    console.error(`❌ Error checking image dimensions:`, error);
    throw error;
  }
}

async function testCharacterImageDimensions() {
  console.log('🧪 Testing 김중휘 character image dimensions...\n');
  
  // 김중휘 캐릭터의 비율 이미지 URL들
  const images = {
    '1:1': 'https://lzxkvtwuatsrczhctsxb.supabase.co/storage/v1/object/public/character-images/ratio-images/character_8ed94bde-0abe-4af3-8a1d-47e3b9c13bc9_0_1:1_1757535461167.png',
    '4:5': 'https://lzxkvtwuatsrczhctsxb.supabase.co/storage/v1/object/public/character-images/ratio-images/character_8ed94bde-0abe-4af3-8a1d-47e3b9c13bc9_0_4:5_1757535462517.png'
  };
  
  const expectedDimensions = {
    '1:1': { width: 1080, height: 1080 },
    '4:5': { width: 1080, height: 1350 }
  };
  
  for (const [ratio, imageUrl] of Object.entries(images)) {
    console.log(`\n📸 Testing ${ratio} ratio image:`);
    
    try {
      const dimensions = await checkImageDimensions(imageUrl);
      const expected = expectedDimensions[ratio];
      
      const isCorrect = dimensions.width === expected.width && dimensions.height === expected.height;
      
      if (isCorrect) {
        console.log(`✅ ${ratio} ratio dimensions are CORRECT: ${dimensions.width}x${dimensions.height}`);
      } else {
        console.log(`❌ ${ratio} ratio dimensions are INCORRECT:`);
        console.log(`   Expected: ${expected.width}x${expected.height}`);
        console.log(`   Actual: ${dimensions.width}x${dimensions.height}`);
      }
      
    } catch (error) {
      console.log(`❌ Failed to check ${ratio} ratio image`);
    }
  }
}

// 스크립트 실행
if (require.main === module) {
  testCharacterImageDimensions()
    .then(() => {
      console.log('\n🎉 Character image dimension test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { checkImageDimensions, testCharacterImageDimensions };