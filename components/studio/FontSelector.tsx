import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Type, Heart, Star } from 'lucide-react';
import { STUDIO_FONTS } from '@/lib/fonts/noonnu-fonts';

interface FontSelectorProps {
  selectedFontFamily: string;
  selectedFontWeight?: number | string;
  onFontChange: (fontFamily: string, fontWeight: number) => void;
  className?: string;
}

export const FontSelector: React.FC<FontSelectorProps> = ({ 
  selectedFontFamily, 
  selectedFontWeight = 400,
  onFontChange, 
  className = '' 
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [expandedFonts, setExpandedFonts] = useState<Set<string>>(new Set());
  const [favoriteFonts, setFavoriteFonts] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // selectedFontWeight를 숫자로 변환
  const numericWeight = typeof selectedFontWeight === 'string' 
    ? (selectedFontWeight === 'normal' ? 400 : selectedFontWeight === 'bold' ? 700 : parseInt(selectedFontWeight) || 400)
    : selectedFontWeight;

  // 현재 선택된 폰트 찾기
  const currentFont = STUDIO_FONTS.find(f => f.fontFamily === selectedFontFamily) || STUDIO_FONTS[0];
  const currentWeight = currentFont?.weights?.find(w => w.weight === numericWeight);

  // 폰트 확장/축소 토글
  const toggleFontExpanded = (fontId: string) => {
    setExpandedFonts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fontId)) {
        newSet.delete(fontId);
      } else {
        newSet.add(fontId);
      }
      return newSet;
    });
  };

  // 폰트 선택 핸들러
  const handleFontSelect = (fontFamily: string, weight: number) => {
    onFontChange(fontFamily, weight);
    setShowDropdown(false);
  };

  // 찜 기능 토글
  const toggleFavorite = (fontId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteFonts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fontId)) {
        newSet.delete(fontId);
      } else {
        newSet.add(fontId);
      }
      return newSet;
    });
  };

  // 로컬스토리지에서 찜 목록 로드
  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem('fontSelector-favorites');
      if (savedFavorites) {
        setFavoriteFonts(new Set(JSON.parse(savedFavorites)));
      }
    } catch (error) {
      console.error('Failed to load font preferences:', error);
    }
  }, []);

  // 찜 목록이 변경될 때 로컬스토리지에 저장
  useEffect(() => {
    try {
      localStorage.setItem('fontSelector-favorites', JSON.stringify(Array.from(favoriteFonts)));
    } catch (error) {
      console.error('Failed to save favorites:', error);
    }
  }, [favoriteFonts]);

  // 필터링된 폰트 목록 (선택된 폰트를 맨 위로)
  const filteredFonts = useMemo(() => {
    let fonts = showFavoritesOnly 
      ? STUDIO_FONTS.filter(font => favoriteFonts.has(font.id))
      : STUDIO_FONTS;
    
    // 현재 선택된 폰트를 맨 위로 이동
    const selectedFont = fonts.find(font => font.fontFamily === selectedFontFamily);
    if (selectedFont) {
      fonts = [selectedFont, ...fonts.filter(font => font.fontFamily !== selectedFontFamily)];
    }
    
    return fonts;
  }, [showFavoritesOnly, favoriteFonts, selectedFontFamily]);

  // 폰트 CSS 로딩
  useEffect(() => {
    STUDIO_FONTS.forEach(font => {
      font.weights?.forEach(weight => {
        if (weight.cssCode) {
          const fontId = `${font.id}-${weight.weight}`;
          
          // 이미 로드된 폰트는 스킵
          const existingStyle = document.querySelector(`style[data-font-id="${fontId}"]`);
          const existingLink = document.querySelector(`link[data-font-id="${fontId}"]`);
          if (existingStyle || existingLink) return;
          
          if (weight.cssCode.includes('@import')) {
            // @import URL 추출하여 link 태그로 로드
            const urlMatch = weight.cssCode.match(/@import\s+url\s*\(\s*["']?([^"')]+)["']?\s*\)/);
            if (urlMatch) {
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = urlMatch[1];
              link.setAttribute('data-font-id', fontId);
              document.head.appendChild(link);
            }
          } else {
            // @font-face는 style 태그로 로드
            const style = document.createElement('style');
            style.textContent = weight.cssCode;
            style.setAttribute('data-font-id', fontId);
            document.head.appendChild(style);
          }
        }
      });
    });
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* 선택된 폰트 표시 버튼 */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="w-full px-4 py-3 border border-slate-300 rounded-lg text-left bg-white hover:border-purple-400 transition-all flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Type className="h-4 w-4 text-slate-500" />
          <span 
            className="font-medium text-slate-700 truncate max-w-40"
            style={{ 
              fontFamily: selectedFontFamily,
              fontWeight: numericWeight 
            }}
          >
            {currentFont?.nameKo || 'Noto Sans KR'}
          </span>
        </div>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </button>

      {/* 드롭다운 메뉴 */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-[9999] max-h-96 overflow-hidden">
          
          {/* 찜 필터 버튼 */}
          <div className="border-b border-slate-200 p-2">
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`w-full px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                showFavoritesOnly
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Star className={`h-4 w-4 ${showFavoritesOnly ? 'fill-purple-600' : ''}`} />
              {showFavoritesOnly ? `찜한 폰트 (${favoriteFonts.size}개)` : '찜한 폰트만 보기'}
            </button>
          </div>

          {/* 폰트 목록 */}
          <div className="max-h-80 overflow-y-auto">
            {filteredFonts.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-sm">
                {showFavoritesOnly ? '찜한 폰트가 없습니다.' : '폰트를 찾을 수 없습니다.'}
              </div>
            ) : (
              filteredFonts.map((font, index) => {
              const isSelected = selectedFontFamily === font.fontFamily;
              const isExpanded = expandedFonts.has(font.id);
              const defaultWeight = font.weights?.[0] || { weight: 400, name: 'Regular' };

              return (
                <div key={font.id}>
                  {/* 폰트 패밀리 행 */}
                  <div className={`flex items-center ${isSelected ? 'bg-purple-50 border-l-4 border-purple-500' : 'hover:bg-slate-50'}`}>
                    {/* Weight 선택 버튼 (여러 weight가 있는 폰트만) */}
                    {font.weights && font.weights.length > 1 && (
                      <button
                        onClick={() => toggleFontExpanded(font.id)}
                        className="px-3 py-3 hover:bg-slate-100 border-b border-slate-100"
                      >
                        <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${
                          isExpanded ? 'rotate-90' : ''
                        }`} />
                      </button>
                    )}
                    
                    <div
                      onClick={() => handleFontSelect(font.fontFamily, defaultWeight.weight)}
                      className="flex-1 px-4 py-3 text-left border-b border-slate-100 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          {isSelected && (
                            <span className="text-xs text-purple-600 font-medium mb-1">
                              사용중인 글꼴
                            </span>
                          )}
                          <div 
                            className="text-sm font-medium text-slate-700 truncate max-w-48"
                            style={{ 
                              fontFamily: font.fontFamily,
                              fontWeight: defaultWeight.weight
                            }}
                          >
                            {font.nameKo}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* 찜 기능 */}
                          <button
                            onClick={(e) => toggleFavorite(font.id, e)}
                            className="p-1 hover:bg-purple-100 rounded transition-colors"
                          >
                            <Heart 
                              className={`h-4 w-4 transition-colors ${
                                favoriteFonts.has(font.id) 
                                  ? 'text-red-500 fill-red-500' 
                                  : 'text-slate-400 hover:text-red-400'
                              }`} 
                            />
                          </button>
                          {isSelected && (
                            <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Weight 목록 (확장된 경우) */}
                  {isExpanded && font.weights && font.weights.length > 1 && (
                    <div className="bg-slate-50 border-b border-slate-200">
                      {font.weights.map((weight) => (
                        <button
                          key={weight.weight}
                          onClick={() => handleFontSelect(font.fontFamily, weight.weight)}
                          className="w-full px-8 py-2 text-left hover:bg-slate-100 flex items-center gap-3"
                        >
                          <span className="text-xs font-medium text-slate-600 w-12">
                            {weight.weight}
                          </span>
                          <span 
                            className="text-sm text-slate-700"
                            style={{ 
                              fontFamily: font.fontFamily,
                              fontWeight: weight.weight 
                            }}
                          >
                            {weight.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* 선택된 폰트 다음에 구분선 표시 */}
                  {index === 0 && isSelected && filteredFonts.length > 1 && (
                    <div className="border-b-2 border-purple-200 my-2"></div>
                  )}
                </div>
              );
              })
            )}
          </div>

          {/* 폰트 미리보기 */}
          <div className="border-t border-slate-200 bg-gray-50 p-3">
            <div 
              className="text-sm text-slate-600"
              style={{ 
                fontFamily: selectedFontFamily,
                fontWeight: numericWeight 
              }}
            >
              웹툰 제작을 위한 아름다운 한글 폰트 ABC123 가나다라마바사
            </div>
          </div>
        </div>
      )}
    </div>
  );
};