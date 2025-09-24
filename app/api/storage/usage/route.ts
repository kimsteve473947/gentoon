import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserStorage, STORAGE_LIMITS, MembershipType, formatBytes } from "@/lib/storage/storage-manager";

// 🚀 Canva급 빠른 스토리지 사용량 API (실시간 트래커 기반)
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

    console.log(`⚡ [Storage] 사용자 ${user.id.slice(0, 8)}... 빠른 사용량 조회`);

    // 🚀 실시간 트래커에서 즉시 조회 (user_storage 테이블)
    const storageData = await getUserStorage(user.id);

    // 멤버십 조회 (구독별 할당량)
    const { data: subscription } = await supabase
      .from('subscription')
      .select('plan')
      .eq('userId', user.id)
      .single();

    const plan = (subscription?.plan as MembershipType) || 'FREE';
    const maxBytes = storageData.max_bytes || STORAGE_LIMITS[plan];

    // 사용률 및 상태 계산
    const usagePercentage = maxBytes > 0 
      ? Math.round((storageData.used_bytes / maxBytes) * 100)
      : 0;

    let status: 'normal' | 'warning' | 'critical' | 'full' = 'normal';
    if (usagePercentage >= 100) status = 'full';
    else if (usagePercentage >= 90) status = 'critical';
    else if (usagePercentage >= 75) status = 'warning';

    // 남은 용량 계산
    const remainingBytes = Math.max(0, maxBytes - storageData.used_bytes);
    const avgImageSize = 2 * 1024 * 1024; // 2MB per image
    const remainingImages = Math.floor(remainingBytes / avgImageSize);

    // 업그레이드 혜택 계산
    const upgradeBenefits = {
      PRO: plan !== 'PRO' ? {
        totalGB: Math.round(STORAGE_LIMITS.PRO / 1024 / 1024 / 1024),
        additionalGB: Math.max(0, Math.round((STORAGE_LIMITS.PRO - maxBytes) / 1024 / 1024 / 1024)),
        additionalImages: Math.max(0, Math.floor((STORAGE_LIMITS.PRO - maxBytes) / avgImageSize)),
        price: '월 30,000원'
      } : null,
      PREMIUM: plan !== 'PREMIUM' ? {
        totalGB: Math.round(STORAGE_LIMITS.PREMIUM / 1024 / 1024 / 1024),
        additionalGB: Math.max(0, Math.round((STORAGE_LIMITS.PREMIUM - maxBytes) / 1024 / 1024 / 1024)),
        additionalImages: Math.max(0, Math.floor((STORAGE_LIMITS.PREMIUM - maxBytes) / avgImageSize)),
        price: '월 100,000원'
      } : null
    };

    // 📱 사용자 친화적 응답 (Canva 스타일)
    const response = {
      success: true,
      storage: {
        // 기본 정보
        used: {
          bytes: storageData.used_bytes,
          mb: Math.round(storageData.used_bytes / 1024 / 1024),
          gb: Number((storageData.used_bytes / 1024 / 1024 / 1024).toFixed(2)),
          formatted: formatBytes(storageData.used_bytes)
        },
        total: {
          bytes: maxBytes,
          mb: Math.round(maxBytes / 1024 / 1024),
          gb: Number((maxBytes / 1024 / 1024 / 1024).toFixed(2)),
          formatted: formatBytes(maxBytes)
        },
        remaining: {
          bytes: remainingBytes,
          mb: Math.round(remainingBytes / 1024 / 1024),
          gb: Number((remainingBytes / 1024 / 1024 / 1024).toFixed(2)),
          formatted: formatBytes(remainingBytes),
          estimatedImages: remainingImages
        },

        // 상태
        usage: {
          percentage: usagePercentage,
          status,
          fileCount: storageData.file_count || 0,
          plan
        },

        // UI 표시용 메시지
        statusMessage: {
          normal: '충분한 저장 공간이 있습니다',
          warning: '저장 공간이 부족해지고 있습니다',
          critical: '저장 공간이 거의 가득 찼습니다',
          full: '저장 공간이 가득 찼습니다'
        }[status],

        // 업그레이드 혜택 (가득 찼을 때만 표시)
        upgrades: usagePercentage >= 75 ? upgradeBenefits : null
      },
      timestamp: new Date().toISOString()
    };

    console.log(`✅ [Storage] 빠른 조회 완료: ${usagePercentage}% (${response.storage.used.formatted}/${response.storage.total.formatted})`);

    return NextResponse.json(response);

  } catch (error) {
    console.error("❌ [Storage] 사용량 조회 실패:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "스토리지 사용량 조회 중 오류가 발생했습니다",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}