'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Bell,
  Mail,
  Smartphone,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Save
} from 'lucide-react';

interface NotificationSettingsProps {
  user: any;
}

export function NotificationSettings({ user }: NotificationSettingsProps) {
  const [settings, setSettings] = useState({
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
      tokenWarningThreshold: 20, // 20% 남았을 때 알림
      weeklyReportDay: 'monday'
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    try {
      const response = await fetch('/api/settings/notifications');
      const data = await response.json();
      
      if (data.success && data.data) {
        setSettings(prev => ({ ...prev, ...data.data }));
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      const data = await response.json();
      
      if (data.success) {
        alert('알림 설정이 저장되었습니다.');
      } else {
        alert(data.error || '설정 저장 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Save notification settings error:', error);
      alert('설정 저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const updateEmailSetting = (key: string, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      emailNotifications: {
        ...prev.emailNotifications,
        [key]: value
      }
    }));
  };

  const updatePushSetting = (key: string, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      pushNotifications: {
        ...prev.pushNotifications,
        [key]: value
      }
    }));
  };

  const notificationTypes = [
    {
      id: 'tokenLowWarning',
      title: '토큰 부족 알림',
      description: '토큰이 부족할 때 알림을 받습니다',
      icon: AlertTriangle,
      color: 'text-orange-600'
    },
    {
      id: 'subscriptionRenewal',
      title: '구독 갱신 알림',
      description: '구독 갱신일 전에 알림을 받습니다',
      icon: DollarSign,
      color: 'text-green-600'
    },
    {
      id: 'paymentFailure',
      title: '결제 실패 알림',
      description: '결제가 실패했을 때 즉시 알림을 받습니다',
      icon: AlertTriangle,
      color: 'text-red-600'
    },
    {
      id: 'weeklyUsageReport',
      title: '주간 사용량 리포트',
      description: '매주 사용량 요약을 받습니다',
      icon: TrendingUp,
      color: 'text-blue-600'
    },
    {
      id: 'productUpdates',
      title: '제품 업데이트',
      description: '새로운 기능 및 업데이트 소식을 받습니다',
      icon: Bell,
      color: 'text-purple-600'
    }
  ];

  return (
    <div className="space-y-6">
      {/* 이메일 알림 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            이메일 알림
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            이메일: {user?.email}
          </div>
          <div className="space-y-4">
            {notificationTypes.map((type) => {
              const Icon = type.icon;
              return (
                <div key={type.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${type.color}`} />
                    <div>
                      <p className="font-medium">{type.title}</p>
                      <p className="text-sm text-gray-600">{type.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.emailNotifications[type.id as keyof typeof settings.emailNotifications]}
                    onCheckedChange={(checked) => updateEmailSetting(type.id, checked)}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 푸시 알림 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-green-600" />
            브라우저 알림
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            브라우저에서 즉시 알림을 받습니다
          </div>
          <div className="space-y-4">
            {notificationTypes.filter(type => type.id !== 'productUpdates').map((type) => {
              const Icon = type.icon;
              return (
                <div key={type.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${type.color}`} />
                    <div>
                      <p className="font-medium">{type.title}</p>
                      <p className="text-sm text-gray-600">{type.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.pushNotifications[type.id as keyof typeof settings.pushNotifications]}
                    onCheckedChange={(checked) => updatePushSetting(type.id, checked)}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 알림 환경설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-purple-600" />
            알림 환경설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">토큰 부족 알림 기준</p>
                <p className="text-sm text-gray-600">남은 토큰이 이 비율 이하일 때 알림</p>
              </div>
              <select 
                className="px-3 py-2 border rounded-md"
                value={settings.preferences.tokenWarningThreshold}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  preferences: {
                    ...prev.preferences,
                    tokenWarningThreshold: parseInt(e.target.value)
                  }
                }))}
              >
                <option value={10}>10%</option>
                <option value={20}>20%</option>
                <option value={30}>30%</option>
                <option value={50}>50%</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">주간 리포트 발송일</p>
                <p className="text-sm text-gray-600">매주 사용량 리포트를 받을 요일</p>
              </div>
              <select 
                className="px-3 py-2 border rounded-md"
                value={settings.preferences.weeklyReportDay}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  preferences: {
                    ...prev.preferences,
                    weeklyReportDay: e.target.value
                  }
                }))}
              >
                <option value="monday">월요일</option>
                <option value="tuesday">화요일</option>
                <option value="wednesday">수요일</option>
                <option value="thursday">목요일</option>
                <option value="friday">금요일</option>
                <option value="saturday">토요일</option>
                <option value="sunday">일요일</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 저장 버튼 */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              저장 중...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              설정 저장
            </>
          )}
        </Button>
      </div>
    </div>
  );
}