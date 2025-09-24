/**
 * 네이버급 실시간 보안 모니터링 대시보드
 * 실시간 위협 탐지, 메트릭 시각화, 보안 관리
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  Ban, 
  Eye, 
  Clock,
  Globe,
  Zap,
  Target,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';

interface SecurityMetrics {
  realTime: {
    requestsPerSecond: number;
    blockedRequestsPerSecond: number;
    uniqueIPs: number;
    activeThreats: number;
    systemLoad: number;
  };
  hourly: {
    totalRequests: number;
    blockedRequests: number;
    rateLimitViolations: number;
    ipBlockCount: number;
    maliciousPatternCount: number;
    topAttackerIPs: Array<{ ip: string; count: number; lastSeen: number }>;
    topTargetPaths: Array<{ path: string; count: number; severity: string }>;
  };
}

interface SecurityEvent {
  id: string;
  timestamp: number;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ip: string;
  path?: string;
  description: string;
}

interface ThreatAlert {
  id: string;
  timestamp: number;
  title: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ip: string;
  description: string;
}

interface DashboardData {
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  threatLevel: number;
  keyMetrics: {
    requestsPerSecond: number;
    blockedRequestsPerSecond: number;
    uniqueIPs: number;
    activeThreats: number;
    systemLoad: string;
  };
  hourlyStats: {
    totalRequests: number;
    blockedRequests: number;
    blockRate: string;
    rateLimitViolations: number;
    ipBlocks: number;
    maliciousPatterns: number;
  };
  topThreats: {
    attackerIPs: Array<{ ip: string; count: number; lastSeen: number }>;
    targetPaths: Array<{ path: string; count: number; severity: string }>;
  };
  recentEvents: SecurityEvent[];
  alerts: ThreatAlert[];
}

export default function SecurityDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // 관리 액션 상태
  const [blockIpInput, setBlockIpInput] = useState('');
  const [blockDuration, setBlockDuration] = useState('60');
  const [blockReason, setBlockReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  /**
   * 대시보드 데이터 로드
   */
  const loadDashboardData = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/security/monitoring?type=overview');
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error);
      }

      setDashboardData(result.data.overview);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * IP 차단 액션
   */
  const handleBlockIP = async () => {
    if (!blockIpInput.trim()) return;
    
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/security/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'block_ip',
          data: {
            ip: blockIpInput.trim(),
            duration: parseInt(blockDuration),
            reason: blockReason || '관리자 수동 차단'
          }
        })
      });

      const result = await response.json();
      if (result.success) {
        alert(`✅ ${result.data.message}`);
        setBlockIpInput('');
        setBlockReason('');
        loadDashboardData(); // 데이터 새로고침
      } else {
        alert(`❌ ${result.error}`);
      }
    } catch (err) {
      alert('❌ IP 차단 실패');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * 테스트 알림 생성
   */
  const handleTestAlert = async () => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/security/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_alert',
          data: {}
        })
      });

      const result = await response.json();
      if (result.success) {
        alert('✅ 테스트 알림이 생성되었습니다');
        loadDashboardData();
      } else {
        alert(`❌ ${result.error}`);
      }
    } catch (err) {
      alert('❌ 테스트 알림 생성 실패');
    } finally {
      setActionLoading(false);
    }
  };

  // 자동 새로고침
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(loadDashboardData, 5000); // 5초마다
    return () => clearInterval(interval);
  }, [autoRefresh, loadDashboardData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span>보안 데이터 로딩 중...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <Alert className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NORMAL': return 'text-green-600 bg-green-50';
      case 'WARNING': return 'text-yellow-600 bg-yellow-50';
      case 'CRITICAL': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      LOW: 'bg-blue-100 text-blue-800',
      MEDIUM: 'bg-yellow-100 text-yellow-800',
      HIGH: 'bg-orange-100 text-orange-800',
      CRITICAL: 'bg-red-100 text-red-800'
    };
    return colors[severity as keyof typeof colors] || colors.LOW;
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">보안 모니터링</h1>
          <p className="text-muted-foreground">
            실시간 위협 탐지 및 보안 현황 · 마지막 업데이트: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboardData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className="h-4 w-4 mr-2" />
            자동새로고침 {autoRefresh ? 'ON' : 'OFF'}
          </Button>
        </div>
      </div>

      {dashboardData && (
        <>
          {/* 전체 상태 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>보안 현황</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(dashboardData.status)}`}>
                    {dashboardData.status === 'NORMAL' && <CheckCircle className="h-4 w-4 mr-1" />}
                    {dashboardData.status === 'WARNING' && <AlertTriangle className="h-4 w-4 mr-1" />}
                    {dashboardData.status === 'CRITICAL' && <XCircle className="h-4 w-4 mr-1" />}
                    {dashboardData.status}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">전체 상태</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {dashboardData.threatLevel}/10
                  </div>
                  <p className="text-sm text-muted-foreground">위협 레벨</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {dashboardData.keyMetrics.activeThreats}
                  </div>
                  <p className="text-sm text-muted-foreground">활성 위협</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {dashboardData.keyMetrics.systemLoad}
                  </div>
                  <p className="text-sm text-muted-foreground">시스템 로드</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 실시간 메트릭 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">초당 요청</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardData.keyMetrics.requestsPerSecond}
                </div>
                <p className="text-xs text-muted-foreground">RPS</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">차단된 요청</CardTitle>
                <Ban className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {dashboardData.keyMetrics.blockedRequestsPerSecond}
                </div>
                <p className="text-xs text-muted-foreground">초당 차단</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">고유 IP</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardData.keyMetrics.uniqueIPs}
                </div>
                <p className="text-xs text-muted-foreground">접속 IP 수</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">차단률</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {dashboardData.hourlyStats.blockRate}%
                </div>
                <p className="text-xs text-muted-foreground">시간당 차단률</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="events" className="space-y-4">
            <TabsList>
              <TabsTrigger value="events">보안 이벤트</TabsTrigger>
              <TabsTrigger value="threats">위협 분석</TabsTrigger>
              <TabsTrigger value="alerts">알림 관리</TabsTrigger>
              <TabsTrigger value="actions">보안 액션</TabsTrigger>
            </TabsList>

            <TabsContent value="events" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>최근 보안 이벤트</CardTitle>
                  <CardDescription>실시간으로 탐지된 보안 이벤트 목록</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {dashboardData.recentEvents.length > 0 ? (
                      dashboardData.recentEvents.map((event) => (
                        <div key={event.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Badge className={getSeverityBadge(event.severity)}>
                              {event.severity}
                            </Badge>
                            <Badge variant="outline">{event.type}</Badge>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{event.description}</p>
                            <p className="text-xs text-muted-foreground">
                              IP: {event.ip} · {new Date(event.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        최근 보안 이벤트가 없습니다
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="threats" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Top 공격 IP</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {dashboardData.topThreats.attackerIPs.map((attacker, index) => (
                        <div key={attacker.ip} className="flex items-center justify-between p-2 border rounded">
                          <span className="font-mono text-sm">{attacker.ip}</span>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">{attacker.count}회</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(attacker.lastSeen).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top 공격 경로</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {dashboardData.topThreats.targetPaths.map((path, index) => (
                        <div key={path.path} className="flex items-center justify-between p-2 border rounded">
                          <span className="font-mono text-sm truncate">{path.path}</span>
                          <div className="flex items-center space-x-2">
                            <Badge className={getSeverityBadge(path.severity)}>
                              {path.severity}
                            </Badge>
                            <Badge variant="outline">{path.count}회</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="alerts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>활성 알림</CardTitle>
                  <CardDescription>현재 활성화된 보안 알림</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboardData.alerts.length > 0 ? (
                      dashboardData.alerts.map((alert) => (
                        <Alert key={alert.id} className="border-l-4 border-l-red-500">
                          <AlertCircle className="h-4 w-4" />
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold">{alert.title}</div>
                              <AlertDescription className="mt-1">
                                {alert.description}
                              </AlertDescription>
                              <p className="text-xs text-muted-foreground mt-1">
                                IP: {alert.ip} · {new Date(alert.timestamp).toLocaleString()}
                              </p>
                            </div>
                            <Badge className={getSeverityBadge(alert.severity)}>
                              {alert.severity}
                            </Badge>
                          </div>
                        </Alert>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        활성 알림이 없습니다
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>IP 차단</CardTitle>
                    <CardDescription>특정 IP를 수동으로 차단합니다</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label htmlFor="blockIp">IP 주소</Label>
                      <Input
                        id="blockIp"
                        placeholder="192.168.1.100"
                        value={blockIpInput}
                        onChange={(e) => setBlockIpInput(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="blockDuration">차단 시간 (분)</Label>
                      <Input
                        id="blockDuration"
                        type="number"
                        placeholder="60"
                        value={blockDuration}
                        onChange={(e) => setBlockDuration(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="blockReason">차단 사유</Label>
                      <Input
                        id="blockReason"
                        placeholder="관리자 수동 차단"
                        value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleBlockIP}
                      disabled={!blockIpInput.trim() || actionLoading}
                      className="w-full"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      IP 차단
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>시스템 테스트</CardTitle>
                    <CardDescription>보안 시스템 기능을 테스트합니다</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant="outline"
                      onClick={handleTestAlert}
                      disabled={actionLoading}
                      className="w-full"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      테스트 알림 생성
                    </Button>
                    <Button
                      variant="outline"
                      onClick={loadDashboardData}
                      disabled={loading}
                      className="w-full"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      데이터 새로고침
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}