'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Eye, MoreVertical, Clock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
}

export function ProjectCardWithDelete({ project, onDelete }: ProjectCardWithDeleteProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirm(true);
  };

  const handleConfirmDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      setIsDeleting(true);
      
      const response = await fetch(`/api/projects/${project.id}/trash`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        throw new Error('프로젝트를 휴지통으로 이동하는데 실패했습니다');
      }

      if (onDelete) {
        onDelete(project.id);
      }
      
      setShowConfirm(false);
      alert('프로젝트가 휴지통으로 이동되었습니다.');
    } catch (error) {
      console.error('휴지통 이동 실패:', error);
      alert('프로젝트를 휴지통으로 이동하는데 실패했습니다');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirm(false);
  };

  // 날짜 포맷팅 - 분 단위까지 표시
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
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
  };

  return (
    <Card 
      className="group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.02] h-64 flex flex-col"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={`/studio?projectId=${project.id}`} className="flex-1 flex flex-col">
        {/* 썸네일 영역 - 고정 높이 */}
        <div className="relative h-40 bg-gray-100 flex-shrink-0">
          {project.thumbnail ? (
            <Image
              src={project.thumbnail}
              alt={project.title}
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-dashed border-purple-200">
              <div className="text-center text-purple-400">
                <Eye className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">썸네일 없음</p>
              </div>
            </div>
          )}
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
              {formatDate(project.lastEdited)}
            </div>
          </div>
        </CardContent>
      </Link>

      {/* 호버 시 액션 버튼 */}
      {(isHovered || showConfirm) && (
        <div 
          className="absolute top-2 right-2 z-30" 
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 w-8 p-0 bg-white/90 hover:bg-white shadow-sm"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="z-[9999]"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <DropdownMenuItem 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDeleteClick(e);
                }} 
                className="text-red-600 focus:text-red-600 cursor-pointer"
                onSelect={(e) => e.preventDefault()}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                휴지통으로 이동
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* 🎨 Canva 스타일 삭제 확인 모달 */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-in fade-in-0 duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-red-50 to-orange-50 p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                휴지통으로 이동
              </h3>
              <p className="text-gray-600 text-sm">
                이 작업은 30일 후 자동으로 삭제됩니다
              </p>
            </div>
            
            {/* 콘텐츠 */}
            <div className="p-6">
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center">
                    <Eye className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-sm">
                      {project.title}
                    </h4>
                    <p className="text-gray-500 text-xs mt-1">
                      최근 편집: {formatDate(project.lastEdited)}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg mb-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-800">
                      휴지통에서 30일 내에 복구할 수 있습니다
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 액션 버튼 */}
            <div className="bg-gray-50 px-6 py-4 flex gap-3">
              <Button
                variant="outline"
                onClick={handleCancelDelete}
                disabled={isDeleting}
                className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium transition-all transform active:scale-95"
              >
                {isDeleting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    이동 중...
                  </div>
                ) : (
                  '휴지통으로 이동'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}