#!/usr/bin/env npx tsx

/**
 * 🔄 PNG 캐릭터 이미지를 WebP로 변환하는 마이그레이션 스크립트
 * 
 * 실행 방법:
 * npx tsx scripts/convert-characters-to-webp.ts
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { webpOptimizer } from '../lib/image/webp-optimizer';

// .env.local 파일 로드
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface CharacterToConvert {
  id: string;
  name: string;
  thumbnailUrl: string;
  referenceImages: string[];
  ratioImages: Record<string, string[]>;
  userId: string;
}

async function downloadImage(url: string): Promise<Buffer> {
  // Base64 데이터URL인 경우 직접 디코딩
  if (url.startsWith('data:')) {
    const base64Data = url.split(',')[1];
    return Buffer.from(base64Data, 'base64');
  }
  
  // 일반 URL인 경우 fetch로 다운로드
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function convertImageToWebP(imageUrl: string, userId: string, prefix: string): Promise<string | null> {
  try {
    console.log(`  📥 Downloading: ${imageUrl.substring(0, 50)}...`);
    const imageBuffer = await downloadImage(imageUrl);
    
    console.log(`  🔄 Converting to WebP...`);
    const result = await webpOptimizer.convertToWebP(imageBuffer, 85);
    
    // Base64 데이터 URL로 변환
    const base64WebP = `data:image/webp;base64,${result.webpBuffer.toString('base64')}`;
    
    console.log(`  ✅ Converted to Base64 WebP (${(result.webpBuffer.length/1024).toFixed(1)}KB)`);
    return base64WebP;
    
  } catch (error) {
    console.error(`  ❌ Failed to convert image: ${error}`);
    return null;
  }
}

async function convertCharacterImages() {
  console.log('🚀 Starting PNG to WebP conversion for character images...\n');
  
  // Base64 데이터URL이나 PNG 이미지를 가진 캐릭터들 조회
  const { data: characters, error } = await supabase
    .from('character')
    .select('id, name, "userId", "thumbnailUrl", "referenceImages", "ratioImages"')
    .order('createdAt', { ascending: false });
  
  if (error) {
    console.error('❌ Failed to fetch characters:', error);
    return;
  }
  
  if (!characters || characters.length === 0) {
    console.log('✅ No PNG images found to convert!');
    return;
  }
  
  console.log(`📊 Found ${characters.length} characters with PNG images\n`);
  
  let totalConverted = 0;
  let totalFailed = 0;
  
  for (const [index, character] of characters.entries()) {
    console.log(`\n📝 [${index + 1}/${characters.length}] Converting character: "${character.name}"`);
    
    const updates: any = {};
    let characterConverted = 0;
    
    // 썸네일 변환 (Base64 데이터URL 또는 PNG 파일)
    if (character.thumbnailUrl && (character.thumbnailUrl.includes('.png') || character.thumbnailUrl.startsWith('data:'))) {
      console.log('  🖼️  Converting thumbnail...');
      const webpUrl = await convertImageToWebP(
        character.thumbnailUrl, 
        character.userId, 
        'thumbnail'
      );
      if (webpUrl) {
        updates.thumbnailUrl = webpUrl;
        characterConverted++;
      } else {
        totalFailed++;
      }
    }
    
    // 레퍼런스 이미지 변환
    if (character.referenceImages && Array.isArray(character.referenceImages)) {
      console.log(`  📚 Converting ${character.referenceImages.length} reference images...`);
      const convertedRefs: string[] = [];
      
      for (const refUrl of character.referenceImages) {
        if (refUrl.includes('.png') || refUrl.startsWith('data:')) {
          const webpUrl = await convertImageToWebP(
            refUrl, 
            character.userId, 
            'reference'
          );
          if (webpUrl) {
            convertedRefs.push(webpUrl);
            characterConverted++;
          } else {
            convertedRefs.push(refUrl); // 실패시 원본 유지
            totalFailed++;
          }
        } else {
          convertedRefs.push(refUrl); // 이미 WebP면 유지
        }
      }
      
      if (convertedRefs.length > 0) {
        updates.referenceImages = convertedRefs;
      }
    }
    
    // 비율별 이미지 변환
    if (character.ratioImages && typeof character.ratioImages === 'object') {
      console.log('  📐 Converting ratio images...');
      const convertedRatios: Record<string, string[]> = {};
      
      for (const [ratio, urls] of Object.entries(character.ratioImages)) {
        if (Array.isArray(urls)) {
          const convertedUrls: string[] = [];
          
          for (const url of urls) {
            if (url.includes('.png') || url.startsWith('data:')) {
              const webpUrl = await convertImageToWebP(
                url, 
                character.userId, 
                `ratio-${ratio}`
              );
              if (webpUrl) {
                convertedUrls.push(webpUrl);
                characterConverted++;
              } else {
                convertedUrls.push(url); // 실패시 원본 유지
                totalFailed++;
              }
            } else {
              convertedUrls.push(url); // 이미 WebP면 유지
            }
          }
          
          convertedRatios[ratio] = convertedUrls;
        }
      }
      
      if (Object.keys(convertedRatios).length > 0) {
        updates.ratioImages = convertedRatios;
      }
    }
    
    // 데이터베이스 업데이트
    if (Object.keys(updates).length > 0) {
      console.log(`  💾 Updating database with ${Object.keys(updates).length} fields...`);
      const { error: updateError } = await supabase
        .from('character')
        .update(updates)
        .eq('id', character.id);
      
      if (updateError) {
        console.error(`  ❌ Failed to update character: ${updateError}`);
        totalFailed++;
      } else {
        console.log(`  ✅ Successfully converted ${characterConverted} images for "${character.name}"`);
        totalConverted += characterConverted;
      }
    } else {
      console.log('  ℹ️  No images to convert for this character');
    }
  }
  
  console.log('\n🎉 Conversion Summary:');
  console.log(`✅ Total images converted: ${totalConverted}`);
  console.log(`❌ Total failures: ${totalFailed}`);
  console.log(`📈 Success rate: ${totalConverted > 0 ? Math.round((totalConverted / (totalConverted + totalFailed)) * 100) : 0}%`);
}

// 스크립트 실행
if (require.main === module) {
  convertCharacterImages()
    .then(() => {
      console.log('\n✅ Conversion completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Conversion failed:', error);
      process.exit(1);
    });
}

export { convertCharacterImages };