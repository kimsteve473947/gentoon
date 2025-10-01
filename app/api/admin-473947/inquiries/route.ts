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

// 관리자용 문의사항 목록 조회 API
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const offset = (page - 1) * limit;

    // 쿼리 구성
    let query = supabase
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
          name
        )
      `)
      .range(offset, offset + limit - 1);

    // 필터 적용
    if (status) {
      if (status === 'unanswered') {
        // 미답변 필터: admin_response가 null인 경우
        query = query.is('admin_response', null);
      } else if (status === 'answered') {
        // 답변완료 필터: admin_response가 있는 경우
        query = query.not('admin_response', 'is', null);
      } else {
        // 기본 상태 필터
        query = query.eq('status', status);
      }
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (priority) {
      query = query.eq('priority', priority);
    }
    if (search) {
      query = query.or(`subject.ilike.%${search}%,message.ilike.%${search}%`);
    }

    // 정렬 적용 - 우선순위: 미답변 → 최신순
    const ascending = sortOrder === 'asc';
    
    // 답변 상태에 따른 우선순위 정렬 (미답변 우선)
    query = query
      .order('admin_response', { ascending: true, nullsFirst: true }) // null이 먼저 (미답변 우선)
      .order(sortBy, { ascending });

    const { data: inquiries, error: fetchError } = await query;

    if (fetchError) {
      console.error('관리자 문의사항 조회 오류:', fetchError);
      return NextResponse.json(
        { success: false, error: "문의사항 조회에 실패했습니다" },
        { status: 500 }
      );
    }

    // 통계 정보 조회
    const [
      { count: totalCount },
      { count: pendingCount },
      { count: inProgressCount },
      { count: resolvedCount }
    ] = await Promise.all([
      supabase.from('inquiry').select('id', { count: 'exact', head: true }),
      supabase.from('inquiry').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('inquiry').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
      supabase.from('inquiry').select('id', { count: 'exact', head: true }).eq('status', 'resolved')
    ]);

    return NextResponse.json({
      success: true,
      inquiries: inquiries || [],
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
        hasNextPage: page * limit < (totalCount || 0),
        hasPreviousPage: page > 1,
        itemCount: inquiries?.length || 0
      },
      stats: {
        total: totalCount || 0,
        pending: pendingCount || 0,
        inProgress: inProgressCount || 0,
        resolved: resolvedCount || 0,
        closed: (totalCount || 0) - (pendingCount || 0) - (inProgressCount || 0) - (resolvedCount || 0)
      }
    });

  } catch (error) {
    console.error("관리자 문의사항 조회 API 오류:", error);
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

// 관리자용 문의사항 상태 업데이트 및 답변 API
export async function PATCH(request: NextRequest) {
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
    const { inquiryId, status, adminResponse, priority } = body;

    if (!inquiryId) {
      return NextResponse.json(
        { success: false, error: '문의사항 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 문의사항 존재 확인
    const { data: existingInquiry, error: fetchError } = await supabase
      .from('inquiry')
      .select('id, status')
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

    if (status) {
      updateData.status = status;
    }

    if (priority) {
      updateData.priority = priority;
    }

    if (adminResponse) {
      updateData.admin_response = adminResponse.trim();
      updateData.responded_by = user.email;
      updateData.responded_at = new Date().toISOString();
      
      // 답변이 추가되면 상태를 적절히 변경
      if (!status) {
        updateData.status = existingInquiry.status === 'pending' ? 'in_progress' : existingInquiry.status;
      }
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
        userEmail:user_email,
        attachments,
        createdAt:created_at,
        updatedAt:updated_at,
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

    console.log(`📋 [Admin] 문의사항 업데이트: ${inquiryId} - 상태: ${updateData.status || existingInquiry.status}, 답변자: ${user.email}`);

    // 답변이 추가된 경우 이메일 발송
    if (adminResponse && updatedInquiry) {
      console.log(`📧 [Admin] 이메일 발송 준비 중...`);

      try {
        // 계정 이메일로 발송 (이메일 필드가 읽기 전용이므로 계정 이메일과 동일함)
        const recipientEmail = updatedInquiry.user?.email || updatedInquiry.userEmail;
        const recipientName = updatedInquiry.user?.name;

        console.log(`📧 [Admin] 이메일 발송 대상:`, {
          ACCOUNT_EMAIL: updatedInquiry.user?.email,
          USER_EMAIL_FIELD: updatedInquiry.userEmail,
          FINAL_RECIPIENT: recipientEmail
        });

        if (recipientEmail) {
          await sendInquiryResponse({
            userEmail: recipientEmail, // 계정 이메일로 발송
            userName: recipientName,
            subject: updatedInquiry.subject,
            originalMessage: updatedInquiry.message,
            adminResponse: adminResponse,
            inquiryId: updatedInquiry.id
          });

          console.log(`✅ [Admin] 답변 이메일 발송 성공: ${inquiryId} → ${recipientEmail}`);
        } else {
          console.error(`❌ [Admin] 사용자 입력 이메일이 없음: ${inquiryId}`);
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
        hasAdminResponse: !!adminResponse,
        hasUpdatedInquiry: !!updatedInquiry
      });
    }

    return NextResponse.json({
      success: true,
      message: "문의사항이 성공적으로 업데이트되었습니다",
      inquiry: updatedInquiry
    });

  } catch (error) {
    console.error("관리자 문의사항 업데이트 API 오류:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "문의사항 업데이트 중 오류가 발생했습니다",
        details: process.env.NODE_ENV === 'development' ? 
          (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500 }
    );
  }
}