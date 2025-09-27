import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendInquiryResponse } from "@/lib/email/resend";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 관리자 권한 확인
async function checkAdminAccess(supabase: any, user: any) {
  if (!user) return false;
  
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  return user.email === adminEmail;
}

// 개별 문의사항 상세 조회 API
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: inquiryId } = await params;
    
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    const hasAdminAccess = await checkAdminAccess(supabase, user);
    if (!hasAdminAccess) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    if (!inquiryId) {
      return NextResponse.json(
        { success: false, error: '문의사항 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 문의사항 상세 조회
    const { data: inquiry, error: fetchError } = await supabase
      .from('inquiry')
      .select(`
        id,
        subject,
        message,
        category,
        priority,
        status,
        adminResponse:admin_response,
        respondedBy:responded_by,
        respondedAt:responded_at,
        userEmail:user_email,
        userAgent:user_agent,
        ipAddress:ip_address,
        attachments,
        createdAt:created_at,
        updatedAt:updated_at,
        user:user_id (
          id,
          email,
          name,
          avatarUrl
        )
      `)
      .eq('id', inquiryId)
      .single();

    if (fetchError || !inquiry) {
      console.error('문의사항 상세 조회 오류:', fetchError);
      return NextResponse.json(
        { success: false, error: '문의사항을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      inquiry
    });

  } catch (error) {
    console.error("문의사항 상세 조회 API 오류:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "문의사항 조회 중 오류가 발생했습니다",
        details: process.env.NODE_ENV === 'development' ? 
          (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500 }
    );
  }
}

// 개별 문의사항 수정/답변 API
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: inquiryId } = await params;
    
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    const hasAdminAccess = await checkAdminAccess(supabase, user);
    if (!hasAdminAccess) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    if (!inquiryId) {
      return NextResponse.json(
        { success: false, error: '문의사항 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status, adminResponse, priority } = body;

    // 문의사항 존재 확인
    const { data: existingInquiry, error: fetchError } = await supabase
      .from('inquiry')
      .select('id, status, subject')
      .eq('id', inquiryId)
      .single();

    if (fetchError || !existingInquiry) {
      return NextResponse.json(
        { success: false, error: '문의사항을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 업데이트할 데이터 구성
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (status && ['pending', 'in_progress', 'resolved', 'closed'].includes(status)) {
      updateData.status = status;
    }

    if (priority && ['low', 'normal', 'high', 'urgent'].includes(priority)) {
      updateData.priority = priority;
    }

    if (adminResponse !== undefined) {
      if (adminResponse.trim()) {
        updateData.admin_response = adminResponse.trim();
        updateData.responded_by = user.email;
        updateData.responded_at = new Date().toISOString();
        
        // 답변이 추가되면 자동으로 상태 변경 (상태가 명시적으로 지정되지 않은 경우)
        if (!status) {
          // 답변이 작성되면 자동으로 "해결됨"으로 변경
          updateData.status = 'resolved';
        }
      } else {
        // 답변을 삭제하는 경우
        updateData.admin_response = null;
        updateData.responded_by = null;
        updateData.responded_at = null;
      }
    }

    // 업데이트할 내용이 있는지 확인
    const hasUpdates = Object.keys(updateData).length > 1; // updated_at 제외하고
    if (!hasUpdates) {
      return NextResponse.json(
        { success: false, error: '업데이트할 내용이 없습니다' },
        { status: 400 }
      );
    }

    // 문의사항 업데이트
    const { data: updatedInquiry, error: updateError } = await supabase
      .from('inquiry')
      .update(updateData)
      .eq('id', inquiryId)
      .select(`
        id,
        subject,
        message,
        category,
        priority,
        status,
        adminResponse:admin_response,
        respondedBy:responded_by,
        respondedAt:responded_at,
        attachments,
        createdAt:created_at,
        updatedAt:updated_at,
        userEmail:user_email,
        user:user_id (
          id,
          email,
          name
        )
      `)
      .single();

    if (updateError) {
      console.error('문의사항 업데이트 오류:', updateError);
      return NextResponse.json(
        { success: false, error: "문의사항 업데이트에 실패했습니다" },
        { status: 500 }
      );
    }

    console.log(`📋 [Admin] 문의사항 ${inquiryId} 업데이트 완료: ${existingInquiry.subject}`);

    // 답변이 추가된 경우 이메일 발송
    if (adminResponse && adminResponse.trim() && updatedInquiry) {
      console.log(`📧 [Admin] 이메일 발송 준비 중...`, {
        hasAdminResponse: !!adminResponse,
        hasUpdatedInquiry: !!updatedInquiry,
        userEmail: updatedInquiry.user?.email,
        inquiryId: updatedInquiry.id
      });

      try {
        const recipientEmail = updatedInquiry.user?.email || updatedInquiry.userEmail;
        const recipientName = updatedInquiry.user?.name;

        console.log(`📧 [Admin] 수신자 정보:`, {
          recipientEmail,
          recipientName,
          hasRecipientEmail: !!recipientEmail,
          userEmail: updatedInquiry.user?.email,
          userEmailField: updatedInquiry.userEmail
        });

        if (recipientEmail) {
          console.log(`📧 [Admin] sendInquiryResponse 호출 중...`);
          
          await sendInquiryResponse({
            userEmail: recipientEmail,
            userName: recipientName,
            subject: updatedInquiry.subject,
            originalMessage: updatedInquiry.message,
            adminResponse: adminResponse,
            inquiryId: updatedInquiry.id
          });

          console.log(`✅ [Admin] 답변 이메일 발송 성공: ${inquiryId} → ${recipientEmail}`);
        } else {
          console.warn(`⚠️  [Admin] 이메일 주소가 없어 발송하지 않음: ${inquiryId}`);;
        }
      } catch (emailError) {
        // 이메일 발송 실패는 로그만 남기고 API는 성공 처리
        console.error(`❌ [Admin] 답변 이메일 발송 실패: ${inquiryId}`, emailError);
        
        // 에러의 상세 정보도 로깅
        if (emailError instanceof Error) {
          console.error(`❌ [Admin] 에러 메시지: ${emailError.message}`);
          console.error(`❌ [Admin] 에러 스택: ${emailError.stack}`);
        }
      }
    } else {
      console.log(`🚫 [Admin] 이메일 발송 조건 미충족:`, {
        hasAdminResponse: !!(adminResponse && adminResponse.trim()),
        hasUpdatedInquiry: !!updatedInquiry
      });
    }

    return NextResponse.json({
      success: true,
      message: "문의사항이 성공적으로 업데이트되었습니다",
      inquiry: updatedInquiry
    });

  } catch (error) {
    console.error("문의사항 수정 API 오류:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "문의사항 수정 중 오류가 발생했습니다",
        details: process.env.NODE_ENV === 'development' ? 
          (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500 }
    );
  }
}

// 문의사항 삭제 API (관리자만)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: inquiryId } = await params;
    
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    const hasAdminAccess = await checkAdminAccess(supabase, user);
    if (!hasAdminAccess) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    if (!inquiryId) {
      return NextResponse.json(
        { success: false, error: '문의사항 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 문의사항 삭제 (실제 삭제)
    const { error: deleteError } = await supabase
      .from('inquiry')
      .delete()
      .eq('id', inquiryId);

    if (deleteError) {
      console.error('문의사항 삭제 오류:', deleteError);
      return NextResponse.json(
        { success: false, error: "문의사항 삭제에 실패했습니다" },
        { status: 500 }
      );
    }

    console.log(`🗑️ [Admin] 문의사항 ${inquiryId} 삭제 완료`);

    return NextResponse.json({
      success: true,
      message: "문의사항이 성공적으로 삭제되었습니다"
    });

  } catch (error) {
    console.error("문의사항 삭제 API 오류:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "문의사항 삭제 중 오류가 발생했습니다",
        details: process.env.NODE_ENV === 'development' ? 
          (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500 }
    );
  }
}