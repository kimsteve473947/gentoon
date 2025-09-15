'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Eye, MoreVertical, Users, Edit } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Image from 'next/image';

interface CharacterCardWithDeleteProps {
  character: {
    id: string;
    name: string;
    thumbnailUrl?: string;
    description?: string;
    status?: 'active' | 'inactive';
    usageCount?: number;
  };
  onDelete: (characterId: string) => void;
  onEdit?: (characterId: string) => void;
}

export function CharacterCardWithDelete({ character, onDelete, onEdit }: CharacterCardWithDeleteProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      setIsDeleting(true);
      
      // 🗑️ 캐릭터 영구 삭제
      const response = await fetch(`/api/characters?id=${character.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('캐릭터 삭제에 실패했습니다');
      }

      await onDelete(character.id);
      
      setShowDeleteConfirm(false);
      // 성공 토스트 (더 세련된 알림)
      // TODO: 나중에 toast 라이브러리로 교체
    } catch (error) {
      console.error('캐릭터 삭제 실패:', error);
      alert('캐릭터 삭제에 실패했습니다');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onEdit) {
      onEdit(character.id);
    }
  };

  return (
    <Card 
      className="group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.02] cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-0">
        {/* 캐릭터 이미지 영역 */}
        <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
          {character.thumbnailUrl ? (
            <Image
              src={character.thumbnailUrl}
              alt={character.name}
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
              priority={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Users className="h-12 w-12 text-gray-300" />
            </div>
          )}
          
          {/* 상태 배지 */}
          {character.status && (
            <Badge 
              className={`absolute top-2 left-2 ${
                character.status === 'active' 
                  ? 'bg-green-500' 
                  : 'bg-gray-500'
              }`}
            >
              {character.status === 'active' ? '활성' : '비활성'}
            </Badge>
          )}

          {/* 🎯 호버시 더보기 메뉴 (우상단) - 프로젝트와 동일한 스타일 */}
          {isHovered && (
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
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="z-[9999]"
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  {onEdit && (
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleEditClick(e);
                      }}
                      className="cursor-pointer"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      편집
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // View details 기능
                    }}
                    className="cursor-pointer"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    상세보기
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-red-600 focus:text-red-600 cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteClick(e);
                    }}
                    onSelect={(e) => e.preventDefault()}
                    disabled={isDeleting}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isDeleting ? '삭제중...' : '영구 삭제'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        
        {/* 캐릭터 정보 */}
        <div className="p-3">
          <h3 className="font-medium text-gray-900 truncate group-hover:text-purple-600 transition-colors">
            {character.name}
          </h3>
          
          {character.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
              {character.description}
            </p>
          )}
          
          {character.usageCount !== undefined && (
            <div className="flex items-center justify-end text-xs text-gray-500 mt-2">
              <span>{character.usageCount}회 사용</span>
            </div>
          )}
        </div>
      </CardContent>

      {/* 🚀 간단하고 현대적인 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 overflow-hidden">
            {/* 헤더 */}
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                캐릭터 영구 삭제
              </h3>
              <p className="text-gray-600 text-sm">
                <span className="font-medium text-gray-900">"{character.name}"</span>을(를) 영구적으로 삭제하시겠습니까?
              </p>
            </div>
            
            {/* 경고 메시지 */}
            <div className="px-6 pb-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm font-medium text-center">
                  ⚠️ 이 작업은 되돌릴 수 없습니다
                </p>
              </div>
            </div>
            
            {/* 액션 버튼 */}
            <div className="bg-gray-50 px-6 py-4 flex gap-3">
              <Button
                variant="outline"
                onClick={handleCancelDelete}
                disabled={isDeleting}
                className="flex-1"
              >
                취소
              </Button>
              <Button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    삭제 중...
                  </div>
                ) : (
                  '삭제'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}