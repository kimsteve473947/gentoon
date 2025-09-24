'use client';

import { useState } from 'react';
import { X, Upload, File, Trash2, AlertCircle, MessageCircle, HelpCircle, ChevronRight } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { Textarea } from './textarea';
import { Label } from './label';
import { useToast } from '@/hooks/use-toast';

interface InquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AttachedFile {
  file: File;
  preview?: string;
  id: string;
}

export function InquiryModal({ isOpen, onClose }: InquiryModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // 최대 4개 파일 제한
    const availableSlots = 4 - attachedFiles.length;
    if (files.length > availableSlots) {
      toast({
        title: "파일 업로드 제한",
        description: `최대 4개 파일까지 업로드 가능합니다. (현재 ${availableSlots}개 추가 가능)`,
        variant: "destructive"
      });
      return;
    }

    const newFiles: AttachedFile[] = [];
    
    for (const file of files) {
      // 파일 크기 제한 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "파일 크기 초과",
          description: `${file.name}: 파일 크기는 10MB 이하여야 합니다.`,
          variant: "destructive"
        });
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
    
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      toast({
        title: "필수 정보 누락",
        description: "이름, 이메일, 제목, 문의내용을 모두 입력해주세요.",
        variant: "destructive"
      });
      return;
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        title: "이메일 형식 오류",
        description: "올바른 이메일 주소를 입력해주세요.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // FormData로 파일과 텍스트 데이터를 함께 전송
      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('email', formData.email);
      submitData.append('subject', formData.subject);
      submitData.append('message', formData.message);

      // 첨부파일 추가
      attachedFiles.forEach((attachedFile, index) => {
        submitData.append(`file-${index}`, attachedFile.file);
      });

      const response = await fetch('/api/inquiries/public', {
        method: 'POST',
        body: submitData
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "문의가 접수되었습니다",
          description: "빠른 시일 내에 답변 드리겠습니다.",
          variant: "default"
        });

        // 폼 초기화
        setFormData({
          name: '',
          email: '',
          subject: '',
          message: ''
        });
        setAttachedFiles([]);
        onClose();
      } else {
        throw new Error(result.error || '문의 접수에 실패했습니다');
      }
    } catch (error) {
      console.error('문의 전송 실패:', error);
      toast({
        title: "문의 전송 실패",
        description: error instanceof Error ? error.message : "문의 전송 중 오류가 발생했습니다.",
        variant: "destructive"
      });
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

  if (!isOpen) return null;

  return (
    <>
      {/* 사이드바 */}
      <div className={`fixed top-20 right-4 w-80 h-[500px] bg-white shadow-2xl rounded-lg border transform transition-transform duration-300 ease-in-out z-50 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-lg">
          <h2 className="text-lg font-semibold text-gray-900">문의하기</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 문의하기 폼 */}
        <div className="h-[450px] overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* 이름 */}
            <div>
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                이름 *
              </Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="mt-1"
                placeholder="이름을 입력하세요"
                required
              />
            </div>

            {/* 이메일 주소 */}
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                이메일 주소 *
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="mt-1"
                placeholder="이메일을 입력하세요"
                required
              />
            </div>

            {/* 제목 */}
            <div>
              <Label htmlFor="subject" className="text-sm font-medium text-gray-700">
                제목
              </Label>
              <Input
                id="subject"
                type="text"
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                className="mt-1"
                placeholder="문의 제목을 입력하세요"
              />
            </div>

            {/* 문의 내용 */}
            <div>
              <Label htmlFor="message" className="text-sm font-medium text-gray-700">
                문의 내용 *
              </Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => handleInputChange('message', e.target.value)}
                className="mt-1 min-h-[80px]"
                placeholder="문의 내용을 자세히 작성해 주세요"
                required
              />
            </div>

            {/* 첨부파일 */}
            <div>
              <Label className="text-sm font-medium text-gray-700">
                첨부파일 (최대 4개, 각 10MB 이하)
              </Label>
              
              {/* 파일 업로드 버튼 */}
              <div className="mt-2 flex items-center gap-3">
                <label className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                  <Upload className="h-3 w-3 mr-1" />
                  파일 선택
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    onChange={handleFileUpload}
                    disabled={attachedFiles.length >= 4}
                    accept="image/*,.pdf,.doc,.docx,.txt,.hwp"
                  />
                </label>
                <span className="text-xs text-gray-500">
                  {attachedFiles.length}/4
                </span>
              </div>

              {/* 첨부된 파일 목록 */}
              {attachedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {attachedFiles.map((attachedFile) => (
                    <div key={attachedFile.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center space-x-2">
                        {attachedFile.preview ? (
                          <img 
                            src={attachedFile.preview} 
                            alt="미리보기" 
                            className="h-8 w-8 object-cover rounded"
                          />
                        ) : (
                          <div className="h-8 w-8 bg-gray-200 rounded flex items-center justify-center">
                            <File className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-medium text-gray-900 truncate max-w-[150px]">
                            {attachedFile.file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(attachedFile.file.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(attachedFile.id)}
                        className="text-red-500 hover:text-red-700 transition-colors p-1"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 제출 버튼 */}
            <div className="pt-4 border-t">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-black text-white hover:bg-gray-800"
              >
                {isSubmitting ? '전송 중...' : '문의하기'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}