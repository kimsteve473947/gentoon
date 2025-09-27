'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Database, 
  Download, 
  Upload, 
  RefreshCw, 
  Clock,
  AlertTriangle,
  CheckCircle,
  HardDrive,
  Settings,
  ArrowLeft,
  Calendar,
  FileText,
  Users
} from 'lucide-react';
import Link from 'next/link';
import { useOptimizedSettings } from '@/hooks/useOptimizedSettings';
import { useRouter } from 'next/navigation';

// 백업 타입
interface BackupRecord {
  id: string;
  type: 'full' | 'incremental' | 'config' | 'user_data';
  name: string;
  size: number;
  created_at: string;
  status: 'completed' | 'failed' | 'in_progress';
  duration: number;
  description: string;
}

// 복구 포인트
interface RestorePoint {
  id: string;
  timestamp: string;
  version: string;
  type: 'automatic' | 'manual';
  size: number;
  tables_count: number;
  users_count: number;
}

export default function BackupPage() {
  const router = useRouter();
  const { subscription, loading } = useOptimizedSettings();
  const [activeTab, setActiveTab] = useState<'backup' | 'restore' | 'schedule' | 'history'>('backup');
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [restorePoints, setRestorePoints] = useState<RestorePoint[]>([]);
  const [storageInfo, setStorageInfo] = useState({
    used: 0,
    total: 0,
    backupCount: 0
  });
  
  // 백업 실행 상태
  const [backupStatus, setBackupStatus] = useState<'idle' | 'backing_up' | 'success' | 'error'>('idle');
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'restoring' | 'success' | 'error'>('idle');
  
  // 백업 옵션
  const [backupOptions, setBackupOptions] = useState({
    type: 'full',
    includeTables: ['users', 'subscriptions', 'projects', 'characters'],
    compression: true,
    encryption: true
  });

  useEffect(() => {
    if (!loading && subscription?.plan !== 'ADMIN') {
      router.push('/admin');
      return;
    }
    
    loadBackupHistory();
    loadRestorePoints();
    loadStorageInfo();
  }, [loading, subscription, router]);

  const loadBackupHistory = async () => {
    try {
      const response = await fetch('/api/admin-473947/backup/history');
      if (response.ok) {
        const data = await response.json();
        setBackups(data.backups || []);
      }
    } catch (error) {
      console.error('백업 기록 로드 실패:', error);
    }
  };

  const loadRestorePoints = async () => {
    try {
      const response = await fetch('/api/admin-473947/backup/restore-points');
      if (response.ok) {
        const data = await response.json();
        setRestorePoints(data.restorePoints || []);
      }
    } catch (error) {
      console.error('복구 포인트 로드 실패:', error);
    }
  };

  const loadStorageInfo = async () => {
    try {
      const response = await fetch('/api/admin-473947/backup/storage');
      if (response.ok) {
        const data = await response.json();
        setStorageInfo(data);
      }
    } catch (error) {
      console.error('스토리지 정보 로드 실패:', error);
    }
  };

  const handleBackup = async () => {
    setBackupStatus('backing_up');
    
    try {
      const response = await fetch('/api/admin-473947/backup/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backupOptions),
      });

      const data = await response.json();
      
      if (response.ok) {
        setBackupStatus('success');
        loadBackupHistory();
        loadStorageInfo();
        
        setTimeout(() => {
          setBackupStatus('idle');
        }, 3000);
      } else {
        setBackupStatus('error');
        alert(data.error || '백업 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('백업 실행 실패:', error);
      setBackupStatus('error');
      alert('백업 실행 중 오류가 발생했습니다.');
    }
  };

  const handleRestore = async (restorePointId: string) => {
    if (!confirm('이 복구 포인트로 시스템을 복원하시겠습니까? 현재 데이터가 덮어쓰여집니다.')) {
      return;
    }

    setRestoreStatus('restoring');
    
    try {
      const response = await fetch('/api/admin-473947/backup/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ restorePointId }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setRestoreStatus('success');
        alert('시스템 복원이 완료되었습니다.');
        
        setTimeout(() => {
          setRestoreStatus('idle');
        }, 3000);
      } else {
        setRestoreStatus('error');
        alert(data.error || '시스템 복원에 실패했습니다.');
      }
    } catch (error) {
      console.error('복원 실행 실패:', error);
      setRestoreStatus('error');
      alert('복원 실행 중 오류가 발생했습니다.');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}분 ${remainingSeconds}초`;
  };

  if (loading || subscription?.plan !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Database className="h-8 w-8 animate-pulse mx-auto mb-4 text-blue-600" />
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
            <Database className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">백업 & 복구 관리</h1>
          </div>
          <p className="text-gray-600">시스템 데이터를 백업하고 필요시 복원합니다.</p>
        </div>

        {/* 스토리지 정보 */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">사용된 공간</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatFileSize(storageInfo.used)}
                  </p>
                </div>
                <HardDrive className="h-8 w-8 text-blue-600" />
              </div>
              <div className="mt-4">
                <div className="bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min((storageInfo.used / storageInfo.total) * 100, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  총 {formatFileSize(storageInfo.total)} 중 사용
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">백업 파일 수</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {storageInfo.backupCount}개
                  </p>
                </div>
                <FileText className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">최근 백업</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {backups.length > 0 ? new Date(backups[0]?.created_at).toLocaleDateString('ko-KR') : '없음'}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 탭 네비게이션 */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'backup', label: '백업 생성', icon: Database },
                { key: 'restore', label: '시스템 복원', icon: RefreshCw },
                { key: 'schedule', label: '자동 백업', icon: Calendar },
                { key: 'history', label: '백업 기록', icon: FileText },
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

        {/* 백업 생성 탭 */}
        {activeTab === 'backup' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  새 백업 생성
                </CardTitle>
                <CardDescription>
                  시스템 데이터의 백업을 생성합니다. 백업은 안전하게 암호화되어 저장됩니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 백업 타입 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    백업 타입
                  </label>
                  <select
                    value={backupOptions.type}
                    onChange={(e) => setBackupOptions({ ...backupOptions, type: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="full">전체 백업 (모든 데이터)</option>
                    <option value="incremental">증분 백업 (변경된 데이터만)</option>
                    <option value="config">설정 백업 (시스템 설정만)</option>
                    <option value="user_data">사용자 데이터 백업</option>
                  </select>
                </div>

                {/* 포함할 테이블 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    포함할 데이터
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'users', label: '사용자 데이터' },
                      { key: 'subscriptions', label: '구독 정보' },
                      { key: 'projects', label: '프로젝트 데이터' },
                      { key: 'characters', label: '캐릭터 데이터' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={backupOptions.includeTables.includes(key)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBackupOptions({
                                ...backupOptions,
                                includeTables: [...backupOptions.includeTables, key]
                              });
                            } else {
                              setBackupOptions({
                                ...backupOptions,
                                includeTables: backupOptions.includeTables.filter(t => t !== key)
                              });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 백업 옵션 */}
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={backupOptions.compression}
                      onChange={(e) => setBackupOptions({ ...backupOptions, compression: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">압축 사용</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={backupOptions.encryption}
                      onChange={(e) => setBackupOptions({ ...backupOptions, encryption: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">암호화 사용</span>
                  </label>
                </div>

                {/* 백업 실행 버튼 */}
                <div className="flex justify-end">
                  <Button
                    onClick={handleBackup}
                    disabled={backupStatus === 'backing_up'}
                    className="flex items-center gap-2"
                  >
                    {backupStatus === 'backing_up' ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        백업 생성 중...
                      </>
                    ) : backupStatus === 'success' ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        백업 완료
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4" />
                        백업 시작
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 시스템 복원 탭 */}
        {activeTab === 'restore' && (
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  시스템 복원
                </CardTitle>
                <CardDescription>
                  이전 백업 시점으로 시스템을 복원합니다. 주의: 현재 데이터가 덮어쓰여질 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {restorePoints.length > 0 ? (
                  <div className="space-y-4">
                    {restorePoints.map((point) => (
                      <div key={point.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-gray-900">
                              {new Date(point.timestamp).toLocaleString('ko-KR')}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              버전 {point.version} • {formatFileSize(point.size)}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span>테이블 {point.tables_count}개</span>
                              <span>사용자 {point.users_count.toLocaleString()}명</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={point.type === 'automatic' ? 'secondary' : 'outline'}>
                              {point.type === 'automatic' ? '자동' : '수동'}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={restoreStatus === 'restoring'}
                              onClick={() => handleRestore(point.id)}
                            >
                              {restoreStatus === 'restoring' ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <RefreshCw className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">사용 가능한 복구 포인트가 없습니다</p>
                    <p className="text-sm text-gray-400">백업을 먼저 생성해주세요</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* 자동 백업 탭 */}
        {activeTab === 'schedule' && (
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  자동 백업 설정
                </CardTitle>
                <CardDescription>
                  정기적으로 자동 백업이 실행되도록 스케줄을 설정합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Settings className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-yellow-800">자동 백업 스케줄</h3>
                        <p className="text-sm text-yellow-700 mt-1">
                          현재 매일 오전 3시에 자동 백업이 실행됩니다.
                        </p>
                        <div className="mt-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>다음 백업 예정</span>
                            <span className="font-medium">오늘 오전 3:00</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>보관 기간</span>
                            <span className="font-medium">30일</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>백업 타입</span>
                            <span className="font-medium">증분 백업</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Button variant="outline" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    백업 스케줄 수정
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 백업 기록 탭 */}
        {activeTab === 'history' && (
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  백업 기록
                </CardTitle>
                <CardDescription>
                  과거 백업 실행 기록과 상태를 확인합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {backups.length > 0 ? (
                  <div className="space-y-4">
                    {backups.map((backup) => (
                      <div key={backup.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-gray-900">{backup.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">{backup.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span>{formatFileSize(backup.size)}</span>
                              <span>{formatDuration(backup.duration)}</span>
                              <span>{new Date(backup.created_at).toLocaleString('ko-KR')}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={
                              backup.status === 'completed' ? 'bg-green-100 text-green-700' :
                              backup.status === 'failed' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }>
                              {backup.status === 'completed' ? '완료' :
                               backup.status === 'failed' ? '실패' : '진행중'}
                            </Badge>
                            {backup.status === 'completed' && (
                              <Button variant="ghost" size="sm">
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">백업 기록이 없습니다</p>
                    <p className="text-sm text-gray-400">첫 백업을 생성해보세요</p>
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