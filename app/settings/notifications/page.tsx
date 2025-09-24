'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Bell,
  Mail,
  Smartphone,
  CreditCard,
  Image,
  TrendingUp,
  Settings,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Save
} from 'lucide-react';
import Link from 'next/link';

interface NotificationSettings {
  email: {
    billing: boolean;
    usage: boolean;
    updates: boolean;
    marketing: boolean;
  };
  push: {
    generation: boolean;
    billing: boolean;
    limits: boolean;
  };
  system: {
    maintenance: boolean;
    security: boolean;
  };
}

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    email: {
      billing: true,
      usage: true,
      updates: false,
      marketing: false,
    },
    push: {
      generation: true,
      billing: true,
      limits: true,
    },
    system: {
      maintenance: true,
      security: true,
    },
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // 초기 설정 로드
  useEffect(() => {
    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings/notifications');
      const data = await response.json();
      
      if (data.success) {
        const { emailNotifications, pushNotifications, preferences } = data.data;
        setSettings({
          email: {
            billing: emailNotifications?.subscriptionRenewal || true,
            usage: emailNotifications?.tokenLowWarning || true,
            updates: emailNotifications?.productUpdates || false,
            marketing: emailNotifications?.weeklyUsageReport || false,
          },
          push: {
            generation: pushNotifications?.tokenLowWarning || true,
            billing: pushNotifications?.subscriptionRenewal || false,
            limits: pushNotifications?.paymentFailure || true,
          },
          system: {
            maintenance: true,
            security: true,
          },
        });
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
      setMessage({ type: 'error', text: '설정 로딩 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (category: keyof NotificationSettings, key: string, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const settingsToSave = {
        emailNotifications: {
          tokenLowWarning: settings.email.usage,
          subscriptionRenewal: settings.email.billing,
          paymentFailure: true, // 항상 활성화
          weeklyUsageReport: settings.email.marketing,
          productUpdates: settings.email.updates
        },
        pushNotifications: {
          tokenLowWarning: settings.push.generation,
          subscriptionRenewal: settings.push.billing,
          paymentFailure: settings.push.limits,
          weeklyUsageReport: false
        },
        preferences: {
          tokenWarningThreshold: 20,
          weeklyReportDay: 'monday'
        }
      };

      const response = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settingsToSave)
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: '알림 설정이 성공적으로 저장되었습니다.' });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: '설정 저장 중 오류가 발생했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  const notificationCategories = [
    {
      title: '이메일 알림',
      icon: Mail,
      description: '중요한 정보를 이메일로 받아보세요',
      settings: [
        {
          key: 'billing',
          label: '결제 및 구독',
          description: '결제 완료, 구독 갱신, 결제 실패 등',
          value: settings.email.billing,
          onChange: (value: boolean) => handleSettingChange('email', 'billing', value),
        },
        {
          key: 'usage',
          label: '사용량 알림',
          description: '토큰 부족, 한도 초과 등',
          value: settings.email.usage,
          onChange: (value: boolean) => handleSettingChange('email', 'usage', value),
        },
        {
          key: 'updates',
          label: '제품 업데이트',
          description: '새로운 기능, 개선사항 등',
          value: settings.email.updates,
          onChange: (value: boolean) => handleSettingChange('email', 'updates', value),
        },
        {
          key: 'marketing',
          label: '마케팅 정보',
          description: '프로모션, 이벤트, 팁 등',
          value: settings.email.marketing,
          onChange: (value: boolean) => handleSettingChange('email', 'marketing', value),
        },
      ],
    },
    {
      title: '브라우저 알림',
      icon: Smartphone,
      description: '실시간 알림을 브라우저에서 받아보세요',
      settings: [
        {
          key: 'generation',
          label: '이미지 생성 완료',
          description: 'AI 이미지 생성이 완료되면 알림',
          value: settings.push.generation,
          onChange: (value: boolean) => handleSettingChange('push', 'generation', value),
        },
        {
          key: 'billing',
          label: '결제 알림',
          description: '결제 관련 중요한 알림',
          value: settings.push.billing,
          onChange: (value: boolean) => handleSettingChange('push', 'billing', value),
        },
        {
          key: 'limits',
          label: '한도 경고',
          description: '토큰이나 저장공간 부족 시 알림',
          value: settings.push.limits,
          onChange: (value: boolean) => handleSettingChange('push', 'limits', value),
        },
      ],
    },
    {
      title: '시스템 알림',
      icon: Settings,
      description: '시스템 관련 중요한 알림 (권장)',
      settings: [
        {
          key: 'maintenance',
          label: '유지보수 알림',
          description: '시스템 점검 및 업데이트 안내',
          value: settings.system.maintenance,
          onChange: (value: boolean) => handleSettingChange('system', 'maintenance', value),
        },
        {
          key: 'security',
          label: '보안 알림',
          description: '로그인, 비밀번호 변경 등 보안 관련',
          value: settings.system.security,
          onChange: (value: boolean) => handleSettingChange('system', 'security', value),
        },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">설정을 로딩하는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/settings">
                <Button variant="outline" size="sm" className="text-gray-600">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  돌아가기
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">알림 설정</h1>
                <p className="text-gray-600 mt-1">알림 방식과 빈도를 설정하세요</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {/* 메시지 표시 */}
        {message && (
          <div className={`mb-6 flex items-center gap-2 p-4 rounded-lg border ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        )}

        {/* 알림 설정 카테고리 */}
        <div className="space-y-6">
          {notificationCategories.map((category, index) => {
            const Icon = category.icon;
            
            return (
              <Card key={index} className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    {category.title}
                  </CardTitle>
                  <p className="text-sm text-gray-600">{category.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {category.settings.map((setting, settingIndex) => (
                      <div key={settingIndex} className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Label htmlFor={`${category.title}-${setting.key}`} className="text-sm font-medium text-gray-900">
                              {setting.label}
                            </Label>
                          </div>
                          <p className="text-xs text-gray-600">{setting.description}</p>
                        </div>
                        <Switch
                          id={`${category.title}-${setting.key}`}
                          checked={setting.value}
                          onCheckedChange={setting.onChange}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 저장 버튼 */}
        <div className="mt-8 flex justify-end">
          <Button 
            onClick={handleSaveSettings} 
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? '저장 중...' : '설정 저장'}
          </Button>
        </div>

        {/* 알림 테스트 */}
        <Card className="mt-6 border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              알림 테스트
            </CardTitle>
            <p className="text-sm text-gray-600">설정한 알림이 정상적으로 작동하는지 확인하세요</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Mail className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-blue-900">이메일 테스트</h3>
                    <p className="text-xs text-blue-700">테스트 이메일을 전송합니다</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full text-blue-600 border-blue-300">
                  테스트 이메일 보내기
                </Button>
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Smartphone className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-green-900">푸시 알림 테스트</h3>
                    <p className="text-xs text-green-700">브라우저 알림을 테스트합니다</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full text-green-600 border-green-300">
                  테스트 알림 보내기
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 주의사항 */}
        <Card className="mt-6 border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-orange-600">주의사항</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <p>시스템 알림은 서비스 이용에 필요한 중요한 정보이므로 끄지 않는 것을 권장합니다.</p>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <p>브라우저 알림을 받으려면 브라우저에서 알림 권한을 허용해야 합니다.</p>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <p>마케팅 정보 수신 거부 시에도 중요한 서비스 관련 알림은 계속 발송됩니다.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}