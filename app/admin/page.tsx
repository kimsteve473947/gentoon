"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Users, 
  Activity, 
  DollarSign, 
  Database,
  Search,
  Eye,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MousePointer
} from "lucide-react";

interface UserData {
  id?: string;
  authId: string;
  email: string;
  id?: string;
  name?: string;
  fullName?: string;
  avatarUrl?: string;
  role?: string;
  provider?: string;
  createdAt: string;
  internalCreatedAt?: string;
  lastSignIn?: string;
  emailConfirmed?: string;
  hasInternalRecord: boolean;
  referralCode?: string;
  referredBy?: string;
  subscription?: {
    plan: string;
    tokensTotal: number;
    tokensUsed: number;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  };
  tokenUsage?: {
    totalTokensUsed: number;
    totalCostKRW: number;
    monthlyUsage: number;
    dailyUsage: number;
  };
  storageUsage?: {
    usedBytes: number;
    maxBytes: number;
    usagePercentage: number;
  };
  detailedUsage?: {
    projects: number;
    characters: number;
    generations: number;
    totalImages: number;
    breakdown?: {
      projectImages: number;
      generationImages: number;
      characterImages: number;
    };
  };
}

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalTokensUsed: number;
  totalRevenue: number;
  totalCost: number;
  storageUsed: number;
}

