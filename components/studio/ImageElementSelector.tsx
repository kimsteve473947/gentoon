"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Upload,
  X,
  Image as ImageIcon,
  AlertCircle,
  Plus,
  Check,
  Loader2,
  MoreHorizontal,
  User,
  Package
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createBrowserClient } from '@supabase/ssr';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AddElementModal } from "./AddElementModal";

// 저장된 요소 인터페이스
interface StoredElement {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  thumbnailUrl: string;
  category: string;
  createdAt: string;
}

// 선택된 요소 인터페이스 (간소화)
interface ElementImage {
  id: string;
  name: string;
  imageUrl: string;
  description: string;
}

interface ImageElementSelectorProps {
  selectedElements: ElementImage[];
  onElementsChange: (elements: ElementImage[]) => void;
  selectedCharacters: string[];
  className?: string;
}

export function ImageElementSelector({ 
  selectedElements, 
  onElementsChange,
  selectedCharacters, 
  className 
}: ImageElementSelectorProps) {
  const [storedElements, setStoredElements] = useState<StoredElement[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{
    currentCount: number;
    maxElements: number;
    planType: string;
    canUpload: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasSelectedCharacters = selectedCharacters.length > 0;

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 저장된 요소들 불러오기
  useEffect(() => {
    loadStoredElements();
  }, []);

  const loadStoredElements = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/elements');
      const result = await response.json();
      
      if (result.success) {
        setStoredElements(result.elements);
        setLimitInfo(result.limitInfo);
      }
    } catch (error) {
      console.error('요소 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 요소 선택/해제
  const toggleElement = (element: StoredElement) => {
    const maxElements = Math.max(0, 3 - selectedCharacters.length);
    
    const isSelected = selectedElements.some(e => e.id === element.id);
    
    if (isSelected) {
      // 선택 해제
      onElementsChange(selectedElements.filter(e => e.id !== element.id));
    } else {
      // 선택 (개수 제한 확인)
      if (selectedElements.length >= maxElements) {
        alert(`최대 ${maxElements}개의 요소만 선택 가능합니다 (Gemini 3개 이미지 제한)`);
        return;
      }
      
      const newElement: ElementImage = {
        id: element.id,
        name: element.name,
        imageUrl: element.imageUrl,
        description: element.description || ""
      };
      
      onElementsChange([...selectedElements, newElement]);
    }
  };

  // 새 요소 업로드
  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;

    // 업로드 제한 확인 (ADMIN은 무제한)
    if (limitInfo && limitInfo.planType !== 'ADMIN' && !limitInfo.canUpload) {
      alert(`요소 업로드 한도에 도달했습니다. (${limitInfo.currentCount}/${limitInfo.maxElements})\n더 많은 요소를 업로드하려면 플랜을 업그레이드하세요.`);
      return;
    }

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('이미지 크기는 10MB 이하여야 합니다');
      return;
    }

    // 자동 요소 이름 생성 (요소1, 요소2, ...)
    const nextElementNumber = storedElements.length + 1;
    const elementName = `요소${nextElementNumber}`;

    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('name', elementName);
      formData.append('description', '');
      formData.append('category', '');
      formData.append('image', file);

      const response = await fetch('/api/elements', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (result.success) {
        // 목록 새로고침
        await loadStoredElements();
        alert('요소가 성공적으로 업로드되었습니다!');
      } else {
        alert(`업로드 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('업로드 에러:', error);
      alert('업로드 중 오류가 발생했습니다');
    } finally {
      setUploading(false);
    }
  };

  // 요소 삭제
  const handleElementDelete = async (elementId: string) => {
    const element = storedElements.find(e => e.id === elementId);
    if (!element) return;
    
    const confirmDelete = confirm(`"${element.name}" 요소를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`);
    
    if (confirmDelete) {
      try {
        const response = await fetch(`/api/elements?id=${elementId}`, {
          method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
          // 목록에서 제거
          setStoredElements(prev => prev.filter(e => e.id !== elementId));
          // 선택된 요소에서도 제거
          onElementsChange(selectedElements.filter(e => e.id !== elementId));
        } else {
          alert(`삭제 실패: ${result.error}`);
        }
      } catch (error) {
        console.error('요소 삭제 에러:', error);
        alert('삭제 중 오류가 발생했습니다');
      }
    }
  };

  const maxElements = Math.max(0, 3 - selectedCharacters.length);

  // 로딩 상태 렌더링 (캐릭터와 동일)
  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-slate-700">요소 이미지</h4>
          <div className="h-4 w-16 bg-slate-200 animate-pulse rounded"></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-200 animate-pulse rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* 헤더 (캐릭터와 동일한 스타일) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className={cn(
            "text-sm font-medium",
            hasSelectedCharacters ? "text-slate-700" : "text-slate-400"
          )}>요소</h4>
          {limitInfo && (
            <Badge variant="outline" className={cn(
              "text-xs",
              limitInfo.canUpload || limitInfo.planType === 'ADMIN' ? "border-slate-300 text-slate-600" : "border-red-300 text-red-600 bg-red-50"
            )}>
              {limitInfo.currentCount}/{limitInfo.maxElements}
            </Badge>
          )}
        </div>
        <div className="text-xs text-slate-500">
          선택: {selectedElements.length}/{maxElements}
        </div>
      </div>

      {/* 캐릭터 선택 안내 UI 제거 */}

      {/* 요소 목록 */}
      <div className="space-y-2 h-48 overflow-y-auto">
        {storedElements.length === 0 && hasSelectedCharacters ? (
          <div className="text-center py-8 text-slate-400">
            <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">등록된 요소가 없습니다</p>
            <p className="text-xs text-slate-400 mt-1">요소를 추가해서 시작하세요</p>
          </div>
        ) : hasSelectedCharacters ? (
          <div className="grid grid-cols-1 gap-2">
            {storedElements.map((element) => {
              const isSelected = selectedElements.some(e => e.id === element.id);
              const canSelect = selectedElements.length < maxElements || isSelected;
              
              return (
                <div
                  key={element.id}
                  className={cn(
                    "flex items-center gap-3 p-3 border rounded-lg transition-all cursor-pointer relative group",
                    isSelected 
                      ? "border-purple-300 bg-purple-50" 
                      : canSelect 
                        ? "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        : "border-slate-200 opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => canSelect && toggleElement(element)}
                  onMouseEnter={() => setHoveredElement(element.id)}
                  onMouseLeave={() => setHoveredElement(null)}
                >
                  {/* 요소 아바타 (캐릭터와 동일한 스타일) */}
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={element.thumbnailUrl || element.imageUrl} alt={element.name} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-100 to-cyan-100 text-blue-700">
                      {element.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>

                  {/* 요소 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h5 className="text-sm font-medium text-slate-900 truncate">
                        {element.name}
                      </h5>
                      {isSelected && (
                        <Check className="h-4 w-4 text-purple-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {element.description || '설명 없음'}
                    </p>
                  </div>

                  {/* 삭제 버튼 (캐릭터와 동일한 스타일) */}
                  {hoveredElement === element.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-white shadow-sm hover:bg-red-50 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleElementDelete(element.id);
                      }}
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">캐릭터를 먼저 선택해주세요</p>
            <p className="text-xs text-slate-400 mt-1">캐릭터 선택 후 요소를 추가할 수 있습니다</p>
          </div>
        )}
      </div>

      {/* 새 요소 추가 버튼 (상세 폼 방식) */}
      <Button
        variant="outline"
        size="sm"
        disabled={uploading || !hasSelectedCharacters || (limitInfo && limitInfo.planType !== 'ADMIN' && !limitInfo.canUpload)}
        className={cn(
          "w-full border-dashed text-sm disabled:opacity-50",
          limitInfo && limitInfo.planType !== 'ADMIN' && !limitInfo.canUpload 
            ? "border-red-300 text-red-600 hover:border-red-300 hover:text-red-600" 
            : "border-slate-300 text-slate-600 hover:border-purple-300 hover:text-purple-600"
        )}
        onClick={() => setShowAddModal(true)}
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            업로드 중...
          </>
        ) : limitInfo && limitInfo.planType !== 'ADMIN' && !limitInfo.canUpload ? (
          <>
            <AlertCircle className="h-4 w-4 mr-2" />
            한도 초과 ({limitInfo.currentCount}/{limitInfo.maxElements})
          </>
        ) : (
          <>
            <Package className="h-4 w-4 mr-2" />
            새 요소 추가
          </>
        )}
      </Button>

      {/* 요소 추가 모달 */}
      <AddElementModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onElementAdded={() => {
          loadStoredElements();
        }}
      />

      {/* 숨겨진 파일 입력 (기존 간단 업로드용 - 사용 안함) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFileUpload(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}