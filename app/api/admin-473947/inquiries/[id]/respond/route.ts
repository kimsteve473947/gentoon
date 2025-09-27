import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendInquiryResponse } from '@/lib/email/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 관리자 권한 확인
async function checkAdminAccess(supabase: any, user: any) {
  if (!user) return false;
  
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  return user.email === adminEmail;
}

// 문의사항 답변 API
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    const body = await request.json();
    const { response } = body;

    if (!response || !response.trim()) {
      return NextResponse.json(
        { success: false, error: '답변 내용을 입력해주세요' },
        { status: 400 }
      );
    }

    // 문의사항 존재 확인 및 사용자 이메일 정보 가져오기
    const { data: inquiry, error: fetchError } = await supabase
      .from('inquiry')
      .select(`
        id,
        subject,
        message,
        user_email,
        status,
        user_id
      `)
      .eq('id', params.id)
      .single();

    if (fetchError || !inquiry) {
      return NextResponse.json(
        { success: false, error: '문의사항을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 답변 저장 및 상태 업데이트
    const updateData = {
      admin_response: response.trim(),
      admin_response_by: user.email,
      admin_response_at: new Date().toISOString(),
      status: inquiry.status === 'pending' ? 'in_progress' : inquiry.status,
      updated_at: new Date().toISOString()
    };

    const { data: updatedInquiry, error: updateError } = await supabase
      .from('inquiry')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('답변 저장 오류:', updateError);
      return NextResponse.json(
        { success: false, error: '답변 저장에 실패했습니다' },
        { status: 500 }
      );
    }

    // 이메일 발송 (Resend 시스템)
    try {
      const recipientEmail = inquiry.user_email;
      
      if (recipientEmail) {
        console.log(`📧 답변 이메일 발송 준비: ${params.id} → ${recipientEmail}`);
        
        await sendInquiryResponse({
          userEmail: recipientEmail,
          subject: inquiry.subject,
          originalMessage: inquiry.message,
          adminResponse: response,
          inquiryId: inquiry.id
        });
        
        console.log(`✅ 답변 이메일 발송 완료: ${params.id}`);
      } else {
        console.warn(`⚠️  이메일 주소가 없어 발송하지 않음: ${params.id}`);
      }
    } catch (emailError) {
      console.error(`❌ 답변 이메일 발송 실패: ${params.id}`, emailError);
      // 이메일 발송 실패는 로그만 남기고 API는 성공 처리
    }

    console.log(`💬 관리자 답변 완료: ${params.id} by ${user.email}`);

    return NextResponse.json({
      success: true,
      message: '답변이 성공적으로 전송되었습니다',
      inquiry: updatedInquiry
    });

  } catch (error) {
    console.error('답변 처리 오류:', error);
    return NextResponse.json(
      { success: false, error: '답변 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}