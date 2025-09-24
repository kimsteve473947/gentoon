'use client';

import React, { useState, useCallback, memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Eye, MoreVertical, Users, Edit, CheckCircle2 } from 'lucide-react';
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
    createdAt?: string;
  };
  onDelete: (characterId: string) => void;
  onEdit?: (characterId: string) => void;
}

// 🚀 성공 메시지 컴포넌트 (메모이제이션)
const SuccessToast = memo(({ message, onClose }: { message: string; onClose: () => void }) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2">
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 shadow-lg">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <span className="text-green-800 text-sm font-medium">{message}</span>
      </div>
    </div>
  );
});

SuccessToast.displayName = 'SuccessToast';

export const CharacterCardWithDelete = memo(({ character, onDelete, onEdit }: CharacterCardWithDeleteProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // 🚀 최적화된 삭제 핸들러
  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 간단한 확인 
    if (!confirm(`"${character.name}" 캐릭터를 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }
    
    try {
      setIsProcessing(true);
      
      const response = await fetch(`/api/characters?id=${character.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('캐릭터 삭제에 실패했습니다');
      }

      // 🚀 즉시 UI에서 제거 (부모 컴포넌트 상태 업데이트)
      onDelete(character.id);
      
      // 성공 메시지 표시
      setShowSuccess(true);
      
    } catch (error) {
      console.error('캐릭터 삭제 실패:', error);
      alert('캐릭터 삭제에 실패했습니다');
    } finally {
      setIsProcessing(false);
    }
  }, [character.id, character.name, onDelete]);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onEdit) {
      onEdit(character.id);
    }
  }, [character.id, onEdit]);

  const handleSuccessClose = useCallback(() => {
    setShowSuccess(false);
  }, []);

  return (
    <>
      <Card 
        className={`group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.02] cursor-pointer ${
          isProcessing ? 'opacity-50 pointer-events-none' : ''
        }`}
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

            {/* 처리 중 오버레이 */}
            {isProcessing && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <div className="bg-white rounded-lg p-2 shadow-lg">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-600 border-t-transparent"></div>
                </div>
              </div>
            )}

            {/* 🚀 간소화된 액션 버튼 - 호버 시에만 표시 */}
            <div className="absolute top-2 right-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="h-8 w-8 p-0 bg-white/90 hover:bg-white shadow-sm"
                    disabled={isProcessing}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[9999]">
                  {onEdit && (
                    <DropdownMenuItem 
                      onClick={handleEdit}
                      disabled={isProcessing}
                      className="cursor-pointer"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      편집
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // TODO: 상세보기 기능 구현
                    }}
                    disabled={isProcessing}
                    className="cursor-pointer"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    상세보기
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleDelete}
                    disabled={isProcessing}
                    className="text-red-600 focus:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isProcessing ? '삭제 중...' : '영구 삭제'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
      </Card>

      {/* 성공 메시지 */}
      {showSuccess && (
        <SuccessToast 
          message="캐릭터가 삭제되었습니다" 
          onClose={handleSuccessClose} 
        />
      )}
    </>
  );
});

CharacterCardWithDelete.displayName = 'CharacterCardWithDelete';