'use client';

import { useState, useEffect } from 'react';
import { MessageCircle, X, Send, Upload, File, Trash2, Check, ArrowRight, LogIn } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { Textarea } from './textarea';
import { useToast } from './toast';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

interface AttachedFile {
  file: File;
  preview?: string;
  id: string;
}

export function InquiryWidget() {
  const { showError, showSuccess, ToastContainer } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<'closed' | 'menu' | 'form' | 'success'>('closed');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    phone: '',
    email: '',
    subject: '',
    message: '',
    category: ''
  });
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const supabase = createClient();

  // 사용자 인증 상태 확인
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user: currentUser }, error } = await supabase.auth.getUser();
        if (error) {
          console.error('Auth error:', error);
        }
        setUser(currentUser);
        
        // 사용자가 로그인되어 있으면 이메일 자동 입력
        if (currentUser?.email) {
          setFormData(prev => ({ ...prev, email: currentUser.email }));
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // 실시간 인증 상태 변화 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      if (session?.user?.email) {
        setFormData(prev => ({ ...prev, email: session.user.email }));
      } else {
        setFormData(prev => ({ ...prev, email: '' }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 페이지 로드 후 3초 뒤에 말풍선 표시
  const [showBubble, setShowBubble] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowBubble(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // 말풍선 자동 숨김 (10초 후)
  useEffect(() => {
    if (showBubble) {
      const timer = setTimeout(() => {
        setShowBubble(false);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [showBubble]);

  const handleOpen = () => {
    // 로그인하지 않은 사용자는 로그인 페이지로 이동
    if (!user && !isLoading) {
      window.location.href = '/auth/login?redirect=/';
      return;
    }
    
    setIsOpen(true);
    setCurrentStep('menu');
    setShowBubble(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setCurrentStep('closed');
    // 폼 초기화 (이메일은 유지)
    setFormData(prev => ({
      phone: '',
      email: prev.email, // 로그인된 사용자 이메일 유지
      subject: '',
      message: '',
      category: ''
    }));
    setAttachedFiles([]);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCategorySelect = (category: string, subject: string) => {
    setFormData(prev => ({
      ...prev,
      category,
      subject
    }));
    setCurrentStep('form');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // 최대 4개 파일 제한
    const availableSlots = 4 - attachedFiles.length;
    if (files.length > availableSlots) {
      showError(`최대 4개 파일까지 업로드 가능합니다.`);
      return;
    }

    const newFiles: AttachedFile[] = [];
    
    for (const file of files) {
      // 파일 크기 제한 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        showError(`${file.name}: 파일 크기는 10MB 이하여야 합니다.`);
        continue;
      }

      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const attachedFile: AttachedFile = {
        file,
        id: fileId
      };

      // 이미지 파일인 경우 미리보기 생성
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          attachedFile.preview = e.target?.result as string;
          setAttachedFiles(prev => [...prev, attachedFile]);
        };
        reader.readAsDataURL(file);
      } else {
        newFiles.push(attachedFile);
      }
    }

    if (newFiles.length > 0) {
      setAttachedFiles(prev => [...prev, ...newFiles]);
    }

    // 입력 필드 초기화
    event.target.value = '';
  };

  const removeFile = (fileId: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.phone || !formData.email || !formData.message) {
      showError("전화번호, 이메일, 문의내용을 모두 입력해주세요.");
      return;
    }

    // 전화번호 유효성 검증
    const phoneRegex = /^[0-9-+\s()]+$/;
    if (!phoneRegex.test(formData.phone)) {
      showError("올바른 전화번호 형식을 입력해주세요.");
      return;
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      showError("올바른 이메일 주소를 입력해주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      // FormData로 파일과 텍스트 데이터를 함께 전송
      const submitData = new FormData();
      submitData.append('phone', formData.phone);
      submitData.append('email', formData.email);
      submitData.append('subject', formData.subject || '제목 없음');
      submitData.append('message', formData.message);
      submitData.append('category', formData.category || 'general');

      // 첨부파일 추가
      attachedFiles.forEach((attachedFile, index) => {
        submitData.append(`file-${index}`, attachedFile.file);
      });

      console.log('📤 문의사항 제출 시작:', {
        phone: formData.phone,
        email: formData.email,
        subject: formData.subject,
        category: formData.category,
        attachmentCount: attachedFiles.length
      });

      const response = await fetch('/api/inquiries/public', {
        method: 'POST',
        body: submitData
      });

      console.log('📡 API 응답 상태:', response.status, response.statusText);

      let result;
      
      // 응답을 먼저 텍스트로 읽어서 확인
      const responseText = await response.text();
      console.log('📄 원본 응답:', responseText);
      console.log('📡 응답 헤더:', Object.fromEntries(response.headers.entries()));
      
      try {
        result = JSON.parse(responseText);
        console.log('📋 API 응답 데이터:', result);
      } catch (parseError) {
        console.error('❌ JSON 파싱 실패:', parseError);
        throw new Error(`서버 응답을 해석할 수 없습니다: ${responseText.substring(0, 100)}...`);
      }

      if (response.ok && result.success) {
        console.log('✅ 문의사항 제출 성공:', result);
        setCurrentStep('success');
        
        // 폼 초기화
        setFormData({
          phone: '',
          email: user?.email || '',
          subject: '',
          message: '',
          category: ''
        });
        setAttachedFiles([]);
        
        // 3초 후 자동으로 닫기
        setTimeout(() => {
          handleClose();
        }, 3000);
      } else {
        console.error('❌ 문의사항 제출 실패:', result);
        const errorMessage = result?.error || result?.message || `서버 오류 (${response.status})`;
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('💥 문의 전송 실패:', error);
      showError(error instanceof Error ? error.message : "문의 전송 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const inquiryCategories = [
    { id: 'technical', title: '기술적 문제', subtitle: '로그인, 이미지 생성, 오류 등', subject: '기술적 문제 관련 문의' },
    { id: 'billing', title: '결제/구독 문의', subtitle: '요금제, 결제, 환불 등', subject: '결제/구독 관련 문의' },
    { id: 'feature', title: '기능 문의', subtitle: '사용법, 새로운 기능 요청 등', subject: '기능 관련 문의' },
    { id: 'general', title: '기타 문의', subtitle: '일반적인 질문이나 피드백', subject: '기타 문의' }
  ];

  return (
    <>
      <ToastContainer />
      {/* 플로팅 버튼 */}
      <div className="fixed bottom-6 right-6 z-50">
        {/* 말풍선 */}
        {showBubble && !isOpen && (
          <div 
            className="absolute bottom-16 right-0 mb-2 mr-2 bg-white rounded-lg shadow-lg border px-4 py-3 min-w-[180px] w-max max-w-[250px] animate-in slide-in-from-bottom-5 duration-300"
            style={{ animation: 'bounce 2s infinite' }}
          >
            <div className="text-sm text-gray-800 whitespace-nowrap">
              👋 안녕하세요!<br />
              무엇을 도와드릴까요?
            </div>
            {/* 말풍선 꼬리 */}
            <div className="absolute bottom-0 right-6 transform translate-y-full">
              <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white"></div>
            </div>
          </div>
        )}

        {/* 문의하기 버튼 */}
        <Button
          onClick={handleOpen}
          className="h-14 w-14 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </Button>
      </div>

      {/* 오버레이 - 매우 투명하게 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-transparent z-40"
          onClick={handleClose}
        />
      )}

      {/* 채팅 위젯 */}
      {isOpen && (
        <div 
          className={`fixed bottom-6 right-6 w-96 bg-white rounded-2xl shadow-2xl border z-50 transform transition-all duration-300 ${
            isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
          style={{ maxHeight: 'calc(100vh - 100px)' }}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <MessageCircle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold">고객지원</h3>
                <p className="text-xs text-white/80">빠르게 도와드릴게요</p>
              </div>
            </div>
            <Button
              onClick={handleClose}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* 컨텐츠 영역 */}
          <div className="h-[500px] overflow-y-auto">
            
            {/* 메뉴 단계 */}
            {currentStep === 'menu' && (
              <div className="p-6">
                <div className="text-center mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">무엇을 도와드릴까요?</h4>
                  <p className="text-sm text-gray-600">문의 유형을 선택해주세요</p>
                </div>
                
                <div className="space-y-3">
                  {inquiryCategories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => handleCategorySelect(category.id, category.subject)}
                      className="w-full p-4 text-left border border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50 transition-all duration-200 group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="font-medium text-gray-900 group-hover:text-purple-600">
                            {category.title}
                          </h5>
                          <p className="text-sm text-gray-500 mt-1">{category.subtitle}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-purple-600" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 폼 단계 */}
            {currentStep === 'form' && (
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Button
                    onClick={() => setCurrentStep('menu')}
                    variant="ghost"
                    size="sm"
                    className="p-1 h-auto"
                  >
                    ←
                  </Button>
                  <h4 className="font-semibold text-gray-900">{formData.subject}</h4>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* 전화번호 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      전화번호 *
                    </label>
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="전화번호를 입력하세요"
                      required
                      className="w-full"
                    />
                  </div>

                  {/* 연락받으실 이메일 주소 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      연락받으실 이메일 주소 *
                    </label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="이메일을 입력하세요"
                      required
                      className="w-full"
                    />
                  </div>

                  {/* 문의 내용 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      문의 내용 *
                    </label>
                    <Textarea
                      value={formData.message}
                      onChange={(e) => handleInputChange('message', e.target.value)}
                      placeholder="문의 내용을 자세히 작성해 주세요"
                      required
                      className="w-full min-h-[100px] resize-none"
                    />
                  </div>

                  {/* 첨부파일 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      첨부파일 (선택사항)
                    </label>
                    
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                        <Upload className="h-4 w-4 mr-1" />
                        파일 선택
                        <input
                          type="file"
                          className="hidden"
                          multiple
                          onChange={handleFileUpload}
                          disabled={attachedFiles.length >= 4}
                        />
                      </label>
                      <span className="text-xs text-gray-500">
                        {attachedFiles.length}/4
                      </span>
                    </div>

                    {/* 첨부된 파일 목록 */}
                    {attachedFiles.length > 0 && (
                      <div className="mt-3 space-y-2 max-h-24 overflow-y-auto">
                        {attachedFiles.map((attachedFile) => (
                          <div key={attachedFile.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                            <div className="flex items-center space-x-2 min-w-0">
                              {attachedFile.preview ? (
                                <img 
                                  src={attachedFile.preview} 
                                  alt="미리보기" 
                                  className="h-6 w-6 object-cover rounded"
                                />
                              ) : (
                                <File className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-900 truncate">
                                  {attachedFile.file.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatFileSize(attachedFile.file.size)}
                                </p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              onClick={() => removeFile(attachedFile.id)}
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700 h-6 w-6 p-0 flex-shrink-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 제출 버튼 */}
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        전송 중...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        문의하기
                      </>
                    )}
                  </Button>
                </form>
              </div>
            )}

            {/* 성공 단계 */}
            {currentStep === 'success' && (
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  문의가 접수되었습니다!
                </h4>
                <p className="text-sm text-gray-600 mb-4">
                  빠른 시일 내에 이메일로 답변 드리겠습니다.
                </p>
                <p className="text-xs text-gray-500">
                  3초 후 자동으로 닫힙니다...
                </p>
              </div>
            )}

          </div>

          {/* 푸터 */}
          <div className="px-4 py-2 border-t bg-gray-50 rounded-b-2xl">
            <p className="text-xs text-gray-500 text-center">
              💜 GenToon 고객지원팀
            </p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-10px);
          }
          60% {
            transform: translateY(-5px);
          }
        }
      `}</style>
    </>
  );
}