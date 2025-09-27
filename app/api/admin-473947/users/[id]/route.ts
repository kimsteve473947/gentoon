import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tossRefundAPI } from '@/lib/payments/toss-refund';
import { cashReceiptAutomationService } from '@/lib/payments/cash-receipt-automation';

// 관리자 권한 확인
async function checkAdminAccess(supabase: any, user: any) {
  if (!user) return false;
  
  const { data: subscription } = await supabase
    .from('subscription')
    .select('plan')
    .eq('userId', user.id)
    .single();
  
  return subscription?.plan === 'ADMIN';
}

// GET: 특정 사용자 상세 정보 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: '로그인이 필요합니다'
      }, { status: 401 });
    }

    // 관리자 권한 확인
    const hasAdminAccess = await checkAdminAccess(supabase, user);
    if (!hasAdminAccess) {
      return NextResponse.json({
        success: false,
        error: '관리자 권한이 필요합니다'
      }, { status: 403 });
    }

    // 사용자 기본 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('user')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({
        success: false,
        error: '사용자를 찾을 수 없습니다'
      }, { status: 404 });
    }

    // 구독 정보 별도 조회
    const { data: subscriptionData } = await supabase
      .from('subscription')
      .select('*')
      .eq('userId', userId)
      .single();

    // 사용자 통계 조회
    const [
      { count: projectCount },
      { count: characterCount },
      { count: generationCount },
      { data: recentProjects },
      { data: recentActivities },
      { data: usageStats },
      { data: transactions }
    ] = await Promise.all([
      // 전체 프로젝트 수
      supabase
        .from('project')
        .select('*', { count: 'exact', head: true })
        .eq('userId', userId)
        .is('deletedAt', null),

      // 전체 캐릭터 수
      supabase
        .from('character')
        .select('*', { count: 'exact', head: true })
        .eq('userId', userId),

      // 전체 생성 수
      supabase
        .from('generation')
        .select('*', { count: 'exact', head: true })
        .eq('userId', userId),

      // 최근 프로젝트 5개
      supabase
        .from('project')
        .select('id, title, status, createdAt, lastEditedAt, panelCount')
        .eq('userId', userId)
        .is('deletedAt', null)
        .order('lastEditedAt', { ascending: false })
        .limit(5),

      // 최근 활동 10개
      supabase
        .from('user_activities')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),

      // 월별 사용량 통계
      supabase
        .from('user_usage_cache')
        .select('*')
        .eq('user_id', userId)
        .single(),

      // 최근 거래 내역 5개
      supabase
        .from('transaction')
        .select('*')
        .eq('userId', userId)
        .order('createdAt', { ascending: false })
        .limit(5)
    ]);

    // 이번 달 사용량 통계
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const { data: monthlyStats } = await supabase
      .from('daily_usage_stats')
      .select('*')
      .eq('user_id', userId)
      .gte('date', thisMonth.toISOString().split('T')[0]);

    const monthlyUsage = monthlyStats?.reduce((acc, stat) => ({
      tokens_used: acc.tokens_used + stat.tokens_used,
      images_generated: acc.images_generated + stat.images_generated,
      api_calls: acc.api_calls + stat.api_calls
    }), { tokens_used: 0, images_generated: 0, api_calls: 0 });

    return NextResponse.json({
      success: true,
      user: {
        ...userData,
        subscription: subscriptionData || {
          plan: 'FREE',
          tokensTotal: 10,
          tokensUsed: 0,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false
        },
        stats: {
          projectCount: projectCount || 0,
          characterCount: characterCount || 0,
          generationCount: generationCount || 0,
          monthlyUsage: monthlyUsage || { tokens_used: 0, images_generated: 0, api_calls: 0 }
        },
        recentProjects: recentProjects || [],
        recentActivities: recentActivities || [],
        usageStats: usageStats || null,
        transactions: transactions || []
      }
    });

  } catch (error) {
    console.error('사용자 상세 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '사용자 상세 조회 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}

// POST: 환불 처리
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: '로그인이 필요합니다'
      }, { status: 401 });
    }

    // 관리자 권한 확인
    const hasAdminAccess = await checkAdminAccess(supabase, user);
    if (!hasAdminAccess) {
      return NextResponse.json({
        success: false,
        error: '관리자 권한이 필요합니다'
      }, { status: 403 });
    }

    const body = await request.json();
    const { subscriptionId, payToken, amount, reason, refundType } = body;

    if (!payToken) {
      return NextResponse.json({
        success: false,
        error: '결제 토큰이 필요합니다'
      }, { status: 400 });
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json({
        success: false,
        error: '환불 사유를 5자 이상 입력해주세요'
      }, { status: 400 });
    }

    // 최근 거래 내역 조회
    const { data: transaction, error: transactionError } = await supabase
      .from('transaction')
      .select('*')
      .eq('userId', userId)
      .eq('tossPaymentKey', payToken)
      .single();

    if (transactionError || !transaction) {
      return NextResponse.json({
        success: false,
        error: '해당 결제 내역을 찾을 수 없습니다'
      }, { status: 404 });
    }

    // 이미 환불된 거래인지 확인
    if (transaction.status === 'REFUNDED') {
      return NextResponse.json({
        success: false,
        error: '이미 환불된 거래입니다'
      }, { status: 400 });
    }

    // 환불 금액 검증
    const refundAmount = refundType === 'PARTIAL' && amount ? parseInt(amount) : transaction.amount;
    if (refundAmount <= 0 || refundAmount > transaction.amount) {
      return NextResponse.json({
        success: false,
        error: `환불 금액은 1원 이상 ${transaction.amount.toLocaleString()}원 이하여야 합니다`
      }, { status: 400 });
    }

    console.log('🔄 환불 요청 시작:', {
      userId,
      subscriptionId,
      payToken,
      refundAmount,
      reason,
      refundType
    });

    // 토스페이먼츠 환불 API 호출
    const refundResponse = await tossRefundAPI.requestRefund({
      payToken,
      amount: refundType === 'PARTIAL' ? refundAmount : undefined,
      reason: reason.trim(),
      category: 'ADMIN_DECISION' as any,
      policyType: refundType === 'FULL' ? 'FULL_REFUND' as any : 'PARTIAL_CUSTOM' as any,
      originalAmount: transaction.amount,
      adminNote: `관리자 ${user.email}에 의한 환불 처리`
    });

    console.log('📦 토스페이먼츠 환불 응답:', refundResponse);

    if (!refundResponse.success) {
      return NextResponse.json({
        success: false,
        error: refundResponse.error || '환불 처리에 실패했습니다',
        details: refundResponse.details
      }, { status: 400 });
    }

    // 데이터베이스 업데이트: 거래 상태 변경
    const { error: updateTransactionError } = await supabase
      .from('transaction')
      .update({
        status: 'REFUNDED',
        refundedAt: new Date().toISOString(),
        refundAmount: refundResponse.refundedAmount,
        refundReason: reason.trim(),
        updatedAt: new Date().toISOString()
      })
      .eq('id', transaction.id);

    if (updateTransactionError) {
      console.error('거래 상태 업데이트 오류:', updateTransactionError);
    }

    // 환불 기록 추가
    const { error: refundRecordError } = await supabase
      .from('refund')
      .insert({
        id: refundResponse.refundNo,
        userId,
        transactionId: transaction.id,
        subscriptionId,
        originalAmount: transaction.amount,
        refundAmount: refundResponse.refundedAmount,
        refundType: refundType || 'FULL',
        reason: reason.trim(),
        status: 'COMPLETED',
        processedBy: user.id,
        processedAt: new Date().toISOString(),
        tossRefundData: refundResponse.details,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

    if (refundRecordError) {
      console.error('환불 기록 추가 오류:', refundRecordError);
    }

    // 구독 상태 업데이트 (전액 환불인 경우 구독 취소)
    if (refundType === 'FULL' && subscriptionId) {
      const { error: subscriptionUpdateError } = await supabase
        .from('subscription')
        .update({
          status: 'CANCELLED',
          cancelledAt: new Date().toISOString(),
          cancelReason: '환불로 인한 구독 취소',
          updatedAt: new Date().toISOString()
        })
        .eq('id', subscriptionId);

      if (subscriptionUpdateError) {
        console.error('구독 상태 업데이트 오류:', subscriptionUpdateError);
      }
    }

    // 🧾 현금영수증 자동 취소 처리
    try {
      await cashReceiptAutomationService.revokeCashReceiptForRefund(transaction.id);
      console.log(`현금영수증 자동 취소 완료: ${transaction.id}`);
    } catch (cashReceiptError) {
      // 현금영수증 취소 오류는 환불 성공에 영향을 주지 않음
      console.error('현금영수증 자동 취소 오류:', cashReceiptError);
    }

    // 사용자 활동 로그 추가
    await supabase
      .from('user_activities')
      .insert({
        user_id: userId,
        activity_type: 'refund_processed',
        activity_title: '환불 처리 완료',
        activity_description: `${refundResponse.refundedAmount.toLocaleString()}원 환불이 처리되었습니다. (관리자: ${user.email})`,
        metadata: {
          refund_no: refundResponse.refundNo,
          refund_amount: refundResponse.refundedAmount,
          refund_type: refundType,
          reason: reason.trim(),
          admin_user_id: user.id,
          transaction_id: transaction.id
        }
      });

    return NextResponse.json({
      success: true,
      refund: {
        refundNo: refundResponse.refundNo,
        refundAmount: refundResponse.refundedAmount,
        approvalTime: refundResponse.approvalTime
      },
      message: `환불이 성공적으로 처리되었습니다 (${refundResponse.refundedAmount.toLocaleString()}원)`
    });

  } catch (error) {
    console.error('💥 환불 처리 오류:', error);
    return NextResponse.json({
      success: false,
      error: '환불 처리 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}

// PATCH: 사용자 정보 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    console.log('🔄 사용자 수정 API 호출:', userId);
    
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('❌ 인증 오류:', authError);
      return NextResponse.json({
        success: false,
        error: '로그인이 필요합니다'
      }, { status: 401 });
    }

    // 관리자 권한 확인
    const hasAdminAccess = await checkAdminAccess(supabase, user);
    if (!hasAdminAccess) {
      console.log('❌ 권한 오류: 관리자 권한 없음');
      return NextResponse.json({
        success: false,
        error: '관리자 권한이 필요합니다'
      }, { status: 403 });
    }

    const body = await request.json();
    console.log('📦 요청 데이터:', body);
    
    const { 
      name, 
      role, 
      plan, 
      tokensTotal, 
      tokensUsed, 
      maxCharacters, 
      maxProjects,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      storageLimit
    } = body;

    // 사용자 기본 정보 업데이트
    const userUpdates: any = {};
    if (name !== undefined) userUpdates.name = name;
    if (role !== undefined) userUpdates.role = role;
    
    if (Object.keys(userUpdates).length > 0) {
      userUpdates.updatedAt = new Date().toISOString();
      console.log('👤 사용자 테이블 업데이트:', userUpdates);
      
      const { error: userUpdateError } = await supabase
        .from('user')
        .update(userUpdates)
        .eq('id', userId);

      if (userUpdateError) {
        console.error('❌ 사용자 테이블 업데이트 오류:', userUpdateError);
        throw userUpdateError;
      }
      console.log('✅ 사용자 테이블 업데이트 성공');
    }

    // 구독 정보 업데이트
    const subscriptionUpdates: any = {};
    if (plan !== undefined) subscriptionUpdates.plan = plan;
    if (tokensTotal !== undefined) subscriptionUpdates.tokensTotal = tokensTotal;
    if (tokensUsed !== undefined) subscriptionUpdates.tokensUsed = tokensUsed;
    if (maxCharacters !== undefined) subscriptionUpdates.maxCharacters = maxCharacters;
    if (maxProjects !== undefined) subscriptionUpdates.maxProjects = maxProjects;
    if (currentPeriodEnd !== undefined) subscriptionUpdates.currentPeriodEnd = new Date(currentPeriodEnd).toISOString();
    if (cancelAtPeriodEnd !== undefined) subscriptionUpdates.cancelAtPeriodEnd = cancelAtPeriodEnd;

    if (Object.keys(subscriptionUpdates).length > 0) {
      subscriptionUpdates.updatedAt = new Date().toISOString();
      console.log('📋 구독 테이블 업데이트:', subscriptionUpdates);
      
      // 먼저 구독이 존재하는지 확인
      const { data: existingSubscription, error: checkError } = await supabase
        .from('subscription')
        .select('id')
        .eq('userId', userId)
        .single();

      if (checkError && checkError.code === 'PGRST116') {
        // 구독이 없으면 생성
        console.log('📋 구독이 없음, 새로 생성');
        const { error: insertError } = await supabase
          .from('subscription')
          .insert({
            userId,
            ...subscriptionUpdates,
            createdAt: new Date().toISOString()
          });

        if (insertError) {
          console.error('❌ 구독 테이블 생성 오류:', insertError);
          throw insertError;
        }
        console.log('✅ 구독 테이블 생성 성공');
      } else if (checkError) {
        console.error('❌ 구독 확인 오류:', checkError);
        throw checkError;
      } else {
        // 구독이 있으면 업데이트
        const { error: subscriptionUpdateError } = await supabase
          .from('subscription')
          .update(subscriptionUpdates)
          .eq('userId', userId);

        if (subscriptionUpdateError) {
          console.error('❌ 구독 테이블 업데이트 오류:', subscriptionUpdateError);
          throw subscriptionUpdateError;
        }
        console.log('✅ 구독 테이블 업데이트 성공');
      }
    }

    // 스토리지 제한 업데이트
    if (storageLimit !== undefined) {
      await supabase
        .from('user_storage')
        .upsert({
          userId,
          max_bytes: storageLimit,
          updated_at: new Date().toISOString()
        });

      // user_usage_cache도 업데이트
      await supabase
        .from('user_usage_cache')
        .upsert({
          user_id: userId,
          storage_limit_bytes: storageLimit,
          updated_at: new Date().toISOString()
        });
    }

    // 수정된 사용자 정보 재조회 (분리해서 조회)
    const { data: updatedUser, error: fetchError } = await supabase
      .from('user')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('사용자 정보 재조회 오류:', fetchError);
      throw fetchError;
    }

    // 구독 정보 별도 조회
    const { data: updatedSubscription, error: subscriptionFetchError } = await supabase
      .from('subscription')
      .select('*')
      .eq('userId', userId)
      .single();

    if (subscriptionFetchError && subscriptionFetchError.code !== 'PGRST116') {
      console.error('구독 정보 재조회 오류:', subscriptionFetchError);
    }

    // 결합된 사용자 데이터 생성
    const combinedUserData = {
      ...updatedUser,
      subscription: updatedSubscription || {
        plan: 'FREE',
        tokensTotal: 10,
        tokensUsed: 0,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false
      }
    };

    // 활동 로그 추가
    await supabase
      .from('user_activities')
      .insert({
        user_id: userId,
        activity_type: 'admin_update',
        activity_title: '관리자에 의한 계정 정보 수정',
        activity_description: `관리자 ${user.email}에 의해 계정 정보가 수정되었습니다.`,
        metadata: {
          updated_fields: Object.keys({ ...userUpdates, ...subscriptionUpdates }),
          admin_user_id: user.id
        }
      });

    console.log('✅ 사용자 정보 수정 완료:', combinedUserData);

    return NextResponse.json({
      success: true,
      user: combinedUserData,
      message: '사용자 정보가 수정되었습니다'
    });

  } catch (error) {
    console.error('사용자 정보 수정 오류:', error);
    return NextResponse.json({
      success: false,
      error: '사용자 정보 수정 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}