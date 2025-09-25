'use client';

import React, { useState, useEffect } from 'react';
import { PLAN_CONFIGS } from '@/lib/subscription/plan-config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Users,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  Shield,
  Crown,
  User,
  Activity,
  Clock,
  Zap,
  FileText,
  BarChart3,
  Download,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { useOptimizedSettings } from '@/hooks/useOptimizedSettings';
import { useRouter } from 'next/navigation';

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  subscription: {
    plan: string;
    tokensTotal: number;
    tokensUsed: number;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  };
  stats: {
    projectCount: number;
    characterCount: number;
    thisMonthGenerations: number;
    lastActivity: string | null;
    storageUsedBytes?: number;
    storageLimitBytes?: number;
  };
}

interface UsersResponse {
  success: boolean;
  users: UserData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { subscription, loading } = useOptimizedSettings();
  
  const [users, setUsers] = useState<UserData[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [userActivities, setUserActivities] = useState<any[]>([]);
  const [userUsage, setUserUsage] = useState<any>(null);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    role: '',
    plan: '',
    tokensTotal: '',
    tokensUsed: '',
    currentPeriodEnd: '',
    cancelAtPeriodEnd: false,
    storageLimit: ''
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // 관리자 권한 확인
  useEffect(() => {
    if (!loading && subscription?.plan !== 'ADMIN') {
      router.push('/');
      return;
    }
  }, [loading, subscription, router]);

  // 사용자 목록 로드
  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(selectedRole && { role: selectedRole }),
        ...(selectedPlan && { plan: selectedPlan }),
        sortBy,
        sortOrder
      });

      const response = await fetch(`/api/admin/users?${params}`);
      const data: UsersResponse = await response.json();

      if (data.success) {
        setUsers(data.users);
        setPagination(data.pagination);
      } else {
        console.error('Failed to load users:', data.error);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  // 초기 로드 및 의존성 변경시 리로드
  useEffect(() => {
    if (!loading && subscription?.plan === 'ADMIN') {
      loadUsers();
    }
  }, [pagination.page, searchTerm, selectedRole, selectedPlan, sortBy, sortOrder, loading, subscription]);

  // 정렬 토글
  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // 페이지 변경
  const changePage = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // 사용자 상세 정보 로드
  const loadUserDetails = async (userId: string) => {
    setLoadingDetails(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setUserDetails(data.user);
      } else {
        console.error('Failed to load user details:', data.error);
      }
    } catch (error) {
      console.error('Error loading user details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  // 사용자 활동 내역 로드
  const loadUserActivities = async (userId: string) => {
    setLoadingActivities(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/activities?limit=50`);
      const data = await response.json();
      
      if (data.success) {
        setUserActivities(data.activities);
      } else {
        console.error('Failed to load user activities:', data.error);
      }
    } catch (error) {
      console.error('Error loading user activities:', error);
    } finally {
      setLoadingActivities(false);
    }
  };

  // 사용자 사용량 통계 로드
  const loadUserUsage = async (userId: string) => {
    setLoadingUsage(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/usage?period=30`);
      const data = await response.json();
      
      if (data.success) {
        setUserUsage(data.usage);
      } else {
        console.error('Failed to load user usage:', data.error);
      }
    } catch (error) {
      console.error('Error loading user usage:', error);
    } finally {
      setLoadingUsage(false);
    }
  };

  // 사용자 보기 모달 열기
  const handleViewUser = (user: UserData) => {
    setSelectedUser(user);
    setActiveTab('overview');
    setShowUserModal(true);
    loadUserDetails(user.id);
  };

  // CSV 내보내기
  const handleExportCSV = async () => {
    try {
      const response = await fetch('/api/admin/users/export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('CSV 내보내기 오류:', error);
    }
  };

  // 사용자 편집 모달 열기
  const handleEditUser = (user: UserData) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name || '',
      role: user.role,
      plan: user.subscription?.plan || '',
      tokensTotal: user.subscription?.tokensTotal?.toString() || '',
      tokensUsed: user.subscription?.tokensUsed?.toString() || '',
      currentPeriodEnd: user.subscription?.currentPeriodEnd ? new Date(user.subscription.currentPeriodEnd).toISOString().split('T')[0] : '',
      cancelAtPeriodEnd: user.subscription?.cancelAtPeriodEnd || false,
      storageLimit: user.stats.storageLimitBytes ? Math.round(user.stats.storageLimitBytes / (1024 * 1024 * 1024)).toString() : '1' // GB 단위
    });
    setShowEditModal(true);
  };

  // 사용자 정보 저장
  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    
    setSavingEdit(true);
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editForm.name,
          role: editForm.role,
          plan: editForm.plan,
          tokensTotal: parseInt(editForm.tokensTotal) || 0,
          tokensUsed: parseInt(editForm.tokensUsed) || 0,
          currentPeriodEnd: editForm.currentPeriodEnd,
          cancelAtPeriodEnd: editForm.cancelAtPeriodEnd,
          storageLimit: parseInt(editForm.storageLimit) * 1024 * 1024 * 1024 || 1073741824 // GB를 bytes로 변환
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // 사용자 목록 새로고침
        await loadUsers();
        setShowEditModal(false);
        setSelectedUser(null);
        alert('사용자 정보가 수정되었습니다.');
      } else {
        alert(`수정 실패: ${data.error}`);
      }
    } catch (error) {
      console.error('사용자 수정 오류:', error);
      alert('사용자 수정 중 오류가 발생했습니다.');
    } finally {
      setSavingEdit(false);
    }
  };

  // 플랜 색상 가져오기
  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'FREE': return 'bg-gray-100 text-gray-800';
      case 'PRO': return 'bg-blue-100 text-blue-800';
      case 'PREMIUM': return 'bg-purple-100 text-purple-800';
      case 'ADMIN': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // 역할 색상 가져오기
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-100 text-red-800';
      case 'USER': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // 토큰 사용률 계산
  const getTokenUsagePercentage = (used: number, total: number) => {
    return total > 0 ? Math.round((used / total) * 100) : 0;
  };

  // 스토리지 사용률 계산
  const getStorageUsagePercentage = (used: number, limit: number) => {
    return limit > 0 ? Math.round((used / limit) * 100) : 0;
  };

  // 파일 크기 포맷팅
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-8 w-8 animate-pulse mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">관리자 권한 확인 중...</p>
        </div>
      </div>
    );
  }

  if (subscription?.plan !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">접근 거부</h1>
          <p className="text-gray-600 mb-4">관리자 권한이 필요합니다.</p>
          <Link href="/">
            <Button>홈으로 돌아가기</Button>
          </Link>
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
            <Users className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">사용자 관리</h1>
          </div>
          <p className="text-gray-600">전체 사용자 계정을 관리하고 모니터링하세요.</p>
        </div>

        {/* 필터 및 검색 */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* 검색 */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="이메일 또는 이름으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              {/* 필터 */}
              <div className="flex gap-2">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">모든 역할</option>
                  <option value="USER">일반 사용자</option>
                  <option value="ADMIN">관리자</option>
                </select>
                
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">모든 플랜</option>
                  <option value="FREE">{PLAN_CONFIGS.FREE.name}</option>
                  <option value="PRO">{PLAN_CONFIGS.PRO.name}</option>
                  <option value="PREMIUM">{PLAN_CONFIGS.PREMIUM.name}</option>
                  <option value="ADMIN">{PLAN_CONFIGS.ADMIN.name}</option>
                </select>
                
                <Button
                  variant="outline"
                  onClick={loadUsers}
                  disabled={loadingUsers}
                  className="whitespace-nowrap"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loadingUsers ? 'animate-spin' : ''}`} />
                  새로고침
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 사용자 테이블 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                사용자 목록 ({pagination.total}명)
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                CSV 내보내기
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2">
                      <button 
                        onClick={() => toggleSort('email')}
                        className="flex items-center gap-1 font-semibold text-gray-700 hover:text-gray-900"
                      >
                        사용자
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-2">
                      <button 
                        onClick={() => toggleSort('role')}
                        className="flex items-center gap-1 font-semibold text-gray-700 hover:text-gray-900"
                      >
                        역할
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-2">
                      <button 
                        onClick={() => toggleSort('subscription.plan')}
                        className="flex items-center gap-1 font-semibold text-gray-700 hover:text-gray-900"
                      >
                        플랜
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-2">토큰 사용량</th>
                    <th className="text-left py-3 px-2">활동</th>
                    <th className="text-left py-3 px-2">
                      <button 
                        onClick={() => toggleSort('createdAt')}
                        className="flex items-center gap-1 font-semibold text-gray-700 hover:text-gray-900"
                      >
                        가입일
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-center py-3 px-2">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    // 로딩 스켈레톤
                    Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-4 px-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
                            <div>
                              <div className="w-32 h-4 bg-gray-200 rounded animate-pulse mb-1"></div>
                              <div className="w-24 h-3 bg-gray-200 rounded animate-pulse"></div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-2">
                          <div className="w-16 h-5 bg-gray-200 rounded animate-pulse"></div>
                        </td>
                        <td className="py-4 px-2">
                          <div className="w-20 h-5 bg-gray-200 rounded animate-pulse"></div>
                        </td>
                        <td className="py-4 px-2">
                          <div className="w-24 h-4 bg-gray-200 rounded animate-pulse"></div>
                        </td>
                        <td className="py-4 px-2">
                          <div className="w-16 h-4 bg-gray-200 rounded animate-pulse"></div>
                        </td>
                        <td className="py-4 px-2">
                          <div className="w-20 h-4 bg-gray-200 rounded animate-pulse"></div>
                        </td>
                        <td className="py-4 px-2">
                          <div className="w-16 h-8 bg-gray-200 rounded animate-pulse"></div>
                        </td>
                      </tr>
                    ))
                  ) : users.length > 0 ? (
                    users.map((user) => (
                      <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                              {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{user.name || 'Unknown'}</p>
                              <p className="text-sm text-gray-600">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-2">
                          <Badge className={getRoleBadgeColor(user.role)}>
                            {user.role === 'ADMIN' ? (
                              <>
                                <Crown className="h-3 w-3 mr-1" />
                                관리자
                              </>
                            ) : (
                              <>
                                <User className="h-3 w-3 mr-1" />
                                사용자
                              </>
                            )}
                          </Badge>
                        </td>
                        <td className="py-4 px-2">
                          <Badge className={getPlanBadgeColor(user.subscription?.plan)}>
                            {user.subscription?.plan || 'FREE'}
                          </Badge>
                        </td>
                        <td className="py-4 px-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                                  style={{ 
                                    width: `${Math.min(100, getTokenUsagePercentage(user.subscription?.tokensUsed || 0, user.subscription?.tokensTotal || 1))}%` 
                                  }}
                                ></div>
                              </div>
                              <p className="text-xs text-gray-600 mt-1">
                                {(user.subscription?.tokensUsed || 0).toLocaleString()} / {(user.subscription?.tokensTotal || 0).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-2">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Activity className="h-4 w-4" />
                              <div>
                                <p>{user.stats.projectCount}개 프로젝트</p>
                                <p className="text-xs">{user.stats.thisMonthGenerations}회 생성</p>
                              </div>
                            </div>
                            {/* 스토리지 사용량 표시 */}
                            {user.stats.storageUsedBytes !== undefined && user.stats.storageLimitBytes !== undefined && (
                              <div className="text-xs">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-gray-500">스토리지</span>
                                  <span className="text-gray-600">
                                    {formatBytes(user.stats.storageUsedBytes)} / {formatBytes(user.stats.storageLimitBytes)}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1">
                                  <div 
                                    className={`h-1 rounded-full transition-all duration-300 ${
                                      getStorageUsagePercentage(user.stats.storageUsedBytes, user.stats.storageLimitBytes) > 80 
                                        ? 'bg-red-500' 
                                        : getStorageUsagePercentage(user.stats.storageUsedBytes, user.stats.storageLimitBytes) > 60
                                          ? 'bg-yellow-500'
                                          : 'bg-green-500'
                                    }`}
                                    style={{ 
                                      width: `${Math.min(100, getStorageUsagePercentage(user.stats.storageUsedBytes, user.stats.storageLimitBytes))}%` 
                                    }}
                                  ></div>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-2 text-sm text-gray-600">
                          {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="py-4 px-2">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewUser(user)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditUser(user)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Users className="h-12 w-12 text-gray-400" />
                          <p className="text-gray-500">사용자가 없습니다</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  {pagination.total}명 중 {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}명 표시
                </p>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => changePage(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    이전
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      const page = Math.max(1, pagination.page - 2) + i;
                      if (page > pagination.totalPages) return null;
                      
                      return (
                        <Button
                          key={page}
                          variant={page === pagination.page ? "default" : "outline"}
                          size="sm"
                          onClick={() => changePage(page)}
                        >
                          {page}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => changePage(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    다음
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 사용자 상세보기 모달 */}
        {showUserModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">사용자 상세 정보</h2>
                <button
                  onClick={() => {
                    setShowUserModal(false);
                    setSelectedUser(null);
                    setUserDetails(null);
                    setUserActivities([]);
                    setUserUsage(null);
                    setActiveTab('overview');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                {/* 탭 메뉴 */}
                <div className="flex border-b border-gray-200 mb-6">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 ${
                      activeTab === 'overview'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <User className="h-4 w-4 inline mr-1" />
                    개요
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('activities');
                      if (selectedUser && userActivities.length === 0) {
                        loadUserActivities(selectedUser.id);
                      }
                    }}
                    className={`px-4 py-2 text-sm font-medium border-b-2 ml-4 ${
                      activeTab === 'activities'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Activity className="h-4 w-4 inline mr-1" />
                    활동 내역
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('usage');
                      if (selectedUser && !userUsage) {
                        loadUserUsage(selectedUser.id);
                      }
                    }}
                    className={`px-4 py-2 text-sm font-medium border-b-2 ml-4 ${
                      activeTab === 'usage'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <BarChart3 className="h-4 w-4 inline mr-1" />
                    사용량 분석
                  </button>
                </div>

                {/* 탭 컨텐츠 */}
                {activeTab === 'overview' && (
                  loadingDetails ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
                      <span className="ml-2 text-gray-600">사용자 정보를 불러오는 중...</span>
                    </div>
                  ) : userDetails ? (
                    <div className="space-y-6">
                      {/* 기본 정보 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <User className="h-5 w-5" />
                              기본 정보
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-blue-600 rounded-full flex items-center justify-center text-white text-lg font-semibold">
                                  {selectedUser.name?.charAt(0) || selectedUser.email.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">{selectedUser.name || 'Unknown'}</p>
                                  <p className="text-sm text-gray-600">{selectedUser.email}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">역할:</span>
                                  <Badge className={getRoleBadgeColor(selectedUser.role)} variant="outline">
                                    {selectedUser.role === 'ADMIN' ? '관리자' : '사용자'}
                                  </Badge>
                                </div>
                                <div>
                                  <span className="text-gray-500">가입일:</span>
                                  <p className="font-medium">{new Date(selectedUser.createdAt).toLocaleDateString('ko-KR')}</p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Crown className="h-5 w-5" />
                              구독 정보
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div>
                                <span className="text-gray-500 text-sm">현재 플랜:</span>
                                <Badge className={getPlanBadgeColor(selectedUser.subscription?.plan)} variant="outline">
                                  {selectedUser.subscription?.plan || 'FREE'}
                                </Badge>
                              </div>
                              <div>
                                <span className="text-gray-500 text-sm">토큰 사용량:</span>
                                <div className="mt-1">
                                  <div className="flex items-center justify-between text-sm">
                                    <span>{(selectedUser.subscription?.tokensUsed || 0).toLocaleString()}</span>
                                    <span>{(selectedUser.subscription?.tokensTotal || 0).toLocaleString()}</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                    <div 
                                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
                                      style={{ 
                                        width: `${Math.min(100, getTokenUsagePercentage(selectedUser.subscription?.tokensUsed || 0, selectedUser.subscription?.tokensTotal || 1))}%` 
                                      }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* 통계 정보 */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            활동 통계
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="text-center p-4 bg-blue-50 rounded-lg">
                              <FileText className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                              <p className="text-2xl font-bold text-blue-900">{userDetails.stats?.projectCount || 0}</p>
                              <p className="text-sm text-blue-600">프로젝트</p>
                            </div>
                            <div className="text-center p-4 bg-green-50 rounded-lg">
                              <User className="h-8 w-8 mx-auto mb-2 text-green-600" />
                              <p className="text-2xl font-bold text-green-900">{userDetails.stats?.characterCount || 0}</p>
                              <p className="text-sm text-green-600">캐릭터</p>
                            </div>
                            <div className="text-center p-4 bg-purple-50 rounded-lg">
                              <Zap className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                              <p className="text-2xl font-bold text-purple-900">{userDetails.stats?.monthlyUsage?.images_generated || 0}</p>
                              <p className="text-sm text-purple-600">이번 달 생성</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* 최근 프로젝트 */}
                      {userDetails.recentProjects && userDetails.recentProjects.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <FileText className="h-5 w-5" />
                              최근 프로젝트
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {userDetails.recentProjects.slice(0, 5).map((project: any, index: number) => (
                                <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                  <div>
                                    <p className="font-medium text-gray-900">{project.title}</p>
                                    <p className="text-sm text-gray-600">
                                      {project.panelCount}개 패널 • {new Date(project.lastEditedAt || project.createdAt).toLocaleDateString('ko-KR')}
                                    </p>
                                  </div>
                                  <Badge variant="outline" className={
                                    project.status === 'PUBLISHED' ? 'text-green-600 bg-green-50' : 
                                    project.status === 'IN_PROGRESS' ? 'text-blue-600 bg-blue-50' : 
                                    'text-gray-600 bg-gray-50'
                                  }>
                                    {project.status}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-500">사용자 정보를 불러올 수 없습니다.</p>
                    </div>
                  )
                )}

                {/* 활동 내역 탭 */}
                {activeTab === 'activities' && (
                  <div className="space-y-4">
                    {loadingActivities ? (
                      <div className="flex items-center justify-center py-12">
                        <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
                        <span className="ml-2 text-gray-600">활동 내역을 불러오는 중...</span>
                      </div>
                    ) : userActivities.length > 0 ? (
                      <div className="space-y-3">
                        {userActivities.map((activity, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                  <Activity className="h-4 w-4 text-blue-600" />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{activity.activity_title}</p>
                                  <p className="text-sm text-gray-600 mt-1">{activity.activity_description}</p>
                                  {activity.metadata && (
                                    <div className="text-xs text-gray-500 mt-2">
                                      <pre className="whitespace-pre-wrap">{JSON.stringify(activity.metadata, null, 2)}</pre>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-right text-sm text-gray-500">
                                <p>{new Date(activity.created_at).toLocaleDateString('ko-KR')}</p>
                                <p>{new Date(activity.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">활동 내역이 없습니다</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 사용량 분석 탭 */}
                {activeTab === 'usage' && (
                  <div className="space-y-6">
                    {loadingUsage ? (
                      <div className="flex items-center justify-center py-12">
                        <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
                        <span className="ml-2 text-gray-600">사용량 정보를 불러오는 중...</span>
                      </div>
                    ) : userUsage ? (
                      <>
                        {/* 사용량 요약 */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <BarChart3 className="h-5 w-5" />
                              30일 사용량 요약
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="text-center">
                                <p className="text-2xl font-bold text-blue-600">{(userUsage.summary?.totalTokensUsed || 0).toLocaleString()}</p>
                                <p className="text-sm text-gray-600">토큰 사용</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold text-green-600">{userUsage.summary?.totalGenerations || 0}</p>
                                <p className="text-sm text-gray-600">이미지 생성</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold text-purple-600">{userUsage.summary?.activeProjects || 0}</p>
                                <p className="text-sm text-gray-600">활성 프로젝트</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold text-orange-600">{userUsage.summary?.averageGenerationTime || 0}초</p>
                                <p className="text-sm text-gray-600">평균 생성 시간</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* 최근 토큰 사용 내역 */}
                        {userUsage.recentTokenUsage && userUsage.recentTokenUsage.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <Zap className="h-5 w-5" />
                                최근 토큰 사용 내역
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {userUsage.recentTokenUsage.slice(0, 10).map((usage: any, index: number) => (
                                  <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                    <div>
                                      <p className="font-medium text-gray-900">{usage.service_type}</p>
                                      <p className="text-sm text-gray-600">{new Date(usage.created_at).toLocaleString('ko-KR')}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-bold text-blue-600">{usage.total_tokens.toLocaleString()}</p>
                                      <p className="text-xs text-gray-500">토큰</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">사용량 정보를 불러올 수 없습니다</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 사용자 편집 모달 */}
        {showEditModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">사용자 편집</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedUser(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                <div className="space-y-6">
                  {/* 기본 정보 */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          이름
                        </label>
                        <Input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="사용자 이름"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          역할
                        </label>
                        <select
                          value={editForm.role}
                          onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="USER">일반 사용자</option>
                          <option value="ADMIN">관리자</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 구독 정보 */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">구독 정보</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          플랜
                        </label>
                        <select
                          value={editForm.plan}
                          onChange={(e) => setEditForm(prev => ({ ...prev, plan: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="FREE">{PLAN_CONFIGS.FREE.name}</option>
                          <option value="PRO">{PLAN_CONFIGS.PRO.name}</option>
                          <option value="PREMIUM">{PLAN_CONFIGS.PREMIUM.name}</option>
                          <option value="ADMIN">{PLAN_CONFIGS.ADMIN.name}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          구독 종료일
                        </label>
                        <Input
                          type="date"
                          value={editForm.currentPeriodEnd}
                          onChange={(e) => setEditForm(prev => ({ ...prev, currentPeriodEnd: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 토큰 정보 */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">토큰 정보</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          총 토큰 수
                        </label>
                        <Input
                          type="number"
                          value={editForm.tokensTotal}
                          onChange={(e) => setEditForm(prev => ({ ...prev, tokensTotal: e.target.value }))}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          사용된 토큰 수
                        </label>
                        <Input
                          type="number"
                          value={editForm.tokensUsed}
                          onChange={(e) => setEditForm(prev => ({ ...prev, tokensUsed: e.target.value }))}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 스토리지 제한 설정 */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">스토리지 설정</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          스토리지 제한 (GB)
                        </label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="100"
                          value={editForm.storageLimit}
                          onChange={(e) => setEditForm(prev => ({ ...prev, storageLimit: e.target.value }))}
                          placeholder="1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          현재 사용량: {formatBytes(selectedUser?.stats?.storageUsedBytes || 0)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          사용률
                        </label>
                        <div className="mt-2">
                          {selectedUser?.stats?.storageUsedBytes !== undefined && selectedUser?.stats?.storageLimitBytes !== undefined && (
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all duration-300 ${
                                  getStorageUsagePercentage(selectedUser.stats.storageUsedBytes, selectedUser.stats.storageLimitBytes) > 80 
                                    ? 'bg-red-500' 
                                    : getStorageUsagePercentage(selectedUser.stats.storageUsedBytes, selectedUser.stats.storageLimitBytes) > 60
                                      ? 'bg-yellow-500'
                                      : 'bg-green-500'
                                }`}
                                style={{ 
                                  width: `${Math.min(100, getStorageUsagePercentage(selectedUser.stats.storageUsedBytes, selectedUser.stats.storageLimitBytes))}%` 
                                }}
                              ></div>
                            </div>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {selectedUser?.stats?.storageUsedBytes !== undefined && selectedUser?.stats?.storageLimitBytes !== undefined
                              ? `${getStorageUsagePercentage(selectedUser.stats.storageUsedBytes, selectedUser.stats.storageLimitBytes)}% 사용 중`
                              : '데이터 없음'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 기타 설정 */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">기타 설정</h3>
                    <div className="flex items-center">
                      <input
                        id="cancelAtPeriodEnd"
                        type="checkbox"
                        checked={editForm.cancelAtPeriodEnd}
                        onChange={(e) => setEditForm(prev => ({ ...prev, cancelAtPeriodEnd: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="cancelAtPeriodEnd" className="ml-2 block text-sm text-gray-900">
                        구독 해지 예약
                      </label>
                    </div>
                  </div>
                </div>

                {/* 버튼 */}
                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedUser(null);
                    }}
                    disabled={savingEdit}
                  >
                    취소
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    disabled={savingEdit}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {savingEdit ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        저장 중...
                      </>
                    ) : (
                      '저장'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}