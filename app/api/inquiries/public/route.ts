import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiResponse } from "@/lib/auth/api-middleware";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1분 타임아웃 (파일 업로드 고려)

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 문의사항 API 호출 시작');
    
    const supabase = await createClient();
    console.log('✅ Supabase 클라이언트 생성 완료');
    
    // 로그인 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('👤 사용자 인증 확인:', { user: user?.id, authError });
    
    if (authError || !user) {
      console.log('❌ 인증 실패:', authError);
      return ApiResponse.unauthorized("문의하기는 로그인 후 이용 가능합니다");
    }

    const formData = await request.formData();
    console.log('📋 FormData 수신 완료');
    
    // 폼 데이터 추출
    const phone = formData.get('phone') as string;
    const email = formData.get('email') as string;
    const subject = formData.get('subject') as string || '제목 없음';
    const message = formData.get('message') as string;
    const category = formData.get('category') as string || 'general';
    
    console.log('📝 폼 데이터 추출:', { phone, email, subject, category, messageLength: message?.length });

    // 필수 필드 검증
    if (!phone || !email || !message) {
      return ApiResponse.badRequest("전화번호, 이메일, 문의내용은 필수입니다");
    }

    // 전화번호 형식 검증
    const phoneRegex = /^[0-9-+\s()]+$/;
    if (!phoneRegex.test(phone)) {
      return ApiResponse.badRequest("올바른 전화번호 형식을 입력해주세요");
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return ApiResponse.badRequest("올바른 이메일 주소를 입력해주세요");
    }
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
            console.log(`📁 파일 처리 시작: ${file.name} (${file.size} bytes, ${file.type})`);
            
            // 파일 크기 제한 (10MB)
            if (file.size > 10 * 1024 * 1024) {
              throw new Error(`파일 ${file.name}이 10MB를 초과합니다`);
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
              throw new Error(`지원되지 않는 파일 형식입니다: ${file.name}`);
            }

            // 파일명 생성 (타임스탬프 + 랜덤 + 원본파일명)
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2, 8);
            const safeFileName = file.name.replace(/[^a-zA-Z0-9.-_가-힣]/g, '_');
            const fileName = `inquiry-${timestamp}-${randomId}-${safeFileName}`;

            // Supabase Storage에 업로드 (기존 webtoon-images 버킷 사용)
            console.log(`📤 스토리지 업로드 시작: inquiries/${fileName}`);
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('webtoon-images')
              .upload(`inquiries/${fileName}`, file, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: false
              });

            console.log('📤 업로드 결과:', { uploadData, uploadError });

            if (uploadError) {
              console.error(`파일 업로드 실패 (${file.name}):`, uploadError);
              throw new Error(`파일 업로드 실패: ${file.name} - ${uploadError.message}`);
            }

            // 공개 URL 생성
            const { data: urlData } = supabase.storage
              .from('webtoon-images')
              .getPublicUrl(`inquiries/${fileName}`);

            attachments.push(urlData.publicUrl);
            console.log(`✅ 파일 업로드 완료: ${file.name} → ${fileName}`);
          } catch (error) {
            console.error(`파일 처리 오류 (${file.name}):`, error);
            throw error; // 상위로 오류 전파
          }
        }
      }
    }

    // 고유한 문의사항 ID 생성 (text 타입)
    const inquiryId = `inq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 첨부파일 정보를 메시지에 포함
    let finalMessage = `[전화번호: ${phone}]\n\n${message}`;
    if (attachments.length > 0) {
      finalMessage += `\n\n[첨부파일 ${attachments.length}개]\n${attachments.map((url, index) => `${index + 1}. ${url}`).join('\n')}`;
    }

    // 문의사항 데이터베이스에 저장
    const inquiryData = {
      subject,
      message: finalMessage,
      category,
      priority: 'normal' as const,
      status: 'pending' as const,
      userEmail: email, // user_email 매핑
      userId: user.id, // user_id 매핑
      userAgent: userAgent, // user_agent 매핑
      ipAddress: clientIp, // ip_address 매핑
    };

    console.log('💾 문의사항 데이터 저장 시도:', {
      subject,
      category,
      userPhone: phone,
      userEmail: email,
      userId: user.id,
      attachmentCount: attachments.length
    });

    console.log('💾 데이터베이스 삽입 시도:', inquiryData);
    
    const { data: inquiry, error: insertError } = await supabase
      .from('inquiry')
      .insert(inquiryData)
      .select()
      .single();

    console.log('💾 데이터베이스 삽입 결과:', { inquiry, insertError });

    if (insertError) {
      console.error('💥 문의사항 저장 실패 - 상세 오류:', {
        error: insertError,
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        data: inquiryData
      });
      return ApiResponse.error(`문의사항 저장 중 오류가 발생했습니다: ${insertError.message}`);
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
    console.error("오류 스택:", error instanceof Error ? error.stack : 'No stack available');
    
    return ApiResponse.error(
      "문의사항 처리 중 오류가 발생했습니다", 
      500,
      process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : String(error)) : undefined
    );
  }
}