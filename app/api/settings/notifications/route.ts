import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 알림 설정 조회
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

    // 사용자 알림 설정 조회
    const { data: notificationSettings } = await supabase
      .from('user_notification_settings')
      .select('*')
      .eq('userId', user.id)
      .single();

    // 기본 설정 반환 (설정이 없으면)
    const defaultSettings = {
      emailNotifications: {
        tokenLowWarning: true,
        subscriptionRenewal: true,
        paymentFailure: true,
        weeklyUsageReport: false,
        productUpdates: false
      },
      pushNotifications: {
        tokenLowWarning: true,
        subscriptionRenewal: false,
        paymentFailure: true,
        weeklyUsageReport: false
      },
      preferences: {
        tokenWarningThreshold: 20,
        weeklyReportDay: 'monday'
      }
    };

    return NextResponse.json({
      success: true,
      data: notificationSettings?.settings || defaultSettings
    });

  } catch (error) {
    console.error("Get notification settings error:", error);
    return NextResponse.json(
      { success: false, error: "알림 설정 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 알림 설정 업데이트
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

    const settings = await request.json();

    // 기존 설정 확인
    const { data: existingSettings } = await supabase
      .from('user_notification_settings')
      .select('*')
      .eq('userId', user.id)
      .single();

    if (existingSettings) {
      // 기존 설정 업데이트
      const { error } = await supabase
        .from('user_notification_settings')
        .update({ 
          settings,
          updatedAt: new Date().toISOString()
        })
        .eq('userId', user.id);

      if (error) throw error;
    } else {
      // 새 설정 생성
      const { error } = await supabase
        .from('user_notification_settings')
        .insert({
          userId: user.id,
          settings,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

      if (error) throw error;
    }

    return NextResponse.json({
      success: true,
      message: "알림 설정이 저장되었습니다"
    });

  } catch (error) {
    console.error("Update notification settings error:", error);
    return NextResponse.json(
      { success: false, error: "알림 설정 저장 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}