'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  User,
  Mail,
  Calendar,
  Settings,
  Shield,
  AlertCircle,
  CheckCircle,
  Save,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

export default function AccountPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  // Form states
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUser(user);
        setEmail(user.email || '');
        setDisplayName(user.user_metadata?.display_name || user.email?.split('@')[0] || '');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setMessage({ type: 'error', text: '사용자 정보를 불러오는 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const supabase = createClient();
      
      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: displayName
        }
      });

      if (error) throw error;

      setMessage({ type: 'success', text: '프로필이 성공적으로 업데이트되었습니다.' });
      await loadUserData(); // 데이터 새로고침
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: error.message || '프로필 업데이트 중 오류가 발생했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // 로그아웃 후 홈페이지로 리디렉션
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
      setMessage({ type: 'error', text: '로그아웃 중 오류가 발생했습니다.' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="px-6 py-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-64"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border p-6 space-y-4">
                <div className="h-6 bg-gray-200 rounded w-32"></div>
                <div className="space-y-4">
                  <div className="h-10 bg-gray-200 rounded"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          </div>
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
                <h1 className="text-2xl font-bold text-gray-900">계정 관리</h1>
                <p className="text-gray-600 mt-1">계정 정보와 보안 설정을 관리하세요</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 기본 정보 */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                기본 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-sm font-medium text-gray-700">
                  표시 이름
                </Label>
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="표시할 이름을 입력하세요"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  이메일 주소
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="w-full bg-gray-50 text-gray-500"
                />
                <p className="text-xs text-gray-500">
                  이메일 주소는 변경할 수 없습니다. 변경이 필요한 경우 고객지원에 문의하세요.
                </p>
              </div>

              <Button 
                onClick={handleSaveProfile} 
                disabled={saving}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? '저장 중...' : '변경사항 저장'}
              </Button>
            </CardContent>
          </Card>

          {/* 계정 정보 */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                계정 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">이메일 인증</p>
                      <p className="text-xs text-gray-600">이메일 주소가 확인되었습니다</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">인증됨</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">계정 생성일</p>
                      <p className="text-xs text-gray-600">
                        {user?.created_at 
                          ? new Date(user.created_at).toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: 'long', 
                              day: 'numeric'
                            })
                          : '정보 없음'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Settings className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">계정 ID</p>
                      <p className="text-xs text-gray-600 font-mono">{user?.id}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 계정 작업 */}
          <Card className="border-0 shadow-lg lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-red-600">위험한 작업</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div>
                    <h3 className="text-sm font-medium text-red-900">계정에서 로그아웃</h3>
                    <p className="text-xs text-red-700 mt-1">
                      모든 디바이스에서 로그아웃하고 다시 로그인해야 합니다.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSignOut}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    로그아웃
                  </Button>
                </div>

                <div className="flex items-start justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">계정 삭제</h3>
                    <p className="text-xs text-gray-600 mt-1">
                      계정 삭제는 고객지원을 통해서만 가능합니다. 모든 데이터가 영구적으로 삭제됩니다.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="text-gray-400 border-gray-300"
                  >
                    지원팀 문의
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}