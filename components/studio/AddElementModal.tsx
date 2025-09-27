"use client";

import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Upload,
  Loader2,
  X,
  ImageIcon,
  Package
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AddElementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onElementAdded?: () => void;
}

// 요소 타입 정의
const ELEMENT_TYPES = [
  { value: 'background', label: '배경', description: '풍경, 건물, 장소 등' },
  { value: 'object', label: '물건', description: '도구, 가구, 장비 등' },
  { value: 'prop', label: '소품', description: '액세서리, 장식품 등' },
  { value: 'effect', label: '효과', description: '폭발, 마법, 이펙트 등' },
  { value: 'nature', label: '자연물', description: '나무, 꽃, 동물 등' },
  { value: 'food', label: '음식', description: '음료, 요리, 간식 등' },
  { value: 'vehicle', label: '탈것', description: '자동차, 자전거, 배 등' },
  { value: 'other', label: '기타', description: '기타 요소들' }
];

export function AddElementModal({ 
  open, 
  onOpenChange, 
  onElementAdded
}: AddElementModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [elementType, setElementType] = useState('');
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 모달 초기화
  const resetModal = () => {
    setName('');
    setDescription('');
    setElementType('');
    setUploadedImage(null);
    setPreviewUrl(null);
    setIsCreating(false);
  };

  // 모달 닫기
  const handleClose = () => {
    if (!isCreating) {
      resetModal();
      onOpenChange(false);
    }
  };

  // 파일 업로드 처리
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지 파일만 허용
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    // 파일 크기 제한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB를 초과할 수 없습니다.');
      return;
    }

    try {
      setUploadedImage(file);
      
      // 미리보기 생성
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setPreviewUrl(dataUrl);
        console.log(`✅ 이미지 미리보기 생성 완료: ${file.name}`);
      };
      reader.onerror = () => {
        console.error('❌ 파일 읽기 실패');
        alert('이미지 파일을 읽을 수 없습니다.');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('이미지 처리 실패:', error);
      alert('이미지 처리 중 오류가 발생했습니다. 다른 이미지를 선택해주세요.');
    }
  };

  // 요소 생성/저장
  const handleCreateElement = async () => {
    if (!name.trim()) {
      alert('요소 이름을 입력해주세요.');
      return;
    }

    if (!description.trim()) {
      alert('요소 설명을 입력해주세요.');
      return;
    }

    if (!elementType) {
      alert('요소 타입을 선택해주세요.');
      return;
    }

    if (!uploadedImage) {
      alert('이미지를 업로드해주세요.');
      return;
    }

    try {
      setIsCreating(true);
      
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('description', description.trim());
      formData.append('category', elementType);
      formData.append('image', uploadedImage);

      const response = await fetch('/api/elements', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '요소 생성에 실패했습니다');
      }

      const result = await response.json();

      // 성공 처리
      onElementAdded?.();
      handleClose();
      
    } catch (error) {
      console.error('요소 생성 실패:', error);
      alert(error instanceof Error ? error.message : '요소 생성 중 오류가 발생했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            새 요소 추가
          </DialogTitle>
          <DialogDescription>
            요소를 생성하여 웹툰 제작에서 활용하세요
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 요소 기본 정보 */}
          <div className="space-y-4">
            <Label className="text-base font-medium">요소 정보</Label>
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="name">요소 이름 *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 마법 지팡이, 카페 배경"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="elementType">요소 타입 *</Label>
                <Select value={elementType} onValueChange={setElementType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="요소 타입을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {ELEMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{type.label}</span>
                          <span className="text-xs text-slate-500">{type.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description">요소 설명 *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="요소의 특징, 용도, 스타일을 자세히 설명해주세요"
                  className="mt-1 min-h-[80px]"
                />
              </div>
            </div>
          </div>

          {/* 이미지 업로드 */}
          <div className="space-y-4">
            <Label className="text-base font-medium">레퍼런스 이미지</Label>
            
            <div className="space-y-3">
              {!uploadedImage ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-slate-300 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-all cursor-pointer"
                >
                  <ImageIcon className="h-12 w-12 text-slate-400" />
                  <div className="text-center">
                    <p className="font-medium text-slate-700">이미지 선택</p>
                    <p className="text-sm text-slate-500 mt-1">
                      PNG, JPG 파일 (최대 10MB)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={previewUrl!}
                    alt="미리보기"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setUploadedImage(null);
                      setPreviewUrl(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* 설명 카드 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">💡 좋은 요소를 만드는 팁</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>명확한 이름:</strong> AI가 쉽게 인식할 수 있는 구체적인 이름 사용</li>
              <li>• <strong>상세한 설명:</strong> 색상, 크기, 재질, 스타일 등을 구체적으로 기술</li>
              <li>• <strong>적절한 타입:</strong> 요소의 성격에 맞는 카테고리 선택</li>
              <li>• <strong>고화질 이미지:</strong> 선명하고 배경이 단순한 이미지 권장</li>
            </ul>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isCreating}
              className="flex-1"
            >
              취소
            </Button>
            
            <Button
              onClick={handleCreateElement}
              disabled={isCreating || !name.trim() || !description.trim() || !elementType || !uploadedImage}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  요소 생성
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}