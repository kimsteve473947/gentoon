import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { storageTracker } from "@/lib/storage/real-time-tracker";
import { canCreateCharacter, autoSetStorageLimitBySubscription } from "@/lib/storage/storage-manager";
import { getUserCharactersWithDefaults } from "@/lib/services/default-character-setup";

// 캐릭터 등록
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { 
      name, 
      aliases = [], 
      description,
      visualFeatures,
      clothing,
      personality,
      referenceImages = [],
      ratioImages = null
    } = body;

    // 필수 필드 검증
    if (!name || !description) {
      return NextResponse.json(
        { success: false, error: "이름과 설명은 필수입니다" },
        { status: 400 }
      );
    }

    // 이름 변형 자동 생성
    const autoAliases = generateAliases(name);
    const allAliases = [...new Set([...aliases, ...autoAliases])];

    // 사용자 정보 조회
    const { data: userData } = await supabase
      .from('user')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json(
        { success: false, error: "사용자 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 🚀 스토리지 제한 자동 설정 (사용자의 구독 플랜에 따라)
    try {
      await autoSetStorageLimitBySubscription(userData.id);
    } catch (storageSetupError) {
      console.warn('스토리지 제한 설정 실패:', storageSetupError);
    }

    // 🚀 이미지 크기 추정 (레퍼런스 이미지들의 예상 크기)
    const estimatedImageSize = referenceImages.length * 2 * 1024 * 1024; // 이미지당 2MB 추정

    // 🚀 캐릭터 생성 가능 여부 체크 (스토리지 용량)
    const storageCheck = await canCreateCharacter(userData.id, estimatedImageSize);
    if (!storageCheck.canCreate) {
      return NextResponse.json(
        { 
          success: false,
          error: storageCheck.reason,
          upgradeRequired: storageCheck.upgradeRequired,
          errorType: 'STORAGE_LIMIT_EXCEEDED'
        },
        { status: 402 } // Payment Required
      );
    }

    // 구독 정보 확인 (캐릭터 개수 제한)
    const { data: subscription } = await supabase
      .from('subscription')
      .select('maxCharacters')
      .eq('userId', userData.id)
      .single();

    const { count: currentCharacterCount } = await supabase
      .from('character')
      .select('id', { count: 'exact' })
      .eq('userId', userData.id);

    const maxCharacters = subscription?.maxCharacters || 1;
    if ((currentCharacterCount || 0) >= maxCharacters) {
      return NextResponse.json(
        { 
          success: false, 
          error: `캐릭터 생성 한도를 초과했습니다 (${currentCharacterCount}/${maxCharacters})`,
          needsUpgrade: true
        },
        { status: 402 }
      );
    }

    // metadata 구성
    const metadata = {
      aliases: allAliases,
      visualFeatures: visualFeatures || {
        hairColor: "",
        hairStyle: "",
        eyeColor: "",
        faceShape: "",
        bodyType: "",
        height: "",
        age: "",
        gender: "",
        skinTone: "",
        distinctiveFeatures: []
      },
      clothing: clothing || {
        default: "",
        variations: []
      },
      personality: personality || ""
    };

    // 캐릭터 등록
    const { data: character, error: insertError } = await supabase
      .from('character')
      .insert({
        userId: userData.id,
        name,
        description,
        styleGuide: personality || "",
        referenceImages: referenceImages || [],
        ratioImages: ratioImages, // 비율별 이미지 추가
        metadata: metadata, // metadata 저장 추가
        thumbnailUrl: referenceImages && referenceImages.length > 0 ? referenceImages[0] : null,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // 🚀 실시간 스토리지 추적 - 캐릭터 생성
    await storageTracker.onCharacterCreate(userData.id, {
      referenceImages: referenceImages || [],
      ratioImages: ratioImages || {},
      thumbnailUrl: character.thumbnailUrl
    });

    return NextResponse.json({
      success: true,
      characterId: character.id,
      message: `캐릭터 '${name}'이(가) 등록되었습니다`,
      aliases: allAliases,
    });

  } catch (error) {
    console.error("Character registration error:", error);
    return NextResponse.json(
      { success: false, error: "캐릭터 등록 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 캐릭터 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const includeFrequent = searchParams.get("frequent") === "true";

    if (includeFrequent) {
      // 자주 사용하는 캐릭터 조회 (임시로 빈 배열 반환)
      return NextResponse.json({
        success: true,
        characters: [],
      });
    }

    // 사용자 정보 조회
    const { data: userData } = await supabase
      .from('user')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json(
        { success: false, error: "사용자 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 🚀 초고속 캐릭터 조회 - 캐시 활용
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    const { data: characters } = await supabase
      .from('character')
      .select('id, name, thumbnailUrl')
      .eq('userId', userData.id)
      .range(offset, offset + limit - 1);

    const formattedCharacters = characters || [];

    return NextResponse.json({
      success: true,
      characters: formattedCharacters,
    });

  } catch (error) {
    console.error("Get characters error:", error);
    return NextResponse.json(
      { success: false, error: "캐릭터 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 캐릭터 수정
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { characterId, ...updates } = body;

    if (!characterId) {
      return NextResponse.json(
        { success: false, error: "캐릭터 ID가 필요합니다" },
        { status: 400 }
      );
    }

    // 사용자 정보 조회
    const { data: userData } = await supabase
      .from('user')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json(
        { success: false, error: "사용자 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 캐릭터 업데이트
    const updateData: any = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.styleGuide !== undefined) updateData.styleGuide = updates.styleGuide;
    if (updates.referenceImages) {
      updateData.referenceImages = updates.referenceImages;
      updateData.thumbnailUrl = updates.referenceImages.length > 0 ? updates.referenceImages[0] : null;
    }
    if (updates.ratioImages !== undefined) updateData.ratioImages = updates.ratioImages; // 비율별 이미지 업데이트
    if (updates.isFavorite !== undefined) updateData.isFavorite = updates.isFavorite;
    
    // metadata 업데이트 (visualFeatures, clothing, personality, aliases 등)
    if (updates.visualFeatures || updates.clothing || updates.personality || updates.aliases) {
      const metadata: any = {};
      if (updates.aliases) metadata.aliases = updates.aliases;
      if (updates.visualFeatures) metadata.visualFeatures = updates.visualFeatures;
      if (updates.clothing) metadata.clothing = updates.clothing;
      if (updates.personality) metadata.personality = updates.personality;
      updateData.metadata = metadata;
    }
    
    updateData.updatedAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('character')
      .update(updateData)
      .eq('id', characterId)
      .eq('userId', userData.id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: "캐릭터를 찾을 수 없거나 권한이 없습니다" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "캐릭터가 업데이트되었습니다",
    });

  } catch (error) {
    console.error("Update character error:", error);
    return NextResponse.json(
      { success: false, error: "캐릭터 수정 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 캐릭터 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get("id");

    if (!characterId) {
      return NextResponse.json(
        { success: false, error: "캐릭터 ID가 필요합니다" },
        { status: 400 }
      );
    }

    // 사용자 정보 조회
    const { data: userData } = await supabase
      .from('user')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json(
        { success: false, error: "사용자 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 🎯 먼저 캐릭터 데이터 조회 (이미지 파일 정보 확인)
    const { data: character, error: fetchError } = await supabase
      .from('character')
      .select('id, name, referenceImages, ratioImages')
      .eq('id', characterId)
      .eq('userId', userData.id)
      .single();

    if (fetchError || !character) {
      return NextResponse.json(
        { success: false, error: "캐릭터를 찾을 수 없거나 권한이 없습니다" },
        { status: 404 }
      );
    }

    // 🗑️ Vercel Blob 파일들 삭제
    const imagesToDelete = [];
    
    // Reference Images 수집
    if (Array.isArray(character.referenceImages)) {
      imagesToDelete.push(...character.referenceImages);
    }
    
    // Ratio Images 수집
    if (character.ratioImages && typeof character.ratioImages === 'object') {
      Object.values(character.ratioImages).forEach((images: any) => {
        if (Array.isArray(images)) {
          imagesToDelete.push(...images);
        }
      });
    }

    console.log(`🗑️ 캐릭터 '${character.name}' 삭제 중... ${imagesToDelete.length}개 파일 삭제 예정`);

    // 🗑️ Supabase Storage 파일들 삭제 (실패해도 계속 진행)
    let deletedFileCount = 0;
    for (const imageUrl of imagesToDelete) {
      try {
        if (imageUrl && typeof imageUrl === 'string') {
          // Supabase Storage URL에서 파일 경로 추출
          // 예: https://lzxkvtwuatsrczhctsxb.supabase.co/storage/v1/object/public/character-images/characters/filename.png
          // -> characters/filename.png
          const urlParts = imageUrl.split('/storage/v1/object/public/character-images/');
          if (urlParts.length === 2) {
            const filePath = urlParts[1];
            
            // Supabase Storage에서 직접 삭제
            const { error: deleteError } = await supabase.storage
              .from('character-images')
              .remove([filePath]);
            
            if (!deleteError) {
              deletedFileCount++;
            } else {
              console.error(`파일 삭제 실패: ${filePath}`, deleteError);
            }
          }
        }
      } catch (fileError) {
        console.error(`파일 삭제 실패: ${imageUrl}`, fileError);
        // 파일 삭제 실패는 무시하고 계속 진행
      }
    }

    // 🚀 실시간 스토리지 추적 - 캐릭터 삭제 (DB 삭제 전에 호출)
    await storageTracker.onCharacterDelete(userData.id, {
      referenceImages: character.referenceImages || [],
      ratioImages: character.ratioImages || {},
      thumbnailUrl: character.thumbnailUrl
    });

    // 🗑️ DB 레코드 삭제
    const { error: deleteError } = await supabase
      .from('character')
      .delete()
      .eq('id', characterId);

    if (deleteError) {
      return NextResponse.json(
        { success: false, error: "캐릭터 삭제 중 오류가 발생했습니다" },
        { status: 500 }
      );
    }

    console.log(`✅ 캐릭터 '${character.name}' 삭제 완료: DB 레코드 + ${deletedFileCount}/${imagesToDelete.length}개 파일`);

    return NextResponse.json({
      success: true,
      message: "캐릭터가 삭제되었습니다",
      deletedImages: deletedFileCount,
      totalImages: imagesToDelete.length
    });

  } catch (error) {
    console.error("Delete character error:", error);
    return NextResponse.json(
      { success: false, error: "캐릭터 삭제 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 별칭 자동 생성 헬퍼
function generateAliases(name: string): string[] {
  const aliases: string[] = [];
  
  // 한국어 이름인 경우
  if (/[가-힣]/.test(name)) {
    const lastChar = name.charCodeAt(name.length - 1);
    const hasJongsung = (lastChar - 0xAC00) % 28 !== 0;
    
    if (hasJongsung) {
      aliases.push(name + "이");
      aliases.push(name + "아");
      aliases.push(name + "이가");
      aliases.push(name + "이는");
    } else {
      aliases.push(name + "야");
      aliases.push(name + "가");
      aliases.push(name + "는");
    }
    
    aliases.push(name + "씨");
    aliases.push(name + "님");
  }
  
  // 영어 이름인 경우
  if (/^[A-Za-z]+$/.test(name)) {
    aliases.push(name.toLowerCase());
    aliases.push(name.toUpperCase());
  }
  
  return aliases;
}

