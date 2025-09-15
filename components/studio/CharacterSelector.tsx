"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  User, 
  Plus, 
  Check, 
  X, 
  Crown,
  Star,
  Lock,
  AlertCircle,
  MoreHorizontal,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createBrowserClient } from '@supabase/ssr';

interface Character {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  referenceImages: string[];
  isActive?: boolean;
  isDefault?: boolean; // 시스템 기본 캐릭터 여부
  ownerId?: string; // 캐릭터 소유자 ID
}

interface Subscription {
  plan: 'FREE' | 'PRO' | 'PREMIUM';
  maxCharacters: number;
}

interface CharacterSelectorProps {
  selectedCharacters: string[];
  onCharacterToggle: (characterId: string) => void;
  onAddCharacter?: () => void;
  onCharacterDelete?: (characterId: string) => void;
  className?: string;
  refreshKey?: number; // 새로고침을 위한 키
}

export function CharacterSelector({ 
  selectedCharacters, 
  onCharacterToggle, 
  onAddCharacter,
  onCharacterDelete,
  className,
  refreshKey 
}: CharacterSelectorProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredCharacter, setHoveredCharacter] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadCharactersAndSubscription();
  }, [refreshKey]);

  const loadCharactersAndSubscription = async () => {
    try {
      setLoading(true);
      
      // 사용자 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }

      // 사용자 데이터 조회
      const { data: userData } = await supabase
        .from('user')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!userData) {
        throw new Error('사용자 정보를 찾을 수 없습니다');
      }

      // 구독 정보 조회
      const { data: subscriptionData } = await supabase
        .from('subscription')
        .select('plan, maxCharacters')
        .eq('userId', userData.id)
        .single();

      if (subscriptionData) {
        setSubscription(subscriptionData);
      } else {
        // 기본 무료 플랜
        setSubscription({
          plan: 'FREE',
          maxCharacters: 2
        });
      }

      // 사용자 캐릭터와 시스템 공용 캐릭터 조회
      const { data: charactersData, error: charactersError } = await supabase
        .from('character')
        .select('*')
        .or(`userId.eq.${userData.id},and(userId.eq.system,isPublic.eq.true)`)
        .order('createdAt', { ascending: false });

      if (charactersError) throw charactersError;

      const formattedCharacters = charactersData?.map((char: any) => ({
        id: char.id,
        name: char.name,
        description: char.description,
        imageUrl: char.thumbnailUrl,
        referenceImages: char.referenceImages || [],
        isActive: selectedCharacters.includes(char.id),
        isDefault: char.userId === 'system',
        ownerId: char.userId
      })) || [];

      // 기본 캐릭터를 맨 앞에 배치
      const sortedCharacters = formattedCharacters.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return 0;
      });

      setCharacters(sortedCharacters);
    } catch (error) {
      console.error('캐릭터 로딩 실패:', error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const getMaxCharacters = () => {
    if (!subscription) return 2;
    
    switch (subscription.plan) {
      case 'FREE':
        return 2;
      case 'PRO':
        return 3;
      case 'PREMIUM':
        return 5;
      default:
        return 2;
    }
  };

  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case 'PRO':
        return <User className="h-3 w-3" />;
      case 'PREMIUM':
        return <Crown className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'PRO':
        return 'bg-blue-100 text-blue-700';
      case 'PREMIUM':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const canSelectMore = () => {
    const maxCharacters = getMaxCharacters();
    return selectedCharacters.length < maxCharacters;
  };

  const handleCharacterToggle = (characterId: string) => {
    const isSelected = selectedCharacters.includes(characterId);
    
    if (!isSelected && !canSelectMore()) {
      // 더 이상 선택할 수 없음을 사용자에게 알림
      return;
    }
    
    onCharacterToggle(characterId);
  };

  const handleCharacterDelete = async (characterId: string) => {
    if (!onCharacterDelete) return;
    
    const character = characters.find(c => c.id === characterId);
    if (!character) return;
    
    const confirmDelete = confirm(`"${character.name}" 캐릭터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`);
    
    if (confirmDelete) {
      try {
        await onCharacterDelete(characterId);
        // 성공 시 로컬 상태 업데이트
        setCharacters(prev => prev.filter(c => c.id !== characterId));
      } catch (error) {
        console.error('캐릭터 삭제 실패:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-slate-700">캐릭터 설정</h4>
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

  if (error) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  const maxCharacters = getMaxCharacters();

  return (
    <div className={cn("space-y-3", className)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-slate-700">캐릭터 설정</h4>
          {subscription && (
            <Badge 
              variant="secondary" 
              className={cn("text-xs px-2 py-0.5 gap-1", getPlanColor(subscription.plan))}
            >
              {getPlanIcon(subscription.plan)}
              {subscription.plan}
            </Badge>
          )}
        </div>
        <div className="text-xs text-slate-500">
          {selectedCharacters.length}/{maxCharacters === Infinity ? '∞' : maxCharacters}
        </div>
      </div>

      {/* 선택 제한 안내 */}
      {!canSelectMore() && maxCharacters !== Infinity && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
          <Lock className="h-4 w-4 text-amber-500" />
          <p className="text-xs text-amber-700">
            {subscription?.plan === 'FREE' ? '무료 플랜은 캐릭터 2개까지 선택 가능합니다' : 
             `${subscription?.plan} 플랜은 캐릭터 ${maxCharacters}개까지 선택 가능합니다`}
          </p>
        </div>
      )}

      {/* 캐릭터 목록 */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {characters.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">등록된 캐릭터가 없습니다</p>
            <p className="text-xs text-slate-400 mt-1">기본 캐릭터가 로딩 중이거나 캐릭터를 추가해서 시작하세요</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {characters.map((character) => {
              const isSelected = selectedCharacters.includes(character.id);
              const canSelect = canSelectMore() || isSelected;
              
              return (
                <div
                  key={character.id}
                  className={cn(
                    "flex items-center gap-3 p-3 border rounded-lg transition-all cursor-pointer relative group",
                    isSelected 
                      ? "border-purple-300 bg-purple-50" 
                      : canSelect 
                        ? "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        : "border-slate-200 opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => canSelect && handleCharacterToggle(character.id)}
                  onMouseEnter={() => setHoveredCharacter(character.id)}
                  onMouseLeave={() => setHoveredCharacter(null)}
                >
                  {/* 캐릭터 아바타 */}
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={character.imageUrl} alt={character.name} />
                    <AvatarFallback className="bg-gradient-to-br from-purple-100 to-pink-100 text-purple-700">
                      {character.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>

                  {/* 캐릭터 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h5 className="text-sm font-medium text-slate-900 truncate">
                        {character.name}
                      </h5>
                      {character.isDefault && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700">
                          <Star className="h-3 w-3 mr-1" />
                          기본
                        </Badge>
                      )}
                      {isSelected && (
                        <Check className="h-4 w-4 text-purple-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {character.description || '설명 없음'}
                    </p>
                  </div>

                  {/* 삭제 버튼 - 시스템 캐릭터는 삭제 불가 */}
                  {hoveredCharacter === character.id && onCharacterDelete && !character.isDefault && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-white shadow-sm hover:bg-red-50 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCharacterDelete(character.id);
                      }}
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  )}

                  {/* 선택 불가 아이콘 */}
                  {!canSelect && !isSelected && (
                    <Lock className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 캐릭터 추가 버튼 */}
      {onAddCharacter && (
        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed border-slate-300 text-slate-600 hover:border-purple-300 hover:text-purple-600"
          onClick={onAddCharacter}
        >
          <Plus className="h-4 w-4 mr-2" />
          새 캐릭터 추가
        </Button>
      )}
    </div>
  );
}