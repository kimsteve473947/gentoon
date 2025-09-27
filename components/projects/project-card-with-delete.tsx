'use client';

import React, { useState, useCallback, useMemo, memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Eye, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { CardActionDropdown, createActionItems } from '@/components/ui/action-dropdown';
import Link from 'next/link';
import Image from 'next/image';

interface ProjectCardWithDeleteProps {
  project: {
    id: string;
    title: string;
    thumbnail?: string;
    lastEdited: string;
  };
  onDelete?: (projectId: string) => void;
  // 🚀 일괄 삭제 관련 props
  isSelectMode?: boolean;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
}

// 🚀 최적화된 프로젝트 카드 컴포넌트
export const ProjectCardWithDelete = memo(({ 
  project, 
  onDelete, 
  isSelectMode = false,
  isSelected = false,
  onSelect 
}: ProjectCardWithDeleteProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { showSuccess } = useToast();

  // 🚀 날짜 포맷팅 메모이제이션
  const formattedDate = useMemo(() => {
    try {
      const date = new Date(project.lastEdited);
      const now = new Date();
      const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
      const diffInHours = diffInMinutes / 60;
      
      if (diffInMinutes < 1) {
        return '방금';
      } else if (diffInMinutes < 60) {
        return `${Math.floor(diffInMinutes)}분 전`;
      } else if (diffInHours < 24) {
        return `${Math.floor(diffInHours)}시간 전`;
      } else if (diffInHours < 48) {
        return '어제';
      } else {
        return date.toLocaleDateString('ko-KR', {
          month: 'numeric',
          day: 'numeric'
        });
      }
    } catch (error) {
      return '최근';
    }
  }, [project.lastEdited]);

  // 🚀 최적화된 삭제 핸들러
  const handleDelete = useCallback(async () => {
    // 간단한 확인 (브라우저 블로킹 없음)
    if (!confirm('이 프로젝트를 휴지통으로 이동하시겠습니까?')) {
      return;
    }
    
    try {
      setIsProcessing(true);
      
      const response = await fetch(`/api/projects/${project.id}/trash`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        throw new Error('프로젝트를 휴지통으로 이동하는데 실패했습니다');
      }

      // 🚀 즉시 UI에서 제거 (부모 컴포넌트 상태 업데이트)
      if (onDelete) {
        onDelete(project.id);
      }
      
      // 성공 메시지 표시
      showSuccess('프로젝트가 휴지통으로 이동되었습니다');
      
    } catch (error) {
      console.error('휴지통 이동 실패:', error);
      alert('프로젝트를 휴지통으로 이동하는데 실패했습니다');
    } finally {
      setIsProcessing(false);
    }
  }, [project.id, onDelete, showSuccess]);

  // 액션 아이템 생성
  const actionItems = useMemo(() => [
    createActionItems.moveToTrash(handleDelete),
  ], [handleDelete]);

  // 🚀 체크박스 선택 핸들러
  const handleSelectChange = useCallback((checked: boolean) => {
    if (onSelect) {
      onSelect(checked);
    }
  }, [onSelect]);

  // 🚀 링크 클릭 핸들러 최적화 - 선택 모드일 때는 링크 비활성화
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (isProcessing) {
      e.preventDefault();
      e.stopPropagation();
    }
    // 선택 모드일 때는 카드 클릭 시 체크박스 토글
    if (isSelectMode) {
      e.preventDefault();
      e.stopPropagation();
      handleSelectChange(!isSelected);
    }
  }, [isProcessing, isSelectMode, isSelected, handleSelectChange]);

  return (
    <>
      <Card 
        className={`group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.02] h-64 flex flex-col ${
          isProcessing ? 'opacity-50 pointer-events-none' : ''
        } ${isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}
      >
        <Link 
          href={isSelectMode ? '#' : `/studio?projectId=${project.id}`} 
          className="flex-1 flex flex-col"
          onClick={handleCardClick}
        >
          {/* 썸네일 영역 - 고정 높이 */}
          <div className="relative h-40 bg-gray-100 flex-shrink-0">
            {project.thumbnail ? (
              <Image
                src={project.thumbnail}
                alt={project.title}
                fill
                className="object-cover transition-transform duration-200 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                priority={false}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-dashed border-purple-200">
                <div className="text-center text-purple-400">
                  <Eye className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">썸네일 없음</p>
                </div>
              </div>
            )}
            
            {/* 선택 모드일 때 체크박스 오버레이 */}
            {isSelectMode && (
              <div className="absolute top-2 left-2 z-10">
                <div className="bg-white/90 backdrop-blur-sm rounded-md p-1">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={handleSelectChange}
                    className="w-5 h-5"
                  />
                </div>
              </div>
            )}
            
            {/* 처리 중 오버레이 */}
            <LoadingOverlay 
              isVisible={isProcessing}
              message="처리 중..."
              variant="card"
            />
          </div>

          {/* 콘텐츠 영역 - 남은 공간 채우기 */}
          <CardContent className="flex-1 flex flex-col justify-between p-4">
            <div>
              <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-2">
                {project.title}
              </h3>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center text-xs text-gray-500">
                <Clock className="h-3 w-3 mr-1" />
                {formattedDate}
              </div>
            </div>
          </CardContent>
        </Link>

        {/* 🚀 간소화된 액션 버튼 - 호버 시에만 표시 (선택 모드가 아닐 때만) */}
        {!isSelectMode && (
          <CardActionDropdown 
            actions={actionItems}
            disabled={isProcessing}
          />
        )}
      </Card>
    </>
  );
});

ProjectCardWithDelete.displayName = 'ProjectCardWithDelete';