const ADMIN_CACHE_KEY = 'instaToon_adminAccess';
const ADMIN_CACHE_DURATION = 30 * 60 * 1000; // 30분

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loadingDetails, setLoadingDetails] = useState<string[]>([]);

  const supabase = createClient();

  useEffect(() => {
    checkAdminAccess();
    
    // 페이지 숨김/표시 시 캐시 상태 체크
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // 페이지가 다시 보일 때 캐시 만료 체크
        const cachedStatus = getCachedAdminStatus();
        if (!cachedStatus && isAdmin) {
          console.log('🔄 Admin cache expired, re-checking access');
          checkAdminAccess();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAdmin]);

  // 캐시된 관리자 상태 확인
  const getCachedAdminStatus = () => {
    try {
      const cached = localStorage.getItem(ADMIN_CACHE_KEY);
      if (!cached) return null;
      
      const { timestamp, isAdmin: cachedAdmin, email } = JSON.parse(cached);
      const now = Date.now();
      
      // 캐시가 만료되었거나 이메일이 다르면 null 반환
      if (now - timestamp > ADMIN_CACHE_DURATION) {
        localStorage.removeItem(ADMIN_CACHE_KEY);
        return null;
      }
      
      return { isAdmin: cachedAdmin, email };
    } catch (error) {
      console.warn('Failed to read admin cache:', error);
      localStorage.removeItem(ADMIN_CACHE_KEY);
      return null;
    }
  };

  // 관리자 상태 캐시 저장
  const setCachedAdminStatus = (isAdmin: boolean, email: string) => {
    try {
      const cacheData = {
        timestamp: Date.now(),
        isAdmin,
        email
      };
      localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache admin status:', error);
    }
  };

  const checkAdminAccess = async () => {
    try {
      // 먼저 캐시된 상태 확인
      const cachedStatus = getCachedAdminStatus();
      
      if (cachedStatus) {
        console.log('✅ Using cached admin status');
        setIsAdmin(cachedStatus.isAdmin);
        if (cachedStatus.isAdmin) {
          await loadDashboardData();
        } else {
          alert('관리자 권한이 없습니다.');
          window.location.href = '/dashboard';
        }
        return;
      }

      console.log('🔍 Checking admin access...');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        window.location.href = '/sign-in';
        return;
      }

      // 관리자 이메일 확인
      const adminEmail = 'kimjh473947@gmail.com';
      const isUserAdmin = user.email === adminEmail;
      
      // 결과를 캐시에 저장
      setCachedAdminStatus(isUserAdmin, user.email || '');
      
      if (isUserAdmin) {
        console.log('✅ Admin access granted');
        setIsAdmin(true);
        await loadDashboardData();
      } else {
        console.log('❌ Admin access denied');
        alert('관리자 권한이 없습니다.');
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Admin access check failed:', error);
      window.location.href = '/dashboard';
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async (page = currentPage, loadDetails = false) => {
    setRefreshing(true);
    try {
      // API 호출로 사용자 데이터 및 통계 조회
      const [usersResponse, statsResponse] = await Promise.all([
        fetch(`/api/admin/users?page=${page}&limit=${pageSize}&details=${loadDetails}`),
        fetch('/api/admin/stats')
      ]);

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData.users || []);
        setCurrentPage(usersData.pagination?.currentPage || 1);
        setTotalPages(usersData.pagination?.totalPages || 1);
        setTotalUsers(usersData.pagination?.totalCount || 0);
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.stats);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // 개별 사용자 상세 정보 로딩 (Auth ID 기반)
  const loadUserDetails = async (authId: string) => {
    if (loadingDetails.includes(authId)) {
      console.log(`⏳ 이미 로딩 중: ${authId.substring(0, 8)}...`);
      return;
    }
    
    console.log(`🔍 사용자 상세 정보 로딩 시작: ${authId.substring(0, 8)}...`);
    setLoadingDetails(prev => [...prev, authId]);
    
    try {
      // 기존 API 엔드포인트 사용 (details=true로 상세 정보 요청)
      const response = await fetch(`/api/admin/users?page=1&limit=1&details=true&authId=${authId}`);
      if (response.ok) {
        const detailsData = await response.json();
        console.log(`📊 API 응답 데이터:`, detailsData);
        
        // 기존 users 배열에서 해당 사용자의 정보를 업데이트
        if (detailsData.users && detailsData.users.length > 0) {
          const updatedUser = detailsData.users[0]; // 첫 번째 (유일한) 사용자
          console.log(`🔄 업데이트할 사용자 데이터:`, updatedUser);
          
          setUsers(prevUsers => {
            const newUsers = prevUsers.map(user => {
              if (user.authId === authId) {
                const mergedUser = {
                  ...user,
                  ...updatedUser,
                  // 중요한 기본 정보는 덮어쓰지 않도록 보호
                  authId: user.authId,
                  email: user.email || updatedUser.email,
                  hasInternalRecord: user.hasInternalRecord
                };
                console.log(`✨ 사용자 정보 병합 완료:`, mergedUser);
                return mergedUser;
              }
              return user;
            });
            
            console.log(`🔄 전체 사용자 배열 업데이트 완료, 총 ${newUsers.length}명`);
            return newUsers;
          });
        }
        
        console.log(`✅ 사용자 상세 정보 로딩 성공: ${authId.substring(0, 8)}...`);
      } else {
        console.error(`❌ API 응답 오류: ${response.status}`, await response.text());
      }
    } catch (error) {
      console.error(`💥 사용자 상세 정보 로딩 실패 (${authId}):`, error);
    } finally {
      setLoadingDetails(prev => {
        const filtered = prev.filter(id => id !== authId);
        console.log(`🏁 로딩 완료, 남은 로딩 대상: ${filtered.length}개`);
        return filtered;
      });
    }
  };

  // 페이지 변경
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadDashboardData(page, false);
  };

  const syncTokenUsage = async () => {
    const confirmed = confirm('모든 사용자의 토큰 사용량을 실제 Google Gemini API 사용량과 동기화하시겠습니까?\n\n이 작업은 subscription 테이블의 tokensUsed 필드를 token_usage 테이블의 실제 데이터로 업데이트합니다.');
    
    if (!confirmed) return;

    setRefreshing(true);
    try {
      const response = await fetch('/api/admin/sync-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const result = await response.json();
        alert(`토큰 동기화 완료!\n\n${result.message}\n처리된 총 토큰: ${(result.totalTokensProcessed || 0).toLocaleString()}개`);
        
        // 동기화 후 데이터 새로고침
        await loadDashboardData();
      } else {
        const error = await response.json();
        alert(`토큰 동기화 실패: ${error.error}`);
      }
    } catch (error) {
      console.error('Token sync failed:', error);
      alert('토큰 동기화 중 오류가 발생했습니다.');
    } finally {
      setRefreshing(false);
    }
  };

  const migrateUsers = async () => {
    const confirmed = confirm('Auth에만 있고 내부 테이블에 없는 사용자들을 자동으로 온보딩하시겠습니까?\n\n이 작업은 누락된 사용자 데이터를 생성하여 완전한 추적을 가능하게 합니다.');
    
    if (!confirmed) return;

    setRefreshing(true);
    try {
      const response = await fetch('/api/admin/migrate-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const result = await response.json();
        alert(`사용자 마이그레이션 완료!\n\n${result.message}${result.errorCount > 0 ? `\n오류: ${result.errorCount}개` : ''}`);
        
        // 마이그레이션 후 데이터 새로고침
        await loadDashboardData();
      } else {
        const error = await response.json();
        alert(`사용자 마이그레이션 실패: ${error.error}`);
      }
    } catch (error) {
      console.error('User migration failed:', error);
      alert('사용자 마이그레이션 중 오류가 발생했습니다.');
    } finally {
      setRefreshing(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  };

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'FREE': return 'bg-gray-500';
      case 'PRO': return 'bg-blue-500';
      case 'PREMIUM': return 'bg-purple-500';
      case 'ADMIN': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.id?.includes(searchTerm) ||
    user.authId?.includes(searchTerm) ||
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>관리자 권한 확인 중...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">접근 권한 없음</h1>
          <p className="text-gray-600">관리자만 접근할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">관리자 대시보드</h1>
            {getCachedAdminStatus() && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                🚀 캐시됨
              </span>
            )}
          </div>
          <p className="text-gray-600">사용자 및 시스템 관리</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => loadDashboardData(currentPage, true)} 
            disabled={refreshing}
            variant="secondary"
          >
            <Activity className={`h-4 w-4 mr-2`} />
            전체 상세 로딩
          </Button>
          <Button 
            onClick={migrateUsers} 
            disabled={refreshing}
            variant="default"
            className="bg-green-600 hover:bg-green-700"
          >
            <Users className={`h-4 w-4 mr-2`} />
            사용자 마이그레이션
          </Button>
          <Button 
            onClick={syncTokenUsage} 
            disabled={refreshing}
            variant="destructive"
            className="bg-orange-600 hover:bg-orange-700"
          >
            <AlertTriangle className={`h-4 w-4 mr-2`} />
            토큰 동기화
          </Button>
          <Button 
            onClick={() => {
              // 새로고침 시 캐시 무효화 (Ctrl+클릭하면)
              if (window.event?.ctrlKey || window.event?.metaKey) {
                localStorage.removeItem(ADMIN_CACHE_KEY);
                console.log('🗑️ Admin cache cleared');
              }
              loadDashboardData();
            }} 
            disabled={refreshing}
            variant="outline"
            title="새로고침 (Ctrl+클릭으로 캐시 초기화)"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 사용자</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                활성 사용자: {stats.activeUsers}명
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 토큰 사용량</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalTokensUsed.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                예상 비용: {formatCurrency(stats.totalCost)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 수익</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats.totalRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">
                순이익: {formatCurrency(stats.totalRevenue - stats.totalCost)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">저장소 사용량</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatBytes(stats.storageUsed)}
              </div>
              <p className="text-xs text-muted-foreground">
                전체 사용자 데이터
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 사용자 요약 카드 */}
      {users.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">사용자 유형별 분포</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>완전등록 사용자:</span>
                  <Badge variant="default">
                    {users.filter(u => u.hasInternalRecord && u.lastSignIn).length}명
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Auth만 있는 사용자:</span>
                  <Badge variant="secondary">
                    {users.filter(u => !u.hasInternalRecord).length}명
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>테스트 데이터:</span>
                  <Badge variant="outline">
                    {users.filter(u => u.hasInternalRecord && !u.lastSignIn).length}명
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">인증 제공자</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Google:</span>
                  <Badge variant="default">
                    {users.filter(u => u.provider === 'google').length}명
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Kakao:</span>
                  <Badge variant="default">
                    {users.filter(u => u.provider === 'kakao').length}명
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>내부/기타:</span>
                  <Badge variant="outline">
                    {users.filter(u => !u.provider || u.provider === 'internal').length}명
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">멤버십 분포</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {['FREE', 'PRO', 'PREMIUM', 'ADMIN'].map(plan => (
                  <div key={plan} className="flex justify-between">
                    <span>{plan}:</span>
                    <Badge className={getPlanBadgeColor(plan)}>
                      {users.filter(u => u.subscription?.plan === plan).length}명
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 사용자 검색 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>사용자 관리</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                총 {totalUsers}명 • 페이지 {currentPage}/{totalPages} • {users.length}명 표시
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <Input
                placeholder="이메일 또는 사용자 ID로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>사용자</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>멤버십</TableHead>
                <TableHead>토큰 사용량</TableHead>
                <TableHead>상세 사용량</TableHead>
                <TableHead>최근 로그인</TableHead>
                <TableHead>액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.authId || user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.email}</div>
                      <div className="text-sm text-gray-500">
                        {user.fullName || user.name || '이름 없음'}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">
                        {(user.authId || user.id || '').slice(0, 8)}...
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={user.hasInternalRecord ? "default" : "secondary"}>
                        {user.hasInternalRecord ? "완전등록" : "Auth만"}
                      </Badge>
                      {user.provider && (
                        <Badge variant="outline" className="text-xs">
                          {user.provider}
                        </Badge>
                      )}
                      {user.role === 'ADMIN' && (
                        <Badge variant="destructive" className="text-xs">
                          관리자
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getPlanBadgeColor(user.subscription?.plan || 'FREE')}>
                      {user.subscription?.plan || 'FREE'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.tokenUsage ? (
                      <div>
                        <div className="font-medium">
                          {(user.tokenUsage.totalTokensUsed || 0).toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatCurrency(user.tokenUsage.totalCostKRW || 0)}
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadUserDetails(user.authId)}
                        disabled={loadingDetails.includes(user.authId)}
                        className="text-xs"
                      >
                        {loadingDetails.includes(user.authId) ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <MousePointer className="h-3 w-3 mr-1" />
                        )}
                        클릭해서 로딩
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.detailedUsage ? (
                      <div className="space-y-1">
                        <div className="flex items-center space-x-4 text-sm">
                          <span>📁 {user.detailedUsage.projects}개 프로젝트</span>
                          <span>👥 {user.detailedUsage.characters}개 캐릭터</span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm">
                          <span>🖼️ {user.detailedUsage.totalImages}개 이미지</span>
                          {user.storageUsage && (
                            <span className="text-purple-600 font-medium">
                              {formatBytes(user.storageUsage.usedBytes)}
                            </span>
                          )}
                        </div>
                        {user.storageUsage && (
                          <div className="text-xs text-gray-500">
                            {user.storageUsage.usagePercentage}% / {formatBytes(user.storageUsage.maxBytes)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadUserDetails(user.authId)}
                        disabled={loadingDetails.includes(user.authId)}
                        className="text-xs"
                      >
                        {loadingDetails.includes(user.authId) ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <MousePointer className="h-3 w-3 mr-1" />
                        )}
                        클릭해서 로딩
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      {user.lastSignIn ? (
                        <div>
                          <div className="font-medium">
                            {new Date(user.lastSignIn).toLocaleDateString('ko-KR')}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(user.lastSignIn).toLocaleTimeString('ko-KR')}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400">로그인 없음</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedUser(user)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {/* 페이지네이션 컨트롤 */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                페이지당 표시:
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                  loadDashboardData(1, false);
                }}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value={5}>5개</option>
                <option value={10}>10개</option>
                <option value={20}>20개</option>
                <option value={50}>50개</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1 || refreshing}
              >
                <ChevronLeft className="h-4 w-4" />
                이전
              </Button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else if (currentPage <= 3) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i;
                  } else {
                    page = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      disabled={refreshing}
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || refreshing}
              >
                다음
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="text-sm text-gray-600">
              총 {totalUsers}명 중 {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalUsers)}명
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 사용자 상세 정보 모달 */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>사용자 상세 정보</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">기본 정보</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>이메일:</span>
                    <span>{selectedUser.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>사용자 ID:</span>
                    <span className="font-mono text-sm">{selectedUser.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>가입일:</span>
                    <span>{new Date(selectedUser.createdAt).toLocaleString('ko-KR')}</span>
                  </div>
                  {selectedUser.lastSignIn && (
                    <div className="flex justify-between">
                      <span>최근 로그인:</span>
                      <span>{new Date(selectedUser.lastSignIn).toLocaleString('ko-KR')}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 구독 정보 */}
              {selectedUser.subscription && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">구독 정보</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>플랜:</span>
                      <Badge className={getPlanBadgeColor(selectedUser.subscription.plan)}>
                        {selectedUser.subscription.plan}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>토큰 사용량:</span>
                      <span>
                        {(selectedUser.subscription.tokensUsed || 0).toLocaleString()} / 
                        {(selectedUser.subscription.tokensTotal || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>구독 시작:</span>
                      <span>
                        {selectedUser.subscription.currentPeriodStart 
                          ? new Date(selectedUser.subscription.currentPeriodStart).toLocaleDateString('ko-KR')
                          : selectedUser.subscription.createdAt
                            ? new Date(selectedUser.subscription.createdAt).toLocaleDateString('ko-KR')
                            : '정보 없음'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>구독 만료:</span>
                      <span>
                        {selectedUser.subscription.currentPeriodEnd 
                          ? new Date(selectedUser.subscription.currentPeriodEnd).toLocaleDateString('ko-KR')
                          : selectedUser.subscription.plan === 'FREE' || selectedUser.subscription.plan === 'ADMIN'
                            ? '무제한'
                            : '정보 없음'
                        }
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 토큰 사용량 */}
              {selectedUser.tokenUsage && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">토큰 사용량 상세</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>총 토큰 사용:</span>
                      <span>{(selectedUser.tokenUsage?.totalTokensUsed || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>예상 비용:</span>
                      <span>{formatCurrency(selectedUser.tokenUsage?.totalCostKRW || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>월간 사용량:</span>
                      <span>{(selectedUser.tokenUsage?.monthlyUsage || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>일일 사용량:</span>
                      <span>{(selectedUser.tokenUsage?.dailyUsage || 0).toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 저장소 사용량 */}
              {selectedUser.storageUsage && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">저장소 사용량</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>사용량:</span>
                      <span>{formatBytes(selectedUser.storageUsage.usedBytes)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>최대 용량:</span>
                      <span>{formatBytes(selectedUser.storageUsage.maxBytes)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>사용률:</span>
                      <span>{selectedUser.storageUsage.usagePercentage}%</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}