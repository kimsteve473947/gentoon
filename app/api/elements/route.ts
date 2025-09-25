import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { storageTracker } from "@/lib/storage/real-time-tracker";
import { canUploadFile } from "@/lib/storage/storage-manager";
import { webpOptimizer } from "@/lib/image/webp-optimizer";
import { SecureLogger } from "@/lib/utils/secure-logger";
import { getPlanConfig } from "@/lib/subscription/plan-config";
// import { prisma } from "@/lib/db/prisma"; // Temporarily disabled due to DB connection issues

// 요소 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 사용자 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    SecureLogger.elements('[Elements GET] Loading elements', user.id);

    // 사용자의 요소들 조회
    const { data: elements, error } = await supabase
      .from('element')
      .select('*')
      .eq('userId', user.id)
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('요소 조회 실패:', error);
      return NextResponse.json(
        { success: false, error: "요소 조회에 실패했습니다" },
        { status: 500 }
      );
    }

    // 구독 정보 조회하여 제한 정보 포함
    const { data: subscription } = await supabase
      .from('subscription')
      .select('plan')
      .eq('userId', user.id)
      .single();
    
    const planType = subscription?.plan || 'FREE';
    const planConfig = getPlanConfig(planType);
    
    const limitInfo = {
      currentCount: elements?.length || 0,
      maxElements: planConfig.maxElements,
      planType,
      canUpload: (elements?.length || 0) < planConfig.maxElements
    };

    return NextResponse.json({
      success: true,
      elements: elements || [],
      limitInfo
    });

  } catch (error) {
    console.error('요소 목록 조회 에러:', error);
    return NextResponse.json(
      { success: false, error: "서버 에러가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 요소 등록 (FormData 업로드)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 사용자 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    console.log(`[Elements POST] Creating element for user: ${user.id}`);

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const imageFile = formData.get('image') as File;

    // 필수 필드 검증
    if (!name || !imageFile) {
      return NextResponse.json(
        { success: false, error: "이름과 이미지는 필수입니다" },
        { status: 400 }
      );
    }

    // 파일 크기 및 타입 검증
    if (!imageFile.type.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: "이미지 파일만 업로드 가능합니다" },
        { status: 400 }
      );
    }

    if (imageFile.size > 10 * 1024 * 1024) { // 10MB 제한
      return NextResponse.json(
        { success: false, error: "이미지 크기는 10MB 이하여야 합니다" },
        { status: 400 }
      );
    }

    // 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('user')
      .select('id')
      .eq('id', user.id)
      .single();
    
    if (userError || !userData) {
      console.error('User data fetch error:', userError);
      return NextResponse.json(
        { success: false, error: "사용자 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 사용자 구독 정보 및 현재 요소 개수 확인
    const { data: subscription } = await supabase
      .from('subscription')
      .select('plan')
      .eq('userId', userData.id)
      .single();
    
    const { count } = await supabase
      .from('element')
      .select('id', { count: 'exact' })
      .eq('userId', userData.id);
    
    const currentElementCount = count || 0;
    
    // 구독이 없으면 FREE 플랜으로 간주
    const planType = subscription?.plan || 'FREE';
    const planConfig = getPlanConfig(planType);
    
    // 요소 개수 제한 검증 (ADMIN은 무제한)
    if (planType !== 'ADMIN' && currentElementCount >= planConfig.maxElements) {
      SecureLogger.warn('[Elements POST] Element limit exceeded', {
        userId: userData.id,
        currentCount: currentElementCount,
        limit: planConfig.maxElements,
        plan: planType
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: `요소 업로드 한도에 도달했습니다. (${currentElementCount}/${planConfig.maxElements})`,
          currentCount: currentElementCount,
          limit: planConfig.maxElements,
          planType
        },
        { status: 403 }
      );
    }

    // 파일 저장 공간 체크
    const canUpload = await canUploadFile(userData.id, imageFile.size);
    if (!canUpload.canUpload) {
      return NextResponse.json(
        { success: false, error: "저장 공간이 부족합니다" },
        { status: 413 }
      );
    }

    // 이미지를 WebP로 변환 및 최적화
    const imageBuffer = await imageFile.arrayBuffer();
    const responsiveSizes = await webpOptimizer.generateResponsiveSizes(Buffer.from(imageBuffer), 85);

    // Supabase Storage에 업로드
    const fileName = `element_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const imagePath = `elements/${userData.id}/${fileName}.webp`;
    const thumbnailPath = `elements/${userData.id}/${fileName}_thumb.webp`;

    // 메인 이미지 업로드 (large 사이즈 사용)
    const { data: imageUpload, error: imageError } = await supabase.storage
      .from('uploads')
      .upload(imagePath, responsiveSizes.large, {
        contentType: 'image/webp',
        upsert: false
      });

    if (imageError) {
      console.error('이미지 업로드 실패:', imageError);
      return NextResponse.json(
        { success: false, error: "이미지 업로드에 실패했습니다" },
        { status: 500 }
      );
    }

    // 썸네일 업로드 (thumbnail 사이즈 사용)
    const { data: thumbnailUpload, error: thumbnailError } = await supabase.storage
      .from('uploads')
      .upload(thumbnailPath, responsiveSizes.thumbnail, {
        contentType: 'image/webp',
        upsert: false
      });

    if (thumbnailError) {
      console.error('썸네일 업로드 실패:', thumbnailError);
      // 메인 이미지는 삭제하지 않고 계속 진행 (썸네일은 옵션)
    }

    // 공개 URL 생성
    const { data: imageUrl } = supabase.storage
      .from('uploads')
      .getPublicUrl(imagePath);

    const { data: thumbnailUrl } = supabase.storage
      .from('uploads')
      .getPublicUrl(thumbnailPath);

    // 데이터베이스에 요소 정보 저장
    const elementData = {
      id: `element_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      userId: userData.id,
      name: name,
      description: description || null,
      category: category || null,
      imageUrl: imageUrl.publicUrl,
      thumbnailUrl: thumbnailUrl.publicUrl,
      isPublic: false,
      isFavorite: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log(`[Elements POST] Inserting element data:`, elementData);

    const { data: element, error: dbError } = await supabase
      .from('element')
      .insert(elementData)
      .select()
      .single();

    if (dbError) {
      console.error('요소 DB 저장 실패:', dbError);
      
      // 업로드된 파일들 정리
      await supabase.storage.from('uploads').remove([imagePath, thumbnailPath]);
      
      return NextResponse.json(
        { success: false, error: "요소 저장에 실패했습니다" },
        { status: 500 }
      );
    }

    // 스토리지 사용량 업데이트
    await storageTracker.onImageGenerate(userData.id, {
      imageUrl: imageUrl.publicUrl,
      estimatedSize: responsiveSizes.large.length + (responsiveSizes.thumbnail?.length || 0)
    });

    console.log(`✅ 요소 생성 완료: ${element.name} (${element.id})`);

    return NextResponse.json({
      success: true,
      element: element
    });

  } catch (error) {
    console.error('요소 등록 에러:', error);
    return NextResponse.json(
      { success: false, error: "서버 에러가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 요소 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 사용자 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    console.log(`[Elements DELETE] Deleting element for user: ${user.id}`);

    const { searchParams } = new URL(request.url);
    const elementId = searchParams.get('id');

    if (!elementId) {
      return NextResponse.json(
        { success: false, error: "요소 ID가 필요합니다" },
        { status: 400 }
      );
    }

    // 요소 정보 조회
    const { data: element, error: findError } = await supabase
      .from('element')
      .select('*')
      .eq('id', elementId)
      .eq('userId', user.id)
      .single();

    if (findError || !element) {
      return NextResponse.json(
        { success: false, error: "요소를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // Storage에서 파일 삭제
    const imagePath = element.imageUrl.split('/').slice(-3).join('/'); // elements/userId/filename.webp
    const thumbnailPath = element.thumbnailUrl?.split('/').slice(-3).join('/');
    
    const filesToDelete = [imagePath];
    if (thumbnailPath) {
      filesToDelete.push(thumbnailPath);
    }

    await supabase.storage.from('uploads').remove(filesToDelete);

    // 데이터베이스에서 삭제
    const { error: deleteError } = await supabase
      .from('element')
      .delete()
      .eq('id', elementId)
      .eq('userId', user.id);

    if (deleteError) {
      console.error('요소 DB 삭제 실패:', deleteError);
      return NextResponse.json(
        { success: false, error: "요소 삭제에 실패했습니다" },
        { status: 500 }
      );
    }

    console.log(`✅ 요소 삭제 완료: ${element.name} (${elementId})`);

    return NextResponse.json({
      success: true,
      message: "요소가 삭제되었습니다"
    });

  } catch (error) {
    console.error('요소 삭제 에러:', error);
    return NextResponse.json(
      { success: false, error: "서버 에러가 발생했습니다" },
      { status: 500 }
    );
  }
}