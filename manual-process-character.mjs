/**
 * Manual script to process character images using ES modules
 * This bypasses authentication issues by working directly with known data
 */

import { put } from '@vercel/blob';
import sharp from 'sharp';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

// Supabase client setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const vercelBlobToken = process.env.VERCEL_BLOB_READ_WRITE_TOKEN;

console.log('🔧 Environment check:');
console.log('- Supabase URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
console.log('- Supabase Key:', supabaseKey ? '✅ Set' : '❌ Missing');
console.log('- Vercel Blob Token:', vercelBlobToken ? '✅ Set' : '❌ Missing');

if (!supabaseUrl || !supabaseKey || !vercelBlobToken) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Character data we know from the database
const characterData = {
  id: '1a3e712b-9007-4be1-b8fe-ca280f41f226',
  name: '그레이브즈',
  referenceImages: [
    'https://lzxkvtwuatsrczhctsxb.supabase.co/storage/v1/object/public/character-images/characters/1757510176080-resized_20250822_2228_remix_01k38zb8nresrv37fcbsck0mzg.png'
  ]
};

// Ratio dimensions
const RATIO_DIMENSIONS = {
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '16:9': { width: 1920, height: 1080 }
};

/**
 * Add white padding to image for specific ratio
 */
async function addWhitePaddingToRatio(imageUrl, targetRatio) {
  try {
    console.log(`📸 Processing ${imageUrl.slice(-30)} for ${targetRatio} ratio`);
    
    // Download original image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    
    // Get original dimensions
    const { width: originalWidth, height: originalHeight } = await sharp(imageBuffer).metadata();
    
    if (!originalWidth || !originalHeight) {
      throw new Error('Failed to get image dimensions');
    }
    
    // Calculate target dimensions and padding
    const targetDimensions = RATIO_DIMENSIONS[targetRatio];
    const targetRatio_num = targetDimensions.width / targetDimensions.height;
    const originalRatio = originalWidth / originalHeight;
    
    console.log(`  📏 Original: ${originalWidth}x${originalHeight} (${originalRatio.toFixed(2)})`);
    console.log(`  🎯 Target: ${targetDimensions.width}x${targetDimensions.height} (${targetRatio_num.toFixed(2)})`);
    
    let newWidth, newHeight;
    let padTop = 0, padBottom = 0, padLeft = 0, padRight = 0;
    
    if (originalRatio > targetRatio_num) {
      // Original is wider - fit to width, pad top/bottom
      newWidth = targetDimensions.width;
      newHeight = Math.round(targetDimensions.width / originalRatio);
      padTop = Math.floor((targetDimensions.height - newHeight) / 2);
      padBottom = targetDimensions.height - newHeight - padTop;
    } else {
      // Original is taller or same - fit to height, pad left/right
      newHeight = targetDimensions.height;
      newWidth = Math.round(targetDimensions.height * originalRatio);
      padLeft = Math.floor((targetDimensions.width - newWidth) / 2);
      padRight = targetDimensions.width - newWidth - padLeft;
    }
    
    console.log(`  🔧 Resize to: ${newWidth}x${newHeight}, padding: T${padTop} B${padBottom} L${padLeft} R${padRight}`);
    
    // Process with Sharp
    const processedImage = await sharp(imageBuffer)
      .resize(newWidth, newHeight, {
        fit: 'fill',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .extend({
        top: padTop,
        bottom: padBottom,
        left: padLeft,
        right: padRight,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toBuffer();
    
    console.log(`  ✅ Processed to ${targetRatio} ratio: ${processedImage.length} bytes`);
    return processedImage;
    
  } catch (error) {
    console.error(`  ❌ Error processing ${targetRatio} ratio:`, error.message);
    throw error;
  }
}

/**
 * Main processing function
 */
async function processCharacterRatioImages() {
  try {
    console.log('🚀 Starting manual character image processing');
    console.log(`👤 Character: ${characterData.name} (${characterData.id})`);
    console.log(`🖼️ Reference images: ${characterData.referenceImages.length}`);
    
    const ratioImages = {
      '1:1': [],
      '4:5': [],
      '16:9': []
    };
    
    // Process each reference image for each ratio
    for (let i = 0; i < characterData.referenceImages.length; i++) {
      const imageUrl = characterData.referenceImages[i];
      console.log(`\n📷 Processing image ${i + 1}/${characterData.referenceImages.length}`);
      console.log(`🔗 URL: ${imageUrl}`);
      
      for (const ratio of ['1:1', '4:5', '16:9']) {
        try {
          // Process image
          const paddedImageBuffer = await addWhitePaddingToRatio(imageUrl, ratio);
          
          // Generate filename
          const filename = `character_${characterData.id}_${i}_${ratio}_${Date.now()}.png`;
          
          // Upload to Vercel Blob
          console.log(`  📤 Uploading ${ratio} image to Vercel Blob...`);
          const blob = await put(filename, paddedImageBuffer, {
            access: 'public',
            contentType: 'image/png'
          });
          
          ratioImages[ratio].push(blob.url);
          console.log(`  ✅ Uploaded: ${blob.url.slice(-50)}...`);
          
        } catch (ratioError) {
          console.error(`  ❌ Failed to process ${ratio} ratio:`, ratioError.message);
        }
      }
    }
    
    // Update database
    console.log('\n💾 Updating database...');
    console.log('📊 Processed images count:', {
      '1:1': ratioImages['1:1'].length,
      '4:5': ratioImages['4:5'].length,
      '16:9': ratioImages['16:9'].length
    });
    
    const { error: updateError } = await supabase
      .from('character')
      .update({ ratioImages: ratioImages })
      .eq('id', characterData.id);
    
    if (updateError) {
      throw updateError;
    }
    
    console.log('✅ Database updated successfully!');
    
    // Verify results
    console.log('\n🔍 Verifying results...');
    const { data: updatedCharacter, error: selectError } = await supabase
      .from('character')
      .select('ratioImages')
      .eq('id', characterData.id)
      .single();
    
    if (selectError) {
      console.error('❌ Verification failed:', selectError);
    } else {
      const ratios = updatedCharacter.ratioImages;
      const totalRatioImages = (ratios['1:1']?.length || 0) + 
                              (ratios['4:5']?.length || 0) + 
                              (ratios['16:9']?.length || 0);
      
      console.log('📈 Final verification:');
      console.log(`  1:1 ratio: ${ratios['1:1']?.length || 0} images`);
      console.log(`  4:5 ratio: ${ratios['4:5']?.length || 0} images`);
      console.log(`  16:9 ratio: ${ratios['16:9']?.length || 0} images`);
      console.log(`  Total: ${characterData.referenceImages.length} original + ${totalRatioImages} ratio = ${characterData.referenceImages.length + totalRatioImages} images`);
      
      if (totalRatioImages === characterData.referenceImages.length * 3) {
        console.log('🎉 SUCCESS! All ratio images generated correctly');
      } else {
        console.log('⚠️ WARNING: Some ratio images may be missing');
      }
    }
    
  } catch (error) {
    console.error('❌ Processing failed:', error);
  }
}

// Run the script
processCharacterRatioImages().then(() => {
  console.log('\n🏁 Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});