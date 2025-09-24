'use client';

import { useState, useEffect } from 'react';
import { fetchExport } from '@/lib/utils/api-fetch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  Download,
  FileText,
  Image,
  Database,
  Archive,
  Calendar,
  Clock,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import Link from 'next/link';

interface ExportData {
  profile: boolean;
  projects: boolean;
  characters: boolean;
  generations: boolean;
  usage: boolean;
  payments: boolean;
}

interface ExportHistory {
  id: string;
  type: string;
  status: 'completed' | 'failed' | 'processing';
  createdAt: string;
  downloadUrl?: string;
  fileSize?: string;
}

export default function ExportPage() {
  const [selectedData, setSelectedData] = useState<ExportData>({
    profile: true,
    projects: true,
    characters: true,
    generations: false,
    usage: true,
    payments: true,
  });

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [message, setMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null);

  const [exportHistory, setExportHistory] = useState<ExportHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    loadExportHistory();
  }, []);

  const loadExportHistory = async () => {
    try {
      setHistoryLoading(true);
      const response = await fetch('/api/settings/export');
      const data = await response.json();
      
      if (data.success) {
        const history = data.data.map((item: any) => ({
          id: item.id,
          type: item.export_type || '데이터',
          status: item.status,
          createdAt: item.created_at,
          downloadUrl: item.download_url,
          fileSize: item.file_size ? `${(item.file_size / 1024).toFixed(1)}KB` : undefined
        }));
        setExportHistory(history);
      }
    } catch (error) {
      console.error('Failed to load export history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDataChange = (key: keyof ExportData, checked: boolean) => {
    setSelectedData(prev => ({
      ...prev,
      [key]: checked
    }));
  };

  const handleStartExport = async () => {
    try {
      setExporting(true);
      setExportProgress(0);
      setMessage({ type: 'info', text: '데이터 내보내기를 시작합니다...' });

      // 진행률 시뮬레이션
      const intervals = [10, 30, 50, 70, 85];
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          const next = intervals.find(v => v > prev) || 90;
          return next;
        });
      }, 500);

      // fetchExport 유틸리티 사용 (10분 타임아웃 내장)
      const response = await fetchExport('/api/settings/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ exportData: selectedData })
      });

      const data = await response.json();
      
      clearInterval(progressInterval);
      setExportProgress(100);
      
      if (data.success) {
        // 다운로드 링크 생성 (실제로는 서버에서 파일 생성 후 링크 제공)
        const blob = new Blob([JSON.stringify(data.data, null, 2)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gentoon-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setMessage({ type: 'success', text: '데이터 내보내기가 완료되었습니다. 파일이 자동으로 다운로드됩니다.' });
        await loadExportHistory(); // 기록 새로고침
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Export error:', error);
      setMessage({ type: 'error', text: error.message || '데이터 내보내기 중 오류가 발생했습니다.' });
    } finally {
      setExporting(false);
      setTimeout(() => setExportProgress(0), 1000);
    }
  };

  const exportOptions = [
    {
      key: 'profile' as keyof ExportData,
      label: '프로필 정보',
      description: '계정 정보, 설정, 알림 설정 등',
      icon: FileText,
      estimatedSize: '< 1MB',
    },
    {
      key: 'projects' as keyof ExportData,
      label: '웹툰 프로젝트',
      description: '생성한 모든 웹툰 프로젝트와 메타데이터',
      icon: Archive,
      estimatedSize: '1-5MB',
    },
    {
      key: 'characters' as keyof ExportData,
      label: '캐릭터 데이터',
      description: '등록한 캐릭터 정보와 레퍼런스 이미지',
      icon: Image,
      estimatedSize: '5-20MB',
    },
    {
      key: 'generations' as keyof ExportData,
      label: '생성 이미지',
      description: 'AI로 생성한 모든 이미지 파일 (대용량)',
      icon: Database,
      estimatedSize: '100MB+',
    },
    {
      key: 'usage' as keyof ExportData,
      label: '사용량 데이터',
      description: '토큰 사용 내역, 활동 로그 등',
      icon: Clock,
      estimatedSize: '< 1MB',
    },
    {
      key: 'payments' as keyof ExportData,
      label: '결제 내역',
      description: '구독 및 결제 관련 모든 데이터',
      icon: Calendar,
      estimatedSize: '< 1MB',
    },
  ];

  const getStatusColor = (status: ExportHistory['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'processing': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: ExportHistory['status']) => {
    switch (status) {
      case 'completed': return '완료';
      case 'failed': return '실패';
      case 'processing': return '처리중';
      default: return '알 수 없음';
    }
  };

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
                <h1 className="text-2xl font-bold text-gray-900">데이터 내보내기</h1>
                <p className="text-gray-600 mt-1">계정 데이터를 안전하게 내보내세요</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {/* 메시지 표시 */}
        {message && (
          <div className={`mb-6 flex items-center gap-2 p-4 rounded-lg border ${
            message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
            message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
            'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> :
             message.type === 'error' ? <AlertCircle className="h-5 w-5" /> :
             <Info className="h-5 w-5" />}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 내보내기 설정 */}
          <div className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  내보낼 데이터 선택
                </CardTitle>
                <p className="text-sm text-gray-600">
                  내보내고 싶은 데이터를 선택하세요. 데이터 크기에 따라 처리 시간이 달라질 수 있습니다.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {exportOptions.map((option, index) => {
                    const Icon = option.icon;
                    return (
                      <div key={option.key} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <Checkbox
                          id={option.key}
                          checked={selectedData[option.key]}
                          onCheckedChange={(checked) => handleDataChange(option.key, !!checked)}
                        />
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mt-0.5">
                            <Icon className="h-4 w-4 text-purple-600" />
                          </div>
                          <div className="flex-1">
                            <Label htmlFor={option.key} className="text-sm font-medium text-gray-900 cursor-pointer">
                              {option.label}
                            </Label>
                            <p className="text-xs text-gray-600 mt-1">{option.description}</p>
                            <p className="text-xs text-purple-600 mt-1 font-medium">예상 크기: {option.estimatedSize}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {exporting && (
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm font-medium text-blue-900">데이터 내보내는 중... ({exportProgress}%)</span>
                    </div>
                    <Progress value={exportProgress} className="w-full" />
                  </div>
                )}

                <Button 
                  onClick={handleStartExport} 
                  disabled={exporting || Object.values(selectedData).every(v => !v)}
                  className="w-full mt-6 bg-purple-600 hover:bg-purple-700"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exporting ? '내보내는 중...' : '데이터 내보내기'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* 내보내기 기록 */}
          <div className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Archive className="h-5 w-5" />
                  내보내기 기록
                </CardTitle>
                <p className="text-sm text-gray-600">
                  이전 내보내기 기록과 다운로드 링크입니다. 링크는 7일간 유효합니다.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {historyLoading ? (
                    <div className="animate-pulse space-y-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
                      ))}
                    </div>
                  ) : exportHistory.length > 0 ? (
                    exportHistory.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-medium text-gray-900">{item.type}</h3>
                            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(item.status)}`}>
                              {getStatusText(item.status)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">
                            {new Date(item.createdAt).toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                            {item.fileSize && ` • ${item.fileSize}`}
                          </p>
                        </div>
                        {item.status === 'completed' && item.downloadUrl && (
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-2" />
                            다운로드
                          </Button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Archive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">아직 내보내기 기록이 없습니다</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 안내사항 */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-blue-600">내보내기 안내</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <p>데이터는 JSON 및 ZIP 형식으로 제공됩니다.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <p>대용량 파일은 이메일로 다운로드 링크가 전송됩니다.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <p>다운로드 링크는 7일간 유효하며, 이후 자동 삭제됩니다.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <p>내보내기 요청은 하루에 최대 3회까지 가능합니다.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}