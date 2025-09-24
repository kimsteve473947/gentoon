'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  HelpCircle,
  Search,
  MessageSquare,
  Mail,
  Phone,
  BookOpen,
  Video,
  Users,
  Star,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Zap,
  CreditCard,
  Settings,
  Image,
  Palette,
  CheckCircle
} from 'lucide-react';
import Link from 'next/link';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({
    subject: '',
    message: '',
    category: 'general',
    userEmail: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const faqs: FAQ[] = [
    {
      id: 'faq-1',
      question: '토큰은 어떻게 사용하나요?',
      answer: '토큰은 AI 이미지 생성 시 사용됩니다. 이미지 1장 생성 시 약 100-500개의 토큰이 소모되며, 이미지 품질과 복잡도에 따라 달라질 수 있습니다. 플랜별로 월간 토큰 한도가 정해져 있습니다.',
      category: 'tokens'
    },
    {
      id: 'faq-2',
      question: '생성된 이미지의 저작권은 누구에게 있나요?',
      answer: 'GenToon에서 생성된 모든 이미지의 저작권은 사용자에게 있습니다. 상업적 이용도 자유롭게 하실 수 있습니다. 다만, 불법적이거나 유해한 콘텐츠 생성은 금지됩니다.',
      category: 'legal'
    },
    {
      id: 'faq-3',
      question: '구독 플랜을 변경하고 싶어요',
      answer: '설정 > 구독 관리에서 언제든지 플랜을 변경할 수 있습니다. 업그레이드 시 즉시 적용되며, 다운그레이드 시 현재 결제 주기 종료 후 적용됩니다.',
      category: 'billing'
    },
    {
      id: 'faq-4',
      question: '캐릭터 일관성은 어떻게 유지하나요?',
      answer: '캐릭터 등록 시 여러 각도의 레퍼런스 이미지를 업로드하세요. AI가 이를 학습하여 일관된 캐릭터로 이미지를 생성합니다. 더 많은 레퍼런스를 제공할수록 일관성이 높아집니다.',
      category: 'character'
    },
    {
      id: 'faq-5',
      question: '이미지 생성이 실패하는 이유는 무엇인가요?',
      answer: '토큰 부족, 부적절한 프롬프트, 시스템 오류 등이 원인일 수 있습니다. 프롬프트를 구체적이고 명확하게 작성하고, 토큰 잔액을 확인해보세요. 지속적인 문제 시 고객지원에 문의하세요.',
      category: 'generation'
    }
  ];

  const categories = [
    { id: 'all', name: '전체', icon: HelpCircle },
    { id: 'tokens', name: '토큰', icon: Zap },
    { id: 'billing', name: '결제', icon: CreditCard },
    { id: 'character', name: '캐릭터', icon: Users },
    { id: 'generation', name: '이미지 생성', icon: Image },
    { id: 'legal', name: '저작권/정책', icon: Settings }
  ];

  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredFAQs = faqs.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 필수 필드 검증
    if (!contactForm.subject.trim()) {
      toast.error('제목을 입력해주세요');
      return;
    }
    
    if (!contactForm.message.trim()) {
      toast.error('문의 내용을 입력해주세요');
      return;
    }

    if (contactForm.subject.length > 200) {
      toast.error('제목은 200자를 초과할 수 없습니다');
      return;
    }

    if (contactForm.message.length > 5000) {
      toast.error('내용은 5000자를 초과할 수 없습니다');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/inquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: contactForm.subject.trim(),
          message: contactForm.message.trim(),
          category: contactForm.category,
          userEmail: contactForm.userEmail.trim() || undefined
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '문의사항 전송에 실패했습니다');
      }

      // 성공 시 폼 초기화 및 성공 메시지
      setContactForm({
        subject: '',
        message: '',
        category: 'general',
        userEmail: ''
      });

      toast.success(result.message || '문의사항이 성공적으로 전송되었습니다', {
        description: '빠른 시일 내에 답변드리겠습니다'
      });

    } catch (error) {
      console.error('문의사항 전송 실패:', error);
      toast.error(error instanceof Error ? error.message : '문의사항 전송 중 오류가 발생했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
        <div className="px-6 py-12">
          <div className="max-w-4xl mx-auto text-center">
            <HelpCircle className="h-16 w-16 mx-auto mb-4 opacity-90" />
            <h1 className="text-4xl font-bold mb-4">도움이 필요하신가요?</h1>
            <p className="text-xl opacity-90 mb-8">
              GenToon 사용에 관한 모든 궁금증을 해결해드립니다
            </p>
            
            {/* 검색 */}
            <div className="max-w-2xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="궁금한 내용을 검색하세요..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-4 text-lg bg-white/90 backdrop-blur border-0 rounded-xl shadow-lg"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-8 max-w-6xl mx-auto">
        {/* 빠른 도움말 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">시작 가이드</h3>
              <p className="text-sm text-gray-600 mb-4">GenToon 사용법을 단계별로 배워보세요</p>
              <Button variant="outline" size="sm" className="text-blue-600 border-blue-200">
                가이드 보기
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Video className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">동영상 튜토리얼</h3>
              <p className="text-sm text-gray-600 mb-4">영상으로 쉽게 따라하는 웹툰 제작법</p>
              <Button variant="outline" size="sm" className="text-green-600 border-green-200">
                동영상 보기
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">커뮤니티</h3>
              <p className="text-sm text-gray-600 mb-4">다른 사용자들과 팁을 공유해보세요</p>
              <Button variant="outline" size="sm" className="text-purple-600 border-purple-200">
                참여하기
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* FAQ 섹션 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* 카테고리 필터 */}
          <div className="lg:col-span-1">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">카테고리</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {categories.map(category => {
                    const Icon = category.icon;
                    return (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                          selectedCategory === category.id
                            ? 'bg-purple-100 text-purple-700'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-sm">{category.name}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* FAQ 리스트 */}
          <div className="lg:col-span-3 space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">자주 묻는 질문</h2>
            
            {filteredFAQs.length > 0 ? (
              filteredFAQs.map(faq => (
                <Card key={faq.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    <button
                      onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
                      className="w-full flex items-center justify-between p-6 text-left"
                    >
                      <h3 className="font-medium text-gray-900 pr-4">{faq.question}</h3>
                      {expandedFAQ === faq.id ? (
                        <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-500 flex-shrink-0" />
                      )}
                    </button>
                    {expandedFAQ === faq.id && (
                      <div className="px-6 pb-6 text-gray-600 leading-relaxed">
                        {faq.answer}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-8 text-center">
                  <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">검색 결과가 없습니다.</p>
                  <p className="text-sm text-gray-400 mt-2">다른 검색어나 카테고리를 시도해보세요.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* 문의하기 섹션 */}
        <Card className="mt-12 border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              문의하기
            </CardTitle>
            <p className="text-gray-600">궁금한 점이 해결되지 않았다면 직접 문의해주세요.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* 문의 양식 */}
              <div>
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="category" className="text-sm font-medium text-gray-700">
                      문의 유형
                    </Label>
                    <select
                      id="category"
                      value={contactForm.category}
                      onChange={(e) => setContactForm(prev => ({ ...prev, category: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="general">일반 문의</option>
                      <option value="technical">기술적 문제</option>
                      <option value="billing">결제 관련</option>
                      <option value="feature">기능 요청</option>
                      <option value="bug">버그 신고</option>
                      <option value="account">계정 관련</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="userEmail" className="text-sm font-medium text-gray-700">
                      연락처 이메일 (선택사항)
                    </Label>
                    <Input
                      id="userEmail"
                      type="email"
                      value={contactForm.userEmail}
                      onChange={(e) => setContactForm(prev => ({ ...prev, userEmail: e.target.value }))}
                      placeholder="답변받을 이메일 주소 (기본: 로그인 계정 이메일)"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      입력하지 않으면 로그인한 계정의 이메일로 답변드립니다
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="subject" className="text-sm font-medium text-gray-700">
                      제목 *
                    </Label>
                    <Input
                      id="subject"
                      value={contactForm.subject}
                      onChange={(e) => setContactForm(prev => ({ ...prev, subject: e.target.value }))}
                      placeholder="문의 제목을 입력하세요"
                      className="mt-1"
                      maxLength={200}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {contactForm.subject.length}/200자
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="message" className="text-sm font-medium text-gray-700">
                      내용 *
                    </Label>
                    <Textarea
                      id="message"
                      value={contactForm.message}
                      onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="문의 내용을 상세히 입력해주세요"
                      rows={4}
                      className="mt-1"
                      maxLength={5000}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {contactForm.message.length}/5000자
                    </p>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isSubmitting || !contactForm.subject.trim() || !contactForm.message.trim()}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        전송 중...
                      </>
                    ) : (
                      '문의 보내기'
                    )}
                  </Button>
                </form>
              </div>

              {/* 연락처 정보 */}
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">다른 연락 방법</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Mail className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">이메일 문의</p>
                        <p className="text-sm text-gray-600">support@gentoon.ai</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <MessageSquare className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">실시간 채팅</p>
                        <p className="text-sm text-gray-600">평일 9:00 - 18:00</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-800">빠른 응답을 위한 팁</h4>
                      <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                        <li>• 계정 이메일 주소를 함께 알려주세요</li>
                        <li>• 오류 발생 시 스크린샷을 첨부해주세요</li>
                        <li>• 구체적인 상황 설명을 포함해주세요</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}