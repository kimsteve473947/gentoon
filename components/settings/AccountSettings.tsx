'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  User,
  Mail,
  Lock,
  Trash2,
  Save,
  AlertTriangle
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

interface AccountSettingsProps {
  user: any;
  onUpdate: () => void;
}

export function AccountSettings({ user, onUpdate }: AccountSettingsProps) {
  const [profileData, setProfileData] = useState({
    name: user?.user_metadata?.full_name || user?.user_metadata?.name || '',
    email: user?.email || ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState({
    profile: false,
    password: false,
    delete: false
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleProfileUpdate = async () => {
    setLoading(prev => ({ ...prev, profile: true }));
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: profileData.name,
          name: profileData.name
        }
      });

      if (error) throw error;

      alert('프로필이 업데이트되었습니다.');
      onUpdate();
    } catch (error) {
      console.error('Profile update error:', error);
      alert('프로필 업데이트 중 오류가 발생했습니다.');
    } finally {
      setLoading(prev => ({ ...prev, profile: false }));
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      alert('새 비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    setLoading(prev => ({ ...prev, password: true }));
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      alert('비밀번호가 변경되었습니다.');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Password change error:', error);
      alert('비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setLoading(prev => ({ ...prev, password: false }));
    }
  };

  const handleAccountDelete = async () => {
    setLoading(prev => ({ ...prev, delete: true }));
    try {
      // 실제 계정 삭제는 서버에서 처리해야 함
      const response = await fetch('/api/settings/delete-account', {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        alert('계정이 삭제되었습니다.');
        // 로그아웃 및 리다이렉트
        await supabase.auth.signOut();
        window.location.href = '/';
      } else {
        alert(data.error || '계정 삭제 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Account delete error:', error);
      alert('계정 삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(prev => ({ ...prev, delete: false }));
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 프로필 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            프로필 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                value={profileData.name}
                onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="이름을 입력하세요"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={profileData.email}
                disabled
                className="bg-gray-100"
              />
              <p className="text-xs text-gray-500">이메일은 변경할 수 없습니다</p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button 
              onClick={handleProfileUpdate}
              disabled={loading.profile}
              className="flex items-center gap-2"
            >
              {loading.profile ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  저장
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 비밀번호 변경 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-green-600" />
            비밀번호 변경
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">현재 비밀번호</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                placeholder="현재 비밀번호를 입력하세요"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">새 비밀번호</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="새 비밀번호 (8자 이상)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="새 비밀번호 확인"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button 
              onClick={handlePasswordChange}
              disabled={loading.password || !passwordData.newPassword || !passwordData.confirmPassword}
              className="flex items-center gap-2"
            >
              {loading.password ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  변경 중...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  비밀번호 변경
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 계정 삭제 */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            계정 삭제
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">주의: 이 작업은 되돌릴 수 없습니다</p>
                <ul className="mt-2 text-sm text-red-700 space-y-1">
                  <li>• 모든 프로젝트와 이미지가 영구 삭제됩니다</li>
                  <li>• 구독이 즉시 취소됩니다</li>
                  <li>• 계정 복구가 불가능합니다</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button 
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              계정 삭제
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 계정 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                계정 삭제 최종 확인
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                정말로 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 모든 데이터가 영구적으로 삭제됩니다.
              </p>
              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={loading.delete}
                >
                  취소
                </Button>
                <Button 
                  variant="destructive" 
                  className="flex-1"
                  onClick={handleAccountDelete}
                  disabled={loading.delete}
                >
                  {loading.delete ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      삭제 중...
                    </>
                  ) : (
                    '영구 삭제'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}