'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';
import {
  MessageSquare,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Edit,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  User,
  Calendar,
  Tag,
  AlertTriangle,
  Mail,
  Trash2
} from 'lucide-react';

interface Inquiry {
  id: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  adminResponse?: string;
  respondedBy?: string;
  respondedAt?: string;
  userEmail?: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

interface InquiryStats {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  closed: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  general: '일반 문의',
  technical: '기술적 문제',
  billing: '결제 관련',
  feature: '기능 요청',
  bug: '버그 신고',
  account: '계정 관련'
};

const PRIORITY_LABELS = {
  low: '낮음',
  normal: '보통',
  high: '높음',
  urgent: '긴급'
};

const STATUS_LABELS = {
  pending: '대기',
  in_progress: '처리중',
  resolved: '해결됨',
  closed: '종료됨'
};

export default function InquiriesAdminPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [stats, setStats] = useState<InquiryStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [responseText, setResponseText] = useState('');
  const [responseStatus, setResponseStatus] = useState('');
  const [responsePriority, setResponsePriority] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 문의사항 목록 로드
  const loadInquiries = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      if (priorityFilter) params.append('priority', priorityFilter);
      params.append('limit', '50');

      const response = await fetch(`/api/admin/inquiries?${params}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '문의사항 목록 조회에 실패했습니다');
      }

      setInquiries(result.inquiries);
      setStats(result.stats);
    } catch (error) {
      console.error('문의사항 목록 로드 실패:', error);
      toast.error(error instanceof Error ? error.message : '문의사항 목록 로드 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 문의사항 상세 보기
  const viewInquiry = (inquiry: Inquiry) => {
    setSelectedInquiry(inquiry);
    setResponseText(inquiry.adminResponse || '');
    setResponseStatus(inquiry.status);
    setResponsePriority(inquiry.priority);
    setIsDialogOpen(true);
  };

  // 문의사항 답변/상태 업데이트
  const updateInquiry = async () => {
    if (!selectedInquiry) return;

    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/admin/inquiries/${selectedInquiry.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminResponse: responseText.trim() || undefined,
          status: responseStatus !== selectedInquiry.status ? responseStatus : undefined,
          priority: responsePriority !== selectedInquiry.priority ? responsePriority : undefined
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '문의사항 업데이트에 실패했습니다');
      }

      toast.success('문의사항이 성공적으로 업데이트되었습니다');
      setIsDialogOpen(false);
      setSelectedInquiry(null);
      setResponseText('');
      await loadInquiries(); // 목록 새로고침

    } catch (error) {
      console.error('문의사항 업데이트 실패:', error);
      toast.error(error instanceof Error ? error.message : '문의사항 업데이트 중 오류가 발생했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 문의사항 삭제
  const deleteInquiry = async (inquiryId: string) => {
    if (!confirm('정말로 이 문의사항을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/admin/inquiries/${inquiryId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '문의사항 삭제에 실패했습니다');
      }

      toast.success('문의사항이 성공적으로 삭제되었습니다');
      await loadInquiries(); // 목록 새로고침

    } catch (error) {
      console.error('문의사항 삭제 실패:', error);
      toast.error(error instanceof Error ? error.message : '문의사항 삭제 중 오류가 발생했습니다');
    }
  };

  // 상태별 색상 및 아이콘
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Clock className="h-3 w-3 mr-1" />{STATUS_LABELS[status]}</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="text-blue-600 border-blue-600"><AlertCircle className="h-3 w-3 mr-1" />{STATUS_LABELS[status]}</Badge>;
      case 'resolved':
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle className="h-3 w-3 mr-1" />{STATUS_LABELS[status]}</Badge>;
      case 'closed':
        return <Badge variant="outline" className="text-gray-600 border-gray-600"><XCircle className="h-3 w-3 mr-1" />{STATUS_LABELS[status]}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // 우선순위별 색상
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive">{PRIORITY_LABELS[priority]}</Badge>;
      case 'high':
        return <Badge variant="outline" className="text-orange-600 border-orange-600">{PRIORITY_LABELS[priority]}</Badge>;
      case 'normal':
        return <Badge variant="outline">{PRIORITY_LABELS[priority]}</Badge>;
      case 'low':
        return <Badge variant="outline" className="text-gray-500 border-gray-500">{PRIORITY_LABELS[priority]}</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  useEffect(() => {
    loadInquiries();
  }, []);

  // 필터 적용 시 자동 새로고침
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadInquiries();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, statusFilter, categoryFilter, priorityFilter]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">문의사항 관리</h1>
          <p className="text-gray-600 mt-2">고객 문의사항을 관리하고 답변할 수 있습니다</p>
        </div>
        <Button onClick={loadInquiries} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">전체</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm text-gray-600">대기</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">처리중</p>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">해결</p>
                <p className="text-2xl font-bold">{stats.resolved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600">종료</p>
                <p className="text-2xl font-bold">{stats.closed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            필터
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">검색</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                <Input
                  id="search"
                  placeholder="제목 또는 내용 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="status-filter">상태</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="상태 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">전체</SelectItem>
                  <SelectItem value="pending">대기</SelectItem>
                  <SelectItem value="in_progress">처리중</SelectItem>
                  <SelectItem value="resolved">해결됨</SelectItem>
                  <SelectItem value="closed">종료됨</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category-filter">카테고리</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">전체</SelectItem>
                  <SelectItem value="general">일반 문의</SelectItem>
                  <SelectItem value="technical">기술적 문제</SelectItem>
                  <SelectItem value="billing">결제 관련</SelectItem>
                  <SelectItem value="feature">기능 요청</SelectItem>
                  <SelectItem value="bug">버그 신고</SelectItem>
                  <SelectItem value="account">계정 관련</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority-filter">우선순위</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="우선순위 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">전체</SelectItem>
                  <SelectItem value="urgent">긴급</SelectItem>
                  <SelectItem value="high">높음</SelectItem>
                  <SelectItem value="normal">보통</SelectItem>
                  <SelectItem value="low">낮음</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 문의사항 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>문의사항 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              로딩 중...
            </div>
          ) : inquiries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              문의사항이 없습니다.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>제목</TableHead>
                  <TableHead>사용자</TableHead>
                  <TableHead>카테고리</TableHead>
                  <TableHead>우선순위</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>생성일</TableHead>
                  <TableHead>작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inquiries.map((inquiry) => (
                  <TableRow key={inquiry.id}>
                    <TableCell className="font-medium max-w-xs">
                      <div className="truncate">{inquiry.subject}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">{inquiry.user.name || inquiry.user.email}</p>
                          <p className="text-xs text-gray-500">{inquiry.user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <Tag className="h-3 w-3 mr-1" />
                        {CATEGORY_LABELS[inquiry.category] || inquiry.category}
                      </Badge>
                    </TableCell>
                    <TableCell>{getPriorityBadge(inquiry.priority)}</TableCell>
                    <TableCell>{getStatusBadge(inquiry.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Calendar className="h-3 w-3" />
                        {new Date(inquiry.createdAt).toLocaleDateString('ko-KR')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewInquiry(inquiry)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          보기
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteInquiry(inquiry.id)}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 문의사항 상세 및 답변 다이얼로그 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              문의사항 상세 및 답변
            </DialogTitle>
            <DialogDescription>
              문의사항을 확인하고 답변을 작성하세요
            </DialogDescription>
          </DialogHeader>

          {selectedInquiry && (
            <div className="space-y-6">
              {/* 문의사항 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">문의 정보</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">제목</Label>
                      <p className="font-medium">{selectedInquiry.subject}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">카테고리</Label>
                      <p>{CATEGORY_LABELS[selectedInquiry.category] || selectedInquiry.category}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">현재 상태</Label>
                      <div className="mt-1">{getStatusBadge(selectedInquiry.status)}</div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">현재 우선순위</Label>
                      <div className="mt-1">{getPriorityBadge(selectedInquiry.priority)}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">사용자 정보</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">이름</Label>
                      <p>{selectedInquiry.user.name || '미설정'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">이메일</Label>
                      <p className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        {selectedInquiry.user.email}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">문의 일시</Label>
                      <p>{new Date(selectedInquiry.createdAt).toLocaleString('ko-KR')}</p>
                    </div>
                    {selectedInquiry.userEmail && selectedInquiry.userEmail !== selectedInquiry.user.email && (
                      <div>
                        <Label className="text-sm font-medium text-gray-600">연락처 이메일</Label>
                        <p>{selectedInquiry.userEmail}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* 문의 내용 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">문의 내용</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
                    {selectedInquiry.message}
                  </div>
                </CardContent>
              </Card>

              {/* 기존 답변 */}
              {selectedInquiry.adminResponse && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-green-600">기존 답변</CardTitle>
                    <p className="text-sm text-gray-500">
                      답변자: {selectedInquiry.respondedBy} | 
                      답변일: {selectedInquiry.respondedAt ? new Date(selectedInquiry.respondedAt).toLocaleString('ko-KR') : '미설정'}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200 whitespace-pre-wrap">
                      {selectedInquiry.adminResponse}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 답변 및 상태 변경 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">답변 작성 및 상태 변경</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="response-status">상태 변경</Label>
                      <Select value={responseStatus} onValueChange={setResponseStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">대기</SelectItem>
                          <SelectItem value="in_progress">처리중</SelectItem>
                          <SelectItem value="resolved">해결됨</SelectItem>
                          <SelectItem value="closed">종료됨</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="response-priority">우선순위 변경</Label>
                      <Select value={responsePriority} onValueChange={setResponsePriority}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">낮음</SelectItem>
                          <SelectItem value="normal">보통</SelectItem>
                          <SelectItem value="high">높음</SelectItem>
                          <SelectItem value="urgent">긴급</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="response-text">답변 내용</Label>
                    <Textarea
                      id="response-text"
                      placeholder="고객에게 전달할 답변을 작성하세요..."
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      rows={6}
                      className="mt-1"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              취소
            </Button>
            <Button 
              onClick={updateInquiry} 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  업데이트 중...
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  업데이트
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}