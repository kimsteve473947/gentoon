/**
 * Test script to verify ratio image processing for existing characters
 */

const { reprocessExistingCharacterImages } = require('./lib/services/character-image-processor.ts');
const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 설정 (환경변수에서 읽기)
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials not found');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRatioProcessing() {
  try {
    console.log('🚀 Starting ratio processing test...');
    
    // 그레이브즈 캐릭터 조회
    const { data: character, error } = await supabase
      .from('character')
      .select('*')
      .eq('name', '그레이브즈')
      .order('createdAt', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      throw error;
    }
    
    if (!character) {
      console.log('❌ Character "그레이브즈" not found');
      return;
    }
    
    console.log(`📋 Found character: ${character.name} (ID: ${character.id})`);
    console.log(`🖼️ Reference images:`, character.referenceImages);
    console.log(`📐 Current ratioImages:`, character.ratioImages);
    
    if (!character.referenceImages || character.referenceImages.length === 0) {
      console.log('❌ No reference images found for this character');
      return;
    }
    
    // 비율 이미지 처리
    console.log('\n🎨 Processing ratio images...');
    const result = await reprocessExistingCharacterImages(
      character.id,
      character.referenceImages
    );
    
    if (!result.success) {
      console.error('❌ Image processing failed:', result.error);
      return;
    }
    
    console.log('✅ Image processing successful!');
    console.log('📊 Result:', {
      processedCount: result.processedCount,
      ratioImages: result.ratioImages
    });
    
    // 데이터베이스 업데이트
    console.log('\n💾 Updating database...');
    const { error: updateError } = await supabase
      .from('character')
      .update({ ratioImages: result.ratioImages })
      .eq('id', character.id);
    
    if (updateError) {
      console.error('❌ Database update failed:', updateError);
      return;
    }
    
    console.log('✅ Database updated successfully!');
    
    // 결과 검증
    console.log('\n🔍 Verifying results...');
    const { data: updatedCharacter } = await supabase
      .from('character')
      .select('ratioImages')
      .eq('id', character.id)
      .single();
    
    console.log('📊 Final ratioImages in database:', updatedCharacter?.ratioImages);
    
    // 각 비율별 이미지 개수 확인
    if (updatedCharacter?.ratioImages) {
      const ratios = updatedCharacter.ratioImages;
      console.log('\n📈 Image count by ratio:');
      console.log(`  1:1 ratio: ${ratios['1:1']?.length || 0} images`);
      console.log(`  4:5 ratio: ${ratios['4:5']?.length || 0} images`);
      console.log(`  16:9 ratio: ${ratios['16:9']?.length || 0} images`);
      
      const totalRatioImages = (ratios['1:1']?.length || 0) + 
                              (ratios['4:5']?.length || 0) + 
                              (ratios['16:9']?.length || 0);
      const originalImageCount = character.referenceImages.length;
      console.log(`\n📸 Total images: ${originalImageCount} original + ${totalRatioImages} ratio images = ${originalImageCount + totalRatioImages} total`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// 스크립트 실행
testRatioProcessing().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
});