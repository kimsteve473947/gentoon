import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 문의사항 전송 API
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "로그인이 필요합니다" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { subject, message, category = 'general', userEmail } = body;

    // 필수 필드 검증
    if (!subject || !message) {
      return NextResponse.json(
        { success: false, error: "제목과 내용은 필수입니다" },
        { status: 400 }
      );
    }

    // 제목과 내용 길이 검증
    if (subject.length > 200) {
      return NextResponse.json(
        { success: false, error: "제목은 200자를 초과할 수 없습니다" },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { success: false, error: "내용은 5000자를 초과할 수 없습니다" },
        { status: 400 }
      );
    }

    // 사용자 정보 조회
    const { data: userData } = await supabase
      .from('user')
      .select('id, email')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json(
        { success: false, error: "사용자 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 추가 정보 수집
    const headersList = headers();
    const userAgent = headersList.get('user-agent');
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    const ipAddress = forwardedFor?.split(',')[0] || realIp || 'unknown';

    // 우선순위 자동 설정 (카테고리에 따라)
    let priority = 'normal';
    if (category === 'billing' || category === 'technical') {
      priority = 'high';
    } else if (category === 'bug') {
      priority = 'high';
    }

    // 문의사항 생성
    const inquiryData = {
      userId: userData.id,
      subject: subject.trim(),
      message: message.trim(),
      category,
      priority,
      userEmail: userEmail || userData.email,
      userAgent,
      ipAddress,
    };

    const { data: inquiry, error: insertError } = await supabase
      .from('inquiry')
      .insert(inquiryData)
      .select(`
        id,
        subject,
        category,
        status,
        createdAt,
        user:user_id (
          email,
          name
        )
      `)
      .single();

    if (insertError) {
      console.error('문의사항 생성 오류:', insertError);
      return NextResponse.json(
        { success: false, error: "문의사항 전송에 실패했습니다" },
        { status: 500 }
      );
    }

    console.log(`📧 [Inquiry] 새로운 문의사항 생성: ${inquiry.id} - ${subject} (${category})`);

    return NextResponse.json({
      success: true,
      message: "문의사항이 성공적으로 전송되었습니다. 빠른 시일 내에 답변드리겠습니다.",
      inquiry: {
        id: inquiry.id,
        subject: inquiry.subject,
        category: inquiry.category,
        status: inquiry.status,
        createdAt: inquiry.createdAt
      }
    });

  } catch (error) {
    console.error("문의사항 API 오류:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "문의사항 전송 중 오류가 발생했습니다",
        details: process.env.NODE_ENV === 'development' ? 
          (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500 }
    );
  }
}

// 사용자의 문의사항 목록 조회 API
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "로그인이 필요합니다" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const status = searchParams.get('status');
    const category = searchParams.get('category');

    const offset = (page - 1) * limit;

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
        respondedAt:responded_at,
        createdAt:created_at,
        updatedAt:updated_at
      `)
      .eq('userId', userData.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 필터 적용
    if (status) {
      query = query.eq('status', status);
    }
    if (category) {
      query = query.eq('category', category);
    }

    const { data: inquiries, error: fetchError } = await query;

    if (fetchError) {
      console.error('문의사항 조회 오류:', fetchError);
      return NextResponse.json(
        { success: false, error: "문의사항 조회에 실패했습니다" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      inquiries: inquiries || [],
      pagination: {
        page,
        limit,
        hasMore: inquiries?.length === limit
      }
    });

  } catch (error) {
    console.error("문의사항 조회 API 오류:", error);
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