/**
 * 기본 캐릭터 설정 서비스
 * 신규 사용자를 위한 기본 캐릭터 생성 및 관리
 */

import { nanoBananaService } from '@/lib/ai/nano-banana-service';
import { createClient } from '@supabase/supabase-js';

// 기본 캐릭터 정보
const DEFAULT_CHARACTER = {
  name: '젠냥이',
  description: '귀여운 꿀벌 의상을 입은 고양이 캐릭터. 큰 파란 눈과 흰색 털, 노란색 꿀벌 후드를 착용하고 있습니다.',
  styleGuide: '애니메이션 스타일의 귀여운 캐릭터, 밝고 따뜻한 색감, 둥근 형태의 디자인',
  isPublic: true,
  userId: 'system' // 시스템 캐릭터로 설정
};

/**
 * 기본 캐릭터를 데이터베이스에 생성하는 함수
 */
export async function createDefaultCharacter() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // 서비스 롤 키 사용
  );

  console.log('🎭 기본 캐릭터 생성 시작...');

  try {
    // 1. 기존 기본 캐릭터가 있는지 확인
    const { data: existingCharacter } = await supabase
      .from('character')
      .select('id')
      .eq('userId', 'system')
      .eq('name', DEFAULT_CHARACTER.name)
      .single();

    if (existingCharacter) {
      console.log('✅ 기본 캐릭터가 이미 존재합니다:', existingCharacter.id);
      return existingCharacter.id;
    }

    // 2. 기본 이미지를 Base64로 변환
    const fs = await import('fs');
    const path = await import('path');
    
    const imagePath = path.join(process.cwd(), '../../../래퍼런스용.png');
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    console.log('📸 기본 이미지 로드 완료');

    // 3. AI로 1:1, 4:5 비율 이미지 생성
    console.log('🎨 1:1 비율 이미지 생성 중...');
    const square_result = await nanoBananaService.generateWebtoonPanel(
      `${DEFAULT_CHARACTER.description}. 정확히 동일한 캐릭터를 그려주세요.`,
      {
        userId: 'system',
        referenceImages: [dataUrl],
        aspectRatio: '1:1',
        characterDescriptions: new Map([['default', DEFAULT_CHARACTER.description]])
      }
    );

    console.log('🎨 4:5 비율 이미지 생성 중...');
    const portrait_result = await nanoBananaService.generateWebtoonPanel(
      `${DEFAULT_CHARACTER.description}. 정확히 동일한 캐릭터를 그려주세요.`,
      {
        userId: 'system',
        referenceImages: [dataUrl],
        aspectRatio: '4:5',
        characterDescriptions: new Map([['default', DEFAULT_CHARACTER.description]])
      }
    );

    // 4. 비율별 이미지 후처리 및 데이터 구성
    let processedPortraitUrl = portrait_result.imageUrl;
    
    // 4:5 이미지를 캔버스 크기에 맞게 후처리 (896×1152 → 896×1115)
    try {
      console.log('🔧 4:5 비율 이미지 후처리 시작: 캔버스 크기 맞춤');
      const { processGemini4to5ImageFromUrl } = await import('@/lib/utils/gemini-image-processor');
      
      // URL에서 이미지를 다운로드하고 후처리
      const processedBuffer = await processGemini4to5ImageFromUrl(portrait_result.imageUrl);
      
      // 후처리된 이미지를 base64로 변환하여 data URL로 저장
      const processedBase64 = processedBuffer.toString('base64');
      processedPortraitUrl = `data:image/png;base64,${processedBase64}`;
      
      console.log('✅ 4:5 비율 이미지 후처리 완료: 896×1115');
    } catch (processingError) {
      console.error('⚠️ 4:5 비율 후처리 실패, 원본 사용:', processingError);
    }
    
    const ratioImages = {
      '1:1': {
        url: square_result.imageUrl,
        width: 1024,
        height: 1024,
        generatedAt: new Date().toISOString()
      },
      '4:5': {
        url: processedPortraitUrl, // 후처리된 이미지 사용
        width: 896,
        height: 1115, // 후처리된 크기
        generatedAt: new Date().toISOString()
      }
    };

    // 5. 캐릭터를 데이터베이스에 저장
    const { data: character, error } = await supabase
      .from('character')
      .insert({
        ...DEFAULT_CHARACTER,
        referenceImages: [dataUrl], // 원본 레퍼런스 이미지
        ratioImages: ratioImages, // AI 생성 비율별 이미지
        thumbnailUrl: square_result.imageUrl, // 1:1 이미지를 썸네일로 사용
        metadata: {
          isDefault: true,
          createdBy: 'system',
          tokensUsed: square_result.tokensUsed + portrait_result.tokensUsed
        }
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log('✅ 기본 캐릭터 생성 완료:', character.id);
    console.log('📊 토큰 사용량:', square_result.tokensUsed + portrait_result.tokensUsed);
    
    return character.id;

  } catch (error) {
    console.error('❌ 기본 캐릭터 생성 실패:', error);
    throw error;
  }
}

/**
 * 모든 사용자가 접근 가능한 기본 캐릭터 목록 조회
 */
export async function getDefaultCharacters() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: characters, error } = await supabase
    .from('character')
    .select('*')
    .eq('userId', 'system')
    .eq('isPublic', true)
    .order('createdAt', { ascending: true });

  if (error) {
    console.error('기본 캐릭터 조회 실패:', error);
    return [];
  }

  return characters || [];
}

/**
 * 사용자의 캐릭터 목록에 기본 캐릭터도 포함해서 반환
 */
export async function getUserCharactersWithDefaults(userId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 사용자 개인 캐릭터와 기본 캐릭터를 함께 조회
  const { data: characters, error } = await supabase
    .from('character')
    .select('*')
    .or(`userId.eq.${userId},and(userId.eq.system,isPublic.eq.true)`)
    .order('createdAt', { ascending: false });

  if (error) {
    console.error('캐릭터 조회 실패:', error);
    return [];
  }

  return characters || [];
}

/**
 * 기본 캐릭터 초기화 (서버 시작시 또는 관리자 요청시 실행)
 */
export async function initializeDefaultCharacters() {
  try {
    console.log('🚀 기본 캐릭터 초기화 시작...');
    const characterId = await createDefaultCharacter();
    console.log('✅ 기본 캐릭터 초기화 완료:', characterId);
    return characterId;
  } catch (error) {
    console.error('❌ 기본 캐릭터 초기화 실패:', error);
    throw error;
  }
}