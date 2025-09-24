import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiResponse } from "@/lib/auth/api-middleware";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1분 타임아웃 (파일 업로드 고려)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // 폼 데이터 추출
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const subject = formData.get('subject') as string || '제목 없음';
    const message = formData.get('message') as string;

    // 필수 필드 검증
    if (!name || !email || !message) {
      return ApiResponse.badRequest("이름, 이메일, 문의내용은 필수입니다");
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return ApiResponse.badRequest("올바른 이메일 주소를 입력해주세요");
    }

    const supabase = await createClient();
    const clientIp = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // 첨부파일 처리
    const attachments: string[] = [];
    const fileEntries = Array.from(formData.entries()).filter(([key]) => key.startsWith('file-'));

    if (fileEntries.length > 0) {
      console.log(`📎 ${fileEntries.length}개 첨부파일 처리 시작`);

      for (const [key, file] of fileEntries) {
        if (file instanceof File && file.size > 0) {
          try {
            // 파일 크기 제한 (10MB)
            if (file.size > 10 * 1024 * 1024) {
              return ApiResponse.badRequest(`파일 ${file.name}이 10MB를 초과합니다`);
            }

            // 허용된 파일 형식 검증
            const allowedTypes = [
              'image/jpeg', 'image/png', 'image/gif', 'image/webp',
              'application/pdf',
              'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'text/plain',
              'application/haansofthwp' // HWP 파일
            ];

            if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.hwp')) {
              return ApiResponse.badRequest(`지원되지 않는 파일 형식입니다: ${file.name}`);
            }

            // 파일명 생성 (타임스탬프 + 랜덤 + 원본파일명)
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2, 8);
            const safeFileName = file.name.replace(/[^a-zA-Z0-9.-_가-힣]/g, '_');
            const fileName = `inquiry-${timestamp}-${randomId}-${safeFileName}`;

            // Supabase Storage에 업로드 (기존 webtoon-images 버킷 사용)
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('webtoon-images')
              .upload(`inquiries/${fileName}`, file, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: false
              });

            if (uploadError) {
              console.error(`파일 업로드 실패 (${file.name}):`, uploadError);
              return ApiResponse.error(`파일 업로드 실패: ${file.name}`);
            }

            // 공개 URL 생성
            const { data: urlData } = supabase.storage
              .from('webtoon-images')
              .getPublicUrl(`inquiries/${fileName}`);

            attachments.push(urlData.publicUrl);
            console.log(`✅ 파일 업로드 완료: ${file.name} → ${fileName}`);
          } catch (error) {
            console.error(`파일 처리 오류 (${file.name}):`, error);
            return ApiResponse.error(`파일 처리 중 오류가 발생했습니다: ${file.name}`);
          }
        }
      }
    }

    // 문의사항 데이터베이스에 저장
    const inquiryData = {
      subject,
      message,
      category: 'general' as const,
      priority: 'normal' as const,
      status: 'pending' as const,
      userEmail: email,
      userId: null, // 공개 문의는 비로그인 사용자도 가능
      userAgent,
      ipAddress: clientIp,
      // 첨부파일 정보를 JSON으로 저장 (URL 배열)
      attachments: attachments.length > 0 ? attachments : null
    };

    const { data: inquiry, error: insertError } = await supabase
      .from('inquiry')
      .insert(inquiryData)
      .select()
      .single();

    if (insertError) {
      console.error('문의사항 저장 실패:', insertError);
      return ApiResponse.error("문의사항 저장 중 오류가 발생했습니다");
    }

    console.log(`📧 공개 문의사항 접수 완료: ${inquiry.id} (${email})`);
    console.log(`📎 첨부파일: ${attachments.length}개`);

    return ApiResponse.success({
      inquiryId: inquiry.id,
      message: "문의사항이 성공적으로 접수되었습니다",
      attachmentCount: attachments.length
    });

  } catch (error) {
    console.error("공개 문의사항 API 오류:", error);
    return ApiResponse.error("문의사항 처리 중 오류가 발생했습니다", 500);
  }
}