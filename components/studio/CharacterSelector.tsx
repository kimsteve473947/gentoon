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
  Trash2,
  Loader2,
  Sparkles
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
  isGeneratingCharacter?: boolean; // AI 캐릭터 생성 중인지 여부
  // 🎭 AI 대본 기반 자동 선택 관련
  currentPanelIndex?: number;
  panelCharacterMap?: Map<number, string[]>;
  isAutoSelected?: boolean;
  generatingCharacterInfo?: { // 생성 중인 캐릭터 정보
    name: string;
    description: string;
  };
  // 🖼️ 요소 이미지와 함께 총 3개 제한
  selectedElementsCount?: number; // 선택된 요소 이미지 개수
}

export function CharacterSelector({ 
  selectedCharacters, 
  onCharacterToggle, 
  onAddCharacter,
  onCharacterDelete,
  className,
  refreshKey,
  currentPanelIndex,
  panelCharacterMap,
  isAutoSelected,
  isGeneratingCharacter,
  generatingCharacterInfo,
  selectedElementsCount = 0
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
        // 기본 무료 플랜 (선택 가능한 캐릭터 수)
        setSubscription({
          plan: 'FREE',
          maxCharacters: 5
        });
      }

      // 사용자 캐릭터 조회
      const { data: charactersData, error: charactersError } = await supabase
        .from('character')
        .select('*')
        .eq('userId', userData.id)
        .order('createdAt', { ascending: false });

      if (charactersError) throw charactersError;

      const formattedCharacters = charactersData?.map((char: any) => ({
        id: char.id,
        name: char.name,
        description: char.description,
        imageUrl: char.thumbnailUrl,
        referenceImages: char.referenceImages || [],
        isActive: selectedCharacters.includes(char.id),
        ownerId: char.userId
      })) || [];

      setCharacters(formattedCharacters);
    } catch (error) {
      console.error('캐릭터 로딩 실패:', error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 캐릭터 + 요소 이미지 총합 3개 제한
  const getMaxCharacters = () => {
    // 🖼️ 요소 이미지를 고려한 캐릭터 선택 가능 개수
    return Math.max(0, 3 - selectedElementsCount);
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
      const totalSelected = selectedCharacters.length + selectedElementsCount;
      alert(`⚠️ 캐릭터와 요소 이미지를 합쳐서 최대 3개까지만 선택할 수 있습니다.\n\n현재: 캐릭터 ${selectedCharacters.length}개 + 요소 ${selectedElementsCount}개 = 총 ${totalSelected}개\n\nVertex AI 토큰 제한으로 인한 조치입니다.`);
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
          <h4 className="text-sm font-medium text-slate-700">캐릭터</h4>
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
          <h4 className="text-sm font-medium text-slate-700">캐릭터</h4>
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

      {/* AI 자동 선택 상태 표시 */}
      {isAutoSelected && currentPanelIndex !== undefined && (
        <div className="flex items-center gap-2 p-2 bg-purple-50 border border-purple-200 rounded-lg">
          <Sparkles className="h-4 w-4 text-purple-600" />
          <span className="text-xs text-purple-700">
            Panel {currentPanelIndex + 1}: AI 대본 기반 자동 선택됨
          </span>
        </div>
      )}


      {/* 캐릭터 목록 */}
      <div className="space-y-2 h-48 overflow-y-auto">
        {/* AI 캐릭터 생성 중일 때 맨 위에 로딩 캐릭터 표시 */}
        {isGeneratingCharacter && (
          <div className="flex items-center gap-3 p-3 border border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
            {/* 캐릭터 아바타 스타일 로딩 */}
            <div className="h-10 w-10 flex-shrink-0">
              <div className="w-full h-full bg-gradient-to-br from-purple-200 to-pink-200 rounded-full flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-purple-600 animate-spin" />
              </div>
            </div>

            {/* 캐릭터 정보 스타일 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h5 className="text-sm font-medium text-purple-700 truncate">
                  {generatingCharacterInfo?.name || "새 캐릭터"} 생성 중...
                </h5>
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-purple-400 rounded-full animate-bounce"></div>
                  <div className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
              <p className="text-xs text-purple-600 truncate mt-0.5">
                {generatingCharacterInfo?.description || "레퍼런스 이미지 생성 및 캐릭터 등록 중..."}
              </p>
            </div>
          </div>
        )}
        
        {characters.length === 0 && !isGeneratingCharacter ? (
          <div className="text-center py-8 text-slate-400">
            <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">등록된 캐릭터가 없습니다</p>
            <p className="text-xs text-slate-400 mt-1">캐릭터를 추가해서 시작하세요</p>
          </div>
        ) : characters.length > 0 ? (
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
                      {isSelected && (
                        <Check className="h-4 w-4 text-purple-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {character.description || '설명 없음'}
                    </p>
                  </div>

                  {/* 삭제 버튼 */}
                  {hoveredCharacter === character.id && onCharacterDelete && (
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
        ) : null}
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