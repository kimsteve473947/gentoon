import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isUserAdmin } from '@/lib/auth/api-middleware';

// Mock 감사 로그 데이터 (실제로는 logs endpoint와 동일한 데이터 소스)
const mockAuditLogs = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    userId: 'admin-123',
    userEmail: 'admin@gentoon.ai',
    action: 'LOGIN_SUCCESS',
    resource: 'authentication_system',
    details: '관리자 로그인 성공',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    severity: 'low',
    category: 'auth',
    success: true
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    userId: 'admin-123',
    userEmail: 'admin@gentoon.ai',
    action: 'BACKUP_CREATE',
    resource: 'backup_system',
    details: '전체 데이터베이스 백업 생성',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    severity: 'medium',
    category: 'admin',
    success: true
  }
];

function convertToCSV(logs: any[]): string {
  if (logs.length === 0) return '';

  // CSV 헤더
  const headers = [
    'ID', 'Timestamp', 'User ID', 'User Email', 'Action', 'Resource',
    'Details', 'IP Address', 'User Agent', 'Severity', 'Category', 'Success'
  ];

  // CSV 행들
  const rows = logs.map(log => [
    log.id,
    new Date(log.timestamp).toLocaleString('ko-KR'),
    log.userId,
    log.userEmail,
    log.action,
    log.resource,
    `"${log.details.replace(/"/g, '""')}"`, // CSV escape
    log.ipAddress,
    `"${log.userAgent.replace(/"/g, '""')}"`, // CSV escape
    log.severity,
    log.category,
    log.success ? 'SUCCESS' : 'FAILED'
  ]);

  // CSV 문자열 생성
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csvContent;
}

function convertToJSON(logs: any[]): string {
  return JSON.stringify({
    exportDate: new Date().toISOString(),
    totalRecords: logs.length,
    logs: logs
  }, null, 2);
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // 관리자 권한 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const isAdmin = await isUserAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // URL 파라미터에서 필터 조건 및 포맷 추출
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv'; // csv, json, pdf
    const dateRange = searchParams.get('dateRange') || '30d';
    const category = searchParams.get('category') || 'all';
    const severity = searchParams.get('severity') || 'all';

    console.log('감사 로그 내보내기:', { 
      format, 
      dateRange, 
      category, 
      severity,
      adminUserId: user.id,
      timestamp: new Date().toISOString() 
    });

    // 날짜 범위 계산
    const now = new Date();
    let startDate = new Date();
    switch (dateRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = new Date(0); // 모든 기간
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // 필터링 적용 (실제로는 데이터베이스 쿼리)
    let filteredLogs = mockAuditLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      
      // 날짜 범위 필터
      if (logDate < startDate) return false;
      
      // 카테고리 필터
      if (category !== 'all' && log.category !== category) return false;
      
      // 심각도 필터
      if (severity !== 'all' && log.severity !== severity) return false;
      
      return true;
    });

    // 최신순으로 정렬
    filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // TODO: 실제 감사 로그에 기록
    // await auditLog({
    //   userId: user.id,
    //   action: 'AUDIT_LOG_EXPORT',
    //   resource: 'audit_system',
    //   details: `감사 로그 내보내기 (${format.toUpperCase()}, ${filteredLogs.length}개 레코드)`,
    //   severity: 'medium',
    //   category: 'admin'
    // });

    // 포맷별 내보내기
    let content: string;
    let mimeType: string;
    let fileName: string;

    switch (format) {
      case 'json':
        content = convertToJSON(filteredLogs);
        mimeType = 'application/json';
        fileName = `audit_logs_${new Date().toISOString().split('T')[0]}.json`;
        break;
      case 'pdf':
        // PDF 생성은 복잡하므로 일단 JSON으로 대체
        content = convertToJSON(filteredLogs);
        mimeType = 'application/json';
        fileName = `audit_logs_${new Date().toISOString().split('T')[0]}.json`;
        break;
      case 'csv':
      default:
        content = convertToCSV(filteredLogs);
        mimeType = 'text/csv';
        fileName = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
        break;
    }

    // 한글 파일명을 위한 인코딩
    const encodedFileName = encodeURIComponent(fileName);

    return new NextResponse(content, {
      headers: {
        'Content-Type': `${mimeType}; charset=utf-8`,
        'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodedFileName}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('감사 로그 내보내기 오류:', error);
    return NextResponse.json(
      { error: '감사 로그 내보내기 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}