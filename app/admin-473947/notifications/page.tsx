'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Bell, 
  Mail, 
  Send, 
  Users, 
  AlertTriangle, 
  CheckCircle,
  Eye,
  ArrowLeft,
  Plus,
  History
} from 'lucide-react';
import Link from 'next/link';
import { useOptimizedSettings } from '@/hooks/useOptimizedSettings';
import { useRouter } from 'next/navigation';

// 알림 템플릿 타입
interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  type: 'marketing' | 'system' | 'announcement';
  created_at: string;
  sent_count: number;
}

// 발송 기록 타입
interface EmailHistory {
  id: string;
  subject: string;
  recipient_count: number;
  sent_at: string;
  status: 'sent' | 'failed' | 'pending';
  open_rate: number;
  click_rate: number;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { subscription, loading } = useOptimizedSettings();
  const [activeTab, setActiveTab] = useState<'send' | 'templates' | 'history'>('send');
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [emailHistory, setEmailHistory] = useState<EmailHistory[]>([]);
  const [userCount, setUserCount] = useState(0);
  
  // 이메일 발송 폼
  const [emailForm, setEmailForm] = useState({
    recipients: 'all', // 'all' | 'free' | 'premium' | 'custom'
    subject: '',
    content: '',
    customEmails: ''
  });
  
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (!loading && subscription?.plan !== 'ADMIN') {
      router.push('/admin');
      return;
    }
    
