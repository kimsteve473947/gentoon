"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Package,
  TreePine,
  Home,
  Car,
  Coffee,
  Book,
  Sword,
  Shield,
  Crown,
  Heart,
  Star,
  Sparkles,
  Camera,
  Palette,
  Music,
  Gamepad2,
  Briefcase,
  ShoppingBag,
  Utensils,
  Smartphone,
  Plus,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

// 미리 정의된 요소들
const PREDEFINED_ELEMENTS = {
  objects: [
    { id: 'coffee_cup', name: '커피 컵', icon: Coffee, prompt: '커피 컵을 들고 있는' },
    { id: 'book', name: '책', icon: Book, prompt: '책을 읽고 있는' },
    { id: 'smartphone', name: '스마트폰', icon: Smartphone, prompt: '스마트폰을 사용하고 있는' },
    { id: 'bag', name: '가방', icon: ShoppingBag, prompt: '가방을 메고 있는' },
    { id: 'briefcase', name: '서류가방', icon: Briefcase, prompt: '서류가방을 들고 있는' },
    { id: 'camera', name: '카메라', icon: Camera, prompt: '카메라를 들고 있는' },
    { id: 'palette', name: '팔레트', icon: Palette, prompt: '팔레트를 들고 있는' },
    { id: 'gamepad', name: '게임패드', icon: Gamepad2, prompt: '게임패드를 들고 있는' },
  ],
  fantasy: [
    { id: 'sword', name: '검', icon: Sword, prompt: '검을 들고 있는' },
    { id: 'shield', name: '방패', icon: Shield, prompt: '방패를 들고 있는' },
    { id: 'crown', name: '왕관', icon: Crown, prompt: '왕관을 쓰고 있는' },
    { id: 'magic_staff', name: '마법 지팡이', icon: Sparkles, prompt: '마법 지팡이를 들고 있는' },
  ],
  environments: [
    { id: 'cafe', name: '카페', icon: Coffee, prompt: '카페에서' },
    { id: 'home', name: '집', icon: Home, prompt: '집에서' },
    { id: 'park', name: '공원', icon: TreePine, prompt: '공원에서' },
    { id: 'car', name: '차 안', icon: Car, prompt: '차 안에서' },
    { id: 'office', name: '사무실', icon: Briefcase, prompt: '사무실에서' },
    { id: 'restaurant', name: '레스토랑', icon: Utensils, prompt: '레스토랑에서' },
  ]
};

interface ElementSelectorProps {
  selectedElements: string[];
  onElementToggle: (elementId: string) => void;
  selectedCharacters: string[]; // 캐릭터 선택 상태 추가
  className?: string;
}

export function ElementSelector({ 
  selectedElements, 
  onElementToggle,
  selectedCharacters, 
  className 
}: ElementSelectorProps) {
  const [customElement, setCustomElement] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleCustomElementAdd = () => {
    if (customElement.trim()) {
      onElementToggle(`custom_${Date.now()}_${customElement.trim()}`);
      setCustomElement('');
      setShowCustomInput(false);
    }
  };

  const getElementPrompt = (elementId: string) => {
    for (const category of Object.values(PREDEFINED_ELEMENTS)) {
      const element = category.find(el => el.id === elementId);
      if (element) return element.prompt;
    }
    
    // 커스텀 요소인 경우
    if (elementId.startsWith('custom_')) {
      const customText = elementId.split('_').slice(2).join('_');
      return `${customText}와 함께`;
    }
    
    return elementId;
  };

  const renderElementCategory = (title: string, elements: any[], icon: any) => {
    const Icon = icon;
    
    return (
      <div key={title} className="space-y-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-500" />
          <h5 className="text-xs font-medium text-slate-600 uppercase tracking-wide">{title}</h5>
        </div>
        
        <div className="grid grid-cols-2 gap-1.5">
          {elements.map((element) => {
            const isSelected = selectedElements.includes(element.id);
            const IconComponent = element.icon;
            
            return (
              <button
                key={element.id}
                onClick={() => onElementToggle(element.id)}
                className={cn(
                  "flex items-center gap-2 p-2 text-left text-xs rounded-md transition-all border",
                  isSelected 
                    ? "border-purple-300 bg-purple-50 text-purple-700" 
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600"
                )}
              >
                <IconComponent className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{element.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // 커스텀 요소들 렌더링
  const customElements = selectedElements.filter(id => id.startsWith('custom_'));

  // 캐릭터 선택 여부 확인
  const hasSelectedCharacters = selectedCharacters.length > 0;

  return (
    <div className={cn("space-y-3", className)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className={cn(
            "text-sm font-medium",
            hasSelectedCharacters ? "text-slate-700" : "text-slate-400"
          )}>요소 설정</h4>
          <Badge variant="outline" className="text-xs">
            {selectedElements.length}
          </Badge>
        </div>
      </div>

      {/* 캐릭터 미선택 안내 */}
      {!hasSelectedCharacters && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <Package className="h-4 w-4 text-amber-500" />
          <p className="text-xs text-amber-700">
            캐릭터를 먼저 선택한 후 요소를 선택해주세요
          </p>
        </div>
      )}

      {/* 선택된 요소들 미리보기 */}
      {selectedElements.length > 0 && (
        <div className="p-2 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-600 mb-1">적용될 프롬프트:</p>
          <p className="text-xs text-purple-700 font-medium">
            {selectedElements.map(id => getElementPrompt(id)).join(', ')}
          </p>
        </div>
      )}

      {/* 요소 카테고리들 - 캐릭터 선택시에만 활성화 */}
      {hasSelectedCharacters && (
        <div className="space-y-4 max-h-48 overflow-y-auto">
          {renderElementCategory("아이템", PREDEFINED_ELEMENTS.objects, Package)}
          {renderElementCategory("판타지", PREDEFINED_ELEMENTS.fantasy, Sparkles)}
          {renderElementCategory("배경", PREDEFINED_ELEMENTS.environments, Home)}
        
        {/* 커스텀 요소들 */}
        {customElements.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-slate-500" />
              <h5 className="text-xs font-medium text-slate-600 uppercase tracking-wide">커스텀</h5>
            </div>
            
            <div className="space-y-1">
              {customElements.map((elementId) => {
                const customText = elementId.split('_').slice(2).join('_');
                
                return (
                  <div
                    key={elementId}
                    className="flex items-center gap-2 p-2 bg-purple-50 border border-purple-200 rounded-md"
                  >
                    <Star className="h-3 w-3 text-purple-600 flex-shrink-0" />
                    <span className="text-xs text-purple-700 flex-1">{customText}</span>
                    <button
                      onClick={() => onElementToggle(elementId)}
                      className="text-purple-400 hover:text-purple-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          )}
        
        {/* 커스텀 요소 추가 */}
        <div className="space-y-2">
        {showCustomInput ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={customElement}
              onChange={(e) => setCustomElement(e.target.value)}
              placeholder="커스텀 요소 입력..."
              className="flex-1 text-xs p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCustomElementAdd();
                } else if (e.key === 'Escape') {
                  setShowCustomInput(false);
                  setCustomElement('');
                }
              }}
              autoFocus
            />
            <Button
              size="sm"
              onClick={handleCustomElementAdd}
              className="px-3"
            >
              추가
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCustomInput(false);
                setCustomElement('');
              }}
              className="px-3"
            >
              취소
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full border-dashed border-slate-300 text-slate-600 hover:border-purple-300 hover:text-purple-600"
            onClick={() => setShowCustomInput(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            커스텀 요소 추가
          </Button>
        )}
        </div>
        </div>
      )}
    </div>
  );
}