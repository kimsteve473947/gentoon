'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UserData {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

interface SubscriptionData {
  plan: string;
  tokensTotal: number;
  tokensUsed: number;
  maxCharacters: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface UsageData {
  summary: {
    totalTokens: number;
    totalImages: number;
    totalCharacters: number;
    totalProjects: number;
    storageUsed: number;
    storageLimit: number;
  };
  dailyStats?: any[];
  period?: string;
}

interface SettingsData {
  userData: UserData | null;
  subscription: SubscriptionData | null;
  usage: UsageData;
  paymentHistory: any[];
  recentActivities?: any[];
}

export function useOptimizedSettings() {
  const [settingsData, setSettingsData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();


  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 사용자 데이터 가져오기
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증이 필요합니다');

      // 설정 데이터 API 호출
      const response = await fetch('/api/settings');
      const result = await response.json();
      
      if (!result.success) throw new Error(result.error);
      
      // 사용자 정보와 설정 데이터 결합
      const combinedData: SettingsData = {
        userData: {
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.name || user.email?.split('@')[0] || '사용자',
          avatarUrl: user.user_metadata?.avatar_url
        },
        subscription: result.data.subscription,
        usage: result.data.usage,
        paymentHistory: result.data.paymentHistory || [],
        recentActivities: result.data.recentActivities || []
      };
      
      setSettingsData(combinedData);
    } catch (error: any) {
      console.error('Settings loading error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const cancelSubscription = useCallback(async () => {
    try {
      setError(null);
      
      const response = await fetch('/api/settings', {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        await loadSettings();
        return { success: true, message: data.message };
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Cancel subscription error:', error);
      setError(error.message || '구독 해지 중 오류가 발생했습니다.');
      return { success: false, error: error.message };
    }
  }, [loadSettings]);

  const refreshSettings = useCallback(() => {
    return loadSettings();
  }, [loadSettings]);

  const updateUserProfile = useCallback(async (profileData: { name?: string; avatarUrl?: string }) => {
    try {
      setError(null);
      
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          name: profileData.name,
          avatar_url: profileData.avatarUrl
        }
      });
      
      if (updateError) throw updateError;
      
      await loadSettings();
      return { success: true };
    } catch (error: any) {
      console.error('Profile update error:', error);
      setError(error.message);
      return { success: false, error: error.message };
    }
  }, [supabase, loadSettings]);

  const deleteAccount = useCallback(async () => {
    try {
      setError(null);
      
      const response = await fetch('/api/settings/delete-account', {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        await supabase.auth.signOut();
        return { success: true, message: data.message };
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Delete account error:', error);
      setError(error.message);
      return { success: false, error: error.message };
    }
  }, [supabase]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settingsData,
    userData: settingsData?.userData,
    subscription: settingsData?.subscription,
    usage: settingsData?.usage,
    paymentHistory: settingsData?.paymentHistory || [],
    recentActivities: settingsData?.recentActivities || [],
    loading,
    error,
    refreshSettings,
    cancelSubscription,
    updateUserProfile,
    deleteAccount,
    hasData: !!settingsData,
    isEmpty: !settingsData && !loading
  };
}