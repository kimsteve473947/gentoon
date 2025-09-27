'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Shield, 
  Search, 
  Filter, 
  Download, 
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Settings,
  ArrowLeft,
  Calendar,
  FileText,
  Activity,
  Lock,
  Unlock,
  UserPlus,
  CreditCard,
  Database,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { useOptimizedSettings } from '@/hooks/useOptimizedSettings';
import { useRouter } from 'next/navigation';

// 감사 로그 타입
interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'auth' | 'admin' | 'payment' | 'system' | 'user' | 'security';
  success: boolean;
}

// 감사 통계
interface AuditStats {
  totalEvents: number;
  todayEvents: number;
  criticalEvents: number;
  failedAttempts: number;
  uniqueUsers: number;
  topActions: Array<{ action: string; count: number }>;
}

export default function AuditPage() {
  const router = useRouter();
  const { subscription, loading } = useOptimizedSettings();
  const [activeTab, setActiveTab] = useState<'logs' | 'stats' | 'alerts' | 'export'>('logs');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditStats, setAuditStats] = useState<AuditStats>({
    totalEvents: 0,
    todayEvents: 0,
    criticalEvents: 0,
    failedAttempts: 0,
    uniqueUsers: 0,
    topActions: []
  });
  
  // 필터링 및 검색 상태
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    severity: 'all',
    dateRange: '7d',
    success: 'all'
  });
  
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (!loading && subscription?.plan !== 'ADMIN') {
      router.push('/admin');
      return;
    }
    
    loadAuditLogs();
    loadAuditStats();
  }, [loading, subscription, router, filters]);

  const loadAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const queryParams = new URLSearchParams({
        search: filters.search,
        category: filters.category,
        severity: filters.severity,
        dateRange: filters.dateRange,
        success: filters.success
      });

      const response = await fetch(`/api/admin-473947/audit/logs?${queryParams}`);
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.logs || []);
      }
    } catch (error) {
      console.error('감사 로그 로드 실패:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const loadAuditStats = async () => {
    try {
      const response = await fetch('/api/admin-473947/audit/stats');
      if (response.ok) {
        const data = await response.json();
        setAuditStats(data);
      }
    } catch (error) {
      console.error('감사 통계 로드 실패:', error);
    }
  };

  const handleExportLogs = async () => {
    try {
      const queryParams = new URLSearchParams(filters);
      const response = await fetch(`/api/admin-473947/audit/export?${queryParams}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('로그 내보내기 실패:', error);
      alert('로그 내보내기 중 오류가 발생했습니다.');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'auth': return <Lock className="h-4 w-4" />;
      case 'admin': return <Shield className="h-4 w-4" />;
      case 'payment': return <CreditCard className="h-4 w-4" />;
      case 'system': return <Settings className="h-4 w-4" />;
      case 'user': return <User className="h-4 w-4" />;
      case 'security': return <AlertTriangle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  if (loading || subscription?.plan !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-8 w-8 animate-pulse mx-auto mb-4 text-blue-600" />
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
            <Shield className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">감사 로그</h1>
          </div>
          <p className="text-gray-600">시스템의 모든 활동을 추적하고 모니터링합니다.</p>
        </div>

        {/* 감사 통계 */}
        <div className="grid md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">총 이벤트</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {auditStats.totalEvents.toLocaleString()}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">오늘</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {auditStats.todayEvents.toLocaleString()}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">심각한 이벤트</p>
                  <p className="text-2xl font-bold text-red-600">
                    {auditStats.criticalEvents}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">실패 시도</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {auditStats.failedAttempts}
                  </p>
                </div>
                <Lock className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">활성 사용자</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {auditStats.uniqueUsers}
                  </p>
                </div>
                <User className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 탭 네비게이션 */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'logs', label: '로그 조회', icon: FileText },
                { key: 'stats', label: '통계 분석', icon: Activity },
                { key: 'alerts', label: '보안 알림', icon: AlertTriangle },
                { key: 'export', label: '내보내기', icon: Download },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as any)}
                  className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === key
                      ? 'border-blue-500 text-blue-600'
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

        {/* 로그 조회 탭 */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            {/* 필터 및 검색 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  필터 & 검색
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <Input
                    placeholder="사용자 이메일 또는 액션 검색..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="md:col-span-2"
                  />
                  
                  <select
                    value={filters.category}
                    onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                    className="p-2 border border-gray-300 rounded-md"
                  >
                    <option value="all">모든 카테고리</option>
                    <option value="auth">인증</option>
                    <option value="admin">관리자</option>
                    <option value="payment">결제</option>
                    <option value="system">시스템</option>
                    <option value="user">사용자</option>
                    <option value="security">보안</option>
                  </select>

                  <select
                    value={filters.severity}
                    onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                    className="p-2 border border-gray-300 rounded-md"
                  >
                    <option value="all">모든 심각도</option>
                    <option value="critical">심각</option>
                    <option value="high">높음</option>
                    <option value="medium">보통</option>
                    <option value="low">낮음</option>
                  </select>

                  <select
                    value={filters.dateRange}
                    onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                    className="p-2 border border-gray-300 rounded-md"
                  >
                    <option value="1d">오늘</option>
                    <option value="7d">7일</option>
                    <option value="30d">30일</option>
                    <option value="90d">90일</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* 로그 목록 */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    감사 로그 ({auditLogs.length})
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadAuditLogs}
                    disabled={loadingLogs}
                  >
                    {loadingLogs ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    새로고침
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {auditLogs.length > 0 ? (
                  <div className="space-y-3">
                    {auditLogs.map((log) => (
                      <div 
                        key={log.id} 
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setSelectedLog(log)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100">
                              {getCategoryIcon(log.category)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-gray-900">{log.action}</span>
                                <Badge className={getSeverityColor(log.severity)}>
                                  {log.severity}
                                </Badge>
                                {log.success ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-red-600" />
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-1">
                                {log.userEmail} • {log.resource}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(log.timestamp).toLocaleString('ko-KR')} • {log.ipAddress}
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">검색 조건에 맞는 로그가 없습니다</p>
                    <p className="text-sm text-gray-400">필터 조건을 변경해보세요</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* 통계 분석 탭 */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  주요 활동 통계
                </CardTitle>
              </CardHeader>
              <CardContent>
                {auditStats.topActions.length > 0 ? (
                  <div className="space-y-4">
                    {auditStats.topActions.map((action, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-900">{action.action}</span>
                        <Badge variant="outline">{action.count}회</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Activity className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">통계 데이터가 없습니다</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* 보안 알림 탭 */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  보안 알림 설정
                </CardTitle>
                <CardDescription>
                  의심스러운 활동이 감지되면 알림을 받도록 설정합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-red-800">활성 보안 알림</h3>
                        <div className="mt-2 space-y-1 text-sm text-red-700">
                          <div className="flex items-center justify-between">
                            <span>• 연속 로그인 실패 (5회 이상)</span>
                            <Badge className="bg-red-100 text-red-700">활성</Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>• 관리자 권한 변경</span>
                            <Badge className="bg-red-100 text-red-700">활성</Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>• 대량 데이터 접근</span>
                            <Badge className="bg-red-100 text-red-700">활성</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Button variant="outline" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    알림 설정 관리
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 내보내기 탭 */}
        {activeTab === 'export' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  로그 내보내기
                </CardTitle>
                <CardDescription>
                  감사 로그를 CSV 파일로 내보냅니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        기간
                      </label>
                      <select className="w-full p-2 border border-gray-300 rounded-md">
                        <option value="7d">최근 7일</option>
                        <option value="30d">최근 30일</option>
                        <option value="90d">최근 90일</option>
                        <option value="all">전체 기간</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        형식
                      </label>
                      <select className="w-full p-2 border border-gray-300 rounded-md">
                        <option value="csv">CSV 파일</option>
                        <option value="json">JSON 파일</option>
                        <option value="pdf">PDF 보고서</option>
                      </select>
                    </div>
                  </div>
                  
                  <Button onClick={handleExportLogs} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    로그 내보내기
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 로그 상세보기 모달 (간단한 구현) */}
        {selectedLog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-900">로그 상세 정보</h2>
                <Button variant="ghost" onClick={() => setSelectedLog(null)}>
                  ✕
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">액션</label>
                  <p className="text-gray-900">{selectedLog.action}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">사용자</label>
                  <p className="text-gray-900">{selectedLog.userEmail}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">리소스</label>
                  <p className="text-gray-900">{selectedLog.resource}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">상세 내용</label>
                  <p className="text-gray-900">{selectedLog.details}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">IP 주소</label>
                    <p className="text-gray-900">{selectedLog.ipAddress}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">시간</label>
                    <p className="text-gray-900">{new Date(selectedLog.timestamp).toLocaleString('ko-KR')}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">User Agent</label>
                  <p className="text-gray-900 text-sm break-all">{selectedLog.userAgent}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}