    loadTemplates();
    loadEmailHistory();
    loadUserCount();
  }, [loading, subscription, router]);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/admin-473947/notifications/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('템플릿 로드 실패:', error);
    }
  };

  const loadEmailHistory = async () => {
    try {
      const response = await fetch('/api/admin-473947/notifications/history');
      if (response.ok) {
        const data = await response.json();
        setEmailHistory(data.history || []);
      }
    } catch (error) {
      console.error('발송 기록 로드 실패:', error);
    }
  };

  const loadUserCount = async () => {
    try {
      const response = await fetch('/api/admin-473947/users/count');
      if (response.ok) {
        const data = await response.json();
        setUserCount(data.count || 0);
      }
    } catch (error) {
      console.error('사용자 수 로드 실패:', error);
    }
  };

  const handleSendEmail = async () => {
    if (!emailForm.subject || !emailForm.content) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }

    setSendStatus('sending');
    
    try {
      const response = await fetch('/api/admin-473947/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailForm),
      });

      const data = await response.json();
      
      if (response.ok) {
        setSendStatus('success');
        setEmailForm({
          recipients: 'all',
          subject: '',
          content: '',
          customEmails: ''
        });
        loadEmailHistory(); // 발송 기록 새로고침
        
        setTimeout(() => {
          setSendStatus('idle');
        }, 3000);
      } else {
        setSendStatus('error');
        alert(data.error || '이메일 발송에 실패했습니다.');
      }
    } catch (error) {
      console.error('이메일 발송 실패:', error);
      setSendStatus('error');
      alert('이메일 발송 중 오류가 발생했습니다.');
    }
  };

  const getRecipientCount = () => {
    switch (emailForm.recipients) {
      case 'all':
        return userCount;
      case 'free':
        return Math.floor(userCount * 0.8); // 임시 추정
      case 'premium':
        return Math.floor(userCount * 0.2); // 임시 추정
      case 'custom':
        return emailForm.customEmails.split(',').filter(email => email.trim()).length;
      default:
        return 0;
    }
  };

  if (loading || subscription?.plan !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Bell className="h-8 w-8 animate-pulse mx-auto mb-4 text-amber-600" />
          <p className="text-gray-600">권한 확인 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                관리자 대시보드
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <Bell className="h-8 w-8 text-amber-600" />
            <h1 className="text-3xl font-bold text-gray-900">알림 & 이메일 관리</h1>
          </div>
          <p className="text-gray-600">사용자에게 이메일을 발송하고 알림을 관리합니다.</p>
        </div>

        {/* 탭 네비게이션 */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'send', label: '이메일 발송', icon: Send },
                { key: 'templates', label: '템플릿 관리', icon: Mail },
                { key: 'history', label: '발송 기록', icon: History },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as any)}
                  className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === key
                      ? 'border-amber-500 text-amber-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* 이메일 발송 탭 */}
        {activeTab === 'send' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  이메일 발송
                </CardTitle>
                <CardDescription>
                  사용자에게 마케팅 이메일이나 공지사항을 발송합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 수신자 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    수신자 ({getRecipientCount().toLocaleString()}명)
                  </label>
                  <select
                    value={emailForm.recipients}
                    onChange={(e) => setEmailForm({ ...emailForm, recipients: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="all">전체 사용자</option>
                    <option value="free">무료 플랜 사용자</option>
                    <option value="paid">유료 플랜 사용자</option>
                    <option value="starter">스타터 플랜</option>
                    <option value="pro">프로 플랜</option>
                    <option value="premium">프리미엄 플랜</option>
                    <option value="inactive">비활성 사용자 (30일 이상)</option>
                    <option value="active">활성 사용자 (7일 이내)</option>
                    <option value="custom">직접 입력</option>
                  </select>
                </div>

                {/* 커스텀 이메일 입력 */}
                {emailForm.recipients === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      이메일 주소 (쉼표로 구분)
                    </label>
                    <Textarea
                      value={emailForm.customEmails}
                      onChange={(e) => setEmailForm({ ...emailForm, customEmails: e.target.value })}
                      placeholder="user1@example.com, user2@example.com"
                      rows={3}
                    />
                  </div>
                )}

                {/* 제목 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    제목
                  </label>
                  <Input
                    value={emailForm.subject}
                    onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                    placeholder="이메일 제목을 입력하세요"
                  />
                </div>

                {/* 내용 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    내용
                  </label>
                  <Textarea
                    value={emailForm.content}
                    onChange={(e) => setEmailForm({ ...emailForm, content: e.target.value })}
                    placeholder="이메일 내용을 입력하세요"
                    rows={10}
                  />
                </div>

                {/* 발송 버튼 */}
                <div className="flex justify-end">
                  <Button
                    onClick={handleSendEmail}
                    disabled={sendStatus === 'sending'}
                    className="flex items-center gap-2"
                  >
                    {sendStatus === 'sending' ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        발송 중...
                      </>
                    ) : sendStatus === 'success' ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        발송 완료
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        이메일 발송
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 템플릿 관리 탭 */}
        {activeTab === 'templates' && (
          <div>
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      이메일 템플릿
                    </CardTitle>
                    <CardDescription>
                      자주 사용하는 이메일 템플릿을 관리합니다.
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={() => setIsCreatingTemplate(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    새 템플릿
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {templates.length > 0 ? (
                  <div className="space-y-4">
                    {templates.map((template) => (
                      <div key={template.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-gray-900">{template.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">{template.subject}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline">
                                {template.type === 'marketing' ? '마케팅' : 
                                 template.type === 'system' ? '시스템' : '공지사항'}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {template.sent_count}회 발송
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleUseTemplate(template)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              사용
                            </Button>
                            <Button variant="ghost" size="sm">
                              수정
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600">
                              삭제
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Mail className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">저장된 템플릿이 없습니다</p>
                    <p className="text-sm text-gray-400">새 템플릿을 만들어보세요</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* 발송 기록 탭 */}
        {activeTab === 'history' && (
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  발송 기록
                </CardTitle>
                <CardDescription>
                  이메일 발송 기록과 성과를 확인합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {emailHistory.length > 0 ? (
                  <div className="space-y-4">
                    {emailHistory.map((record) => (
                      <div key={record.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-gray-900">{record.subject}</h3>
                            <p className="text-sm text-gray-600 mt-1">
                              {record.recipient_count.toLocaleString()}명에게 발송
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(record.sent_at).toLocaleString('ko-KR')}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge className={
                              record.status === 'sent' ? 'bg-green-100 text-green-700' :
                              record.status === 'failed' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }>
                              {record.status === 'sent' ? '발송완료' :
                               record.status === 'failed' ? '발송실패' : '발송중'}
                            </Badge>
                            {record.status === 'sent' && (
                              <div className="mt-2 text-sm">
                                <p className="text-gray-600">
                                  열람률: {(record.open_rate * 100).toFixed(1)}%
                                </p>
                                <p className="text-gray-600">
                                  클릭률: {(record.click_rate * 100).toFixed(1)}%
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <History className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">발송 기록이 없습니다</p>
                    <p className="text-sm text-gray-400">첫 이메일을 발송해보세요</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}