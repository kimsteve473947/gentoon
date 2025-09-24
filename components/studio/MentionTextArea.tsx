"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, ImageIcon, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// 멘션 가능한 항목 타입
interface MentionItem {
  id: string;
  name: string;
  type: 'character' | 'element';
  imageUrl?: string;
  thumbnailUrl?: string;
  description?: string;
}

interface MentionTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  characters: MentionItem[];
  elements: MentionItem[];
  placeholder?: string;
  className?: string;
  id?: string;
  onCharacterSelect?: (characterId: string) => void;
  onElementSelect?: (element: { id: string; name: string; imageUrl: string; description: string }) => void;
}

export function MentionTextArea({
  value,
  onChange,
  characters,
  elements,
  placeholder,
  className,
  id,
  onCharacterSelect,
  onElementSelect
}: MentionTextAreaProps) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ start: 0, end: 0 });
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [showSuccessToast, setShowSuccessToast] = useState('');
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // 캐릭터와 요소를 모두 드롭다운에 포함
  const allMentionItems = [
    ...characters.map(char => ({ ...char, type: 'character' as const })),
    ...elements.map(elem => ({ ...elem, type: 'element' as const }))
  ];

  // 멘션 필터링 (쿼리가 빈 문자열이면 모든 항목 표시)
  const filteredMentions = allMentionItems.filter(item =>
    mentionQuery === '' || item.name.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  // textarea용 텍스트 변경 핸들러
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    const text = textarea.value;
    const cursorPos = textarea.selectionStart || 0;
    
    const textBefore = text.substring(0, cursorPos);
    const lastAtIndex = textBefore.lastIndexOf('@');
    
    // @ 바로 뒤에서 드롭다운 표시 (즉시)
    if (lastAtIndex !== -1 && cursorPos > lastAtIndex) {
      const textAfterAt = textBefore.substring(lastAtIndex + 1);
      
      // @ 바로 뒤이거나, 공백/개행/@가 없으면 드롭다운 표시
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n') && !textAfterAt.includes('@')) {
        setShowMentions(true);
        setMentionQuery(textAfterAt);
        setMentionPosition({ start: lastAtIndex, end: cursorPos });
        setSelectedMentionIndex(0);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
    
    onChange(text);
  }, [onChange]);

  // 키보드 이벤트 처리
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMentions || filteredMentions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev < filteredMentions.length - 1 ? prev + 1 : 0
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev > 0 ? prev - 1 : filteredMentions.length - 1
        );
        break;
      
      case 'Enter':
      case 'Tab':
        if (showMentions && filteredMentions.length > 0) {
          e.preventDefault();
          insertMention(filteredMentions[selectedMentionIndex]);
        }
        break;
      
      case 'Escape':
        e.preventDefault();
        setShowMentions(false);
        break;
    }
  }, [showMentions, filteredMentions, selectedMentionIndex]);

  // 요소 멘션 삽입 (textarea용)
  const insertMention = useCallback((item: MentionItem) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const text = textarea.value;
    const beforeMention = text.substring(0, mentionPosition.start);
    const afterMention = text.substring(mentionPosition.end);
    const mentionTag = `@${item.name}`;
    
    const newText = beforeMention + mentionTag + ' ' + afterMention;
    
    // 텍스트 업데이트
    textarea.value = newText;
    onChange(newText);
    
    setShowMentions(false);
    setMentionQuery('');
    
    // 실제 캐릭터/요소 선택 함수 호출
    if (item.type === 'character' && onCharacterSelect) {
      onCharacterSelect(item.id);
      console.log('🎭 캐릭터 선택됨:', item.name, item.id);
    } else if (item.type === 'element' && onElementSelect) {
      onElementSelect({
        id: item.id,
        name: item.name,
        imageUrl: item.imageUrl || '',
        description: item.description || ''
      });
      console.log('🖼️ 요소 선택됨:', item.name, item.id);
    }

    // 성공 토스트 표시
    setShowSuccessToast(item.name);
    setTimeout(() => setShowSuccessToast(''), 2000);
    
    // 커서 위치 설정
    const newCursorPos = mentionPosition.start + mentionTag.length + 1;
    setTimeout(() => {
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  }, [mentionPosition, onChange]);

  // value가 변경되면 textarea 업데이트
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    if (textarea.value !== value) {
      textarea.value = value;
    }
  }, [value]);

  return (
    <div className="relative">
      {/* 멘션 하이라이트 오버레이 */}
      <div
        className="absolute inset-0 pointer-events-none whitespace-pre-wrap break-words px-3 py-2 text-sm leading-5 z-5"
        style={{
          fontFamily: 'inherit',
          fontSize: '14px',
          lineHeight: '20px',
          color: 'transparent',
        }}
        dangerouslySetInnerHTML={{
          __html: value.replace(
            /@([가-힣a-zA-Z0-9]+)/g,
            (match, name) => {
              // 캐릭터인지 요소인지 확인
              const isCharacter = characters.some(char => char.name === name);
              const isElement = elements.some(elem => elem.name === name);
              
              if (isCharacter) {
                return `<span style="color: #9333ea; font-weight: 600; background-color: rgba(147, 51, 234, 0.1);">${match}</span>`;
              } else if (isElement) {
                return `<span style="color: #2563eb; font-weight: 600; background-color: rgba(37, 99, 235, 0.1);">${match}</span>`;
              } else {
                return `<span style="color: #2563eb; font-weight: 600; background-color: rgba(37, 99, 235, 0.1);">${match}</span>`;
              }
            }
          )
        }}
      />
      
      {/* 일반 textarea */}
      <Textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          "min-h-[120px] resize-none relative z-20 bg-transparent",
          className
        )}
        style={{ 
          color: 'transparent',
          caretColor: '#0f172a' // 커서 색상 표시
        }}
      />
      
      {/* 텍스트 표시용 오버레이 */}
      <div
        className="absolute inset-0 pointer-events-none whitespace-pre-wrap break-words px-3 py-2 text-sm leading-5 z-10"
        style={{
          fontFamily: 'inherit',
          fontSize: '14px',
          lineHeight: '20px',
          color: '#0f172a',
        }}
        dangerouslySetInnerHTML={{
          __html: value.replace(
            /@([가-힣a-zA-Z0-9]+)/g,
            (match, name) => {
              // 캐릭터인지 요소인지 확인
              const isCharacter = characters.some(char => char.name === name);
              const isElement = elements.some(elem => elem.name === name);
              
              if (isCharacter) {
                return `<span style="color: #9333ea; font-weight: 600;">${match}</span>`;
              } else if (isElement) {
                return `<span style="color: #2563eb; font-weight: 600;">${match}</span>`;
              } else {
                return `<span style="color: #2563eb; font-weight: 600;">${match}</span>`;
              }
            }
          )
        }}
      />

      {/* 성공 토스트 */}
      {showSuccessToast && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-3 py-2 rounded-md shadow-lg z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Check className="h-4 w-4" />
          <span className="text-sm font-medium">@{showSuccessToast} 추가됨</span>
        </div>
      )}

      {/* 요소 드롭다운 - 캐릭터가 있을 때만 표시 */}
      {showMentions && filteredMentions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-48 w-64 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="py-1">
            {filteredMentions.map((item, index) => (
              <button
                key={item.id}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 border-none bg-transparent cursor-pointer",
                  index === selectedMentionIndex && "bg-blue-50"
                )}
                onClick={() => insertMention(item)}
                onMouseEnter={() => setSelectedMentionIndex(index)}
                type="button"
              >
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarImage 
                    src={item.thumbnailUrl || item.imageUrl} 
                    alt={item.name} 
                  />
                  <AvatarFallback className={cn(
                    "text-xs",
                    item.type === 'character' 
                      ? "bg-purple-100 text-purple-700" 
                      : "bg-blue-100 text-blue-700"
                  )}>
                    {item.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {item.type === 'character' ? (
                      <User className="h-3 w-3 text-purple-600" />
                    ) : (
                      <ImageIcon className="h-3 w-3 text-blue-600" />
                    )}
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {item.name}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {item.description}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// @mention 패턴을 제거하는 유틸리티 함수
export function processMentions(
  text: string, 
  characters: MentionItem[], 
  elements: MentionItem[]
): string {
  // @mention 패턴을 제거 - 실제 캐릭터/요소 이미지는 별도로 전달됨
  let cleanText = text;
  
  // @캐릭터이름, @요소이름 패턴을 제거
  cleanText = cleanText.replace(/@([가-힣a-zA-Z0-9]+)/g, '');
  
  // 연속된 공백을 하나로 정리
  cleanText = cleanText.replace(/\s+/g, ' ').trim();
  
  return cleanText;
}