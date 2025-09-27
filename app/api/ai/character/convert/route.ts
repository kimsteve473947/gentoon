import { NextRequest, NextResponse } from 'next/server';
import { NanoBananaService } from '@/lib/ai/nano-banana-service';
import { createServiceClient } from '@/lib/supabase/service';

// 사람을 캐릭터로 변환하는 프롬프트 템플릿
function getPersonToCharacterPrompt(aspectRatio: string) {
  const isPortrait = aspectRatio === '4:5';
  const isSquare = aspectRatio === '1:1';
  
  let dimensionPrompt = '';
  if (isPortrait) {
    dimensionPrompt = ', portrait orientation (4:5 ratio), vertical composition';
  } else if (isSquare) {
    dimensionPrompt = ', square format (1:1 ratio), centered composition';
  }

  return `Transform this person's photo into a high-quality webtoon-style character illustration${dimensionPrompt}.

Style requirements:
- Clean, professional webtoon/manhwa art style
- Soft cell-shading with clean lineart
- Maintain the person's facial features, hair color, and overall appearance
- Convert to animated/cartoon style while keeping recognizable characteristics
- Bright, appealing color palette suitable for webtoons
- Character should look friendly and approachable
- Professional digital art quality

Technical specs:
- High resolution and crisp details
- Consistent lighting and shadows
- Clean background or simple gradient
- Character fills most of the frame${dimensionPrompt}
- Professional webtoon illustration quality

The result should be a polished character reference that maintains the person's key visual characteristics while being stylized for webtoon use.`;
}

export async function POST(request: NextRequest) {
  try {
    // FormData에서 이미지와 설정 추출
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const aspectRatio = formData.get('aspectRatio') as string || '4:5';

    if (!imageFile) {
      return NextResponse.json(
        { error: '이미지 파일이 필요합니다.' },
        { status: 400 }
      );
    }

    // 사용자 인증 확인 (개발 모드에서는 쿠키 기반)
    const supabase = createServiceClient();
    let userId = 'dev-user-id'; // 개발 모드 기본값
    
    // 개발 모드에서는 직접 사용자 정보 조회
    if (process.env.NODE_ENV === 'development') {
      try {
        // 개발 환경에서 첫 번째 사용자 사용
        const { data: users } = await supabase
          .from('user')
          .select('id')
          .limit(1);
        
        if (users && users.length > 0) {
          userId = users[0].id;
        }
      } catch (devError) {
        console.log('개발 모드 사용자 조회 실패, 기본값 사용');
      }
    }

    // 이미지를 base64로 변환하여 레퍼런스 이미지로 전달
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = imageFile.type;
    const referenceImageUrl = `data:${mimeType};base64,${base64Data}`;

    // NanoBananaService 사용
    const nanoBananaService = new NanoBananaService();
    
    // 프롬프트 생성
    const prompt = getPersonToCharacterPrompt(aspectRatio);

    console.log('🎨 사람→캐릭터 변환 시작:', {
      aspectRatio,
      imageSize: imageFile.size,
      mimeType,
      userId
    });

    // 기존 nano-banana-service 사용하여 이미지 생성
    const result = await nanoBananaService.generateWebtoonPanel(prompt, {
      userId,
      referenceImages: [referenceImageUrl], // 사람 사진을 레퍼런스로 전달
      aspectRatio: aspectRatio as '4:5' | '1:1',
      style: 'person_to_character'
    });

    console.log('✅ 사람→캐릭터 변환 완료:', {
      userId,
      tokensUsed: result.tokensUsed,
      aspectRatio
    });

    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
      tokensUsed: result.tokensUsed,
      generationTime: result.generationTime
    });

  } catch (error) {
    console.error('❌ 사람→캐릭터 변환 실패:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : '사람을 캐릭터로 변환하는데 실패했습니다.',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
}