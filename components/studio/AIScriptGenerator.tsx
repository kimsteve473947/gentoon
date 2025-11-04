"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Sparkles, 
  Copy, 
  Check,
  User,
  Loader2,
  Plus,
  X,
  AlertCircle,
  FileText,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createBrowserClient } from '@supabase/ssr';

interface Character {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  thumbnailUrl?: string;
}

interface Element {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnailUrl?: string;
}

interface ScriptPanel {
  order: number;
  prompt: string;
  characters: string[]; // AI 생성 캐릭터 이름들 (참고용)
  elements: string[]; // AI 생성 요소 이름들 (참고용)
  characterIds?: string[]; // 🚀 실제 DB 캐릭터 ID들
  elementIds?: string[]; // 🚀 실제 DB 요소 ID들
}

interface AIScriptGeneratorProps {
  onApplyToCanvas?: (panels: ScriptPanel[]) => void;
  className?: string;
  generatedScript?: ScriptPanel[];
  setGeneratedScript?: (script: ScriptPanel[]) => void;
  editedScript?: ScriptPanel[];
  setEditedScript?: (script: ScriptPanel[]) => void;
  // 🚀 외부에서 전달받는 캐릭터 및 요소 선택 상태
  selectedCharacterIds?: string[];
  selectedElementIds?: string[];
}

export function AIScriptGenerator({
  onApplyToCanvas, 
  className,
  generatedScript: externalGeneratedScript,
  setGeneratedScript: setExternalGeneratedScript,
  editedScript: externalEditedScript,
  setEditedScript: setExternalEditedScript,
  selectedCharacterIds = [],
  selectedElementIds = []
}: AIScriptGeneratorProps) {
  const [storyPrompt, setStoryPrompt] = useState('');
  const [selectedPanelCount, setSelectedPanelCount] = useState<'3-5' | '6-8' | '8-10'>('3-5');
  // 🚀 외부에서 전달받은 선택 상태 사용 (내부 상태 제거)
  // const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  // const [selectedElements, setSelectedElements] = useState<string[]>([]);
  
  // 🚀 외부 선택 상태를 내부에서 사용
  const selectedCharacters = selectedCharacterIds;
  const selectedElements = selectedElementIds;
  const [characters, setCharacters] = useState<Character[]>([]);
  const [elements, setElements] = useState<Element[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // 외부 상태가 있으면 사용하고, 없으면 내부 상태 사용 (하위 호환성)
  const [internalGeneratedScript, setInternalGeneratedScript] = useState<ScriptPanel[]>([]);
  const [internalEditedScript, setInternalEditedScript] = useState<ScriptPanel[]>([]);
  
  const generatedScript = externalGeneratedScript ?? internalGeneratedScript;
  const setGeneratedScript = setExternalGeneratedScript ?? setInternalGeneratedScript;
  const editedScript = externalEditedScript ?? internalEditedScript;
  const setEditedScript = setExternalEditedScript ?? setInternalEditedScript;
  const [loading, setLoading] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const panelCountOptions = [
    { value: '3-5', label: '3-5', description: '짧은 에피소드' },
    { value: '6-8', label: '6-8', description: '중간 길이' },
    { value: '8-10', label: '8-10', description: '긴 스토리' }
  ] as const;

  // 🚀 선택된 캐릭터/요소가 실제로 변경되었을 때만 로드 (무한 루프 방지)
  const currentCharacterIds = selectedCharacters.join(',');
  const currentElementIds = selectedElements.join(',');
  
  useEffect(() => {
    // 선택된 항목이 있을 때만 로드
    if (currentCharacterIds || currentElementIds) {
      loadCharactersAndElements();
    }
  }, [currentCharacterIds, currentElementIds]); // 문자열 비교로 실제 변경만 감지

  // 생성된 대본이 변경되면 편집 가능한 대본도 업데이트
  useEffect(() => {
    setEditedScript(generatedScript);
  }, [generatedScript]);

  const loadCharactersAndElements = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('user')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!userData) return;

      // 선택된 캐릭터와 요소 정보만 로드 (성능 최적화)
      const loadPromises = [];
      
      if (selectedCharacters.length > 0) {
        loadPromises.push(
          supabase
            .from('character')
            .select('id, name, description, thumbnailUrl')
            .eq('userId', userData.id)
            .in('id', selectedCharacters)
        );
      } else {
        loadPromises.push(Promise.resolve({ data: [] }));
      }
      
      if (selectedElements.length > 0) {
        loadPromises.push(
          supabase
            .from('element')
            .select('id, name, description, category, thumbnailUrl')
            .eq('userId', userData.id)
            .in('id', selectedElements)
        );
      } else {
        loadPromises.push(Promise.resolve({ data: [] }));
      }

      const [charactersResult, elementsResult] = await Promise.all(loadPromises);

      setCharacters(charactersResult.data || []);
      setElements(elementsResult.data || []);
      
      console.log('📋 선택된 캐릭터 정보 로드:', charactersResult.data?.length || 0, '개');
      console.log('📋 선택된 요소 정보 로드:', elementsResult.data?.length || 0, '개');
    } catch (error) {
      console.error('캐릭터/요소 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []); // 의존성 없음 - 함수 내에서 props 직접 사용

  // 🚀 캐릭터/요소 토글 기능 제거 - 외부에서 관리됨
  // const handleCharacterToggle = ...
  // const handleElementToggle = ...

  // 편집된 대본의 프롬프트 수정
  const handlePromptEdit = (index: number, newPrompt: string) => {
    setEditedScript(prev => 
      prev.map((panel, i) => 
        i === index ? { ...panel, prompt: newPrompt } : panel
      )
    );
  };

  // 편집된 대본의 캐릭터 수정
  const handleCharacterEdit = (index: number, newCharacters: string[]) => {
    setEditedScript(prev => 
      prev.map((panel, i) => 
        i === index ? { ...panel, characters: newCharacters } : panel
      )
    );
  };

  const generateScript = async () => {
    if (!storyPrompt.trim()) {
      alert('스토리 아이디어를 입력해주세요');
      return;
    }

    // 🚀 캐릭터나 요소가 선택되지 않으면 안내 메시지
    if (selectedCharacters.length === 0 && selectedElements.length === 0) {
      alert('위쪽에서 캐릭터나 요소를 먼저 선택해주세요');
      return;
    }

    setIsGenerating(true);
    
    try {
      // 🚀 외부에서 선택된 캐릭터와 요소 정보 사용
      const characterNames = selectedCharacters.map(id => {
        const char = characters.find(c => c.id === id);
        return char?.name || '';
      }).filter(Boolean);

      const elementNames = selectedElements.map(id => {
        const element = elements.find(e => e.id === id);
        return element ? `${element.name} (${element.description})` : '';
      }).filter(Boolean);
      
      console.log('🎭 대본 생성 요청:', {
        characterNames,
        elementNames,
        selectedCharacterIds: selectedCharacters,
        selectedElementIds: selectedElements
      });

      const panelCount = selectedPanelCount === '3-5' ? 4 : 
                        selectedPanelCount === '6-8' ? 7 : 9;

      // AI 대본 생성 API 호출
      const response = await fetch('/api/ai/generate-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          storyPrompt: storyPrompt.trim(),
          characterNames,
          selectedCharacterIds: selectedCharacters, // 🎭 실제 선택된 캐릭터 ID들 추가
          elementNames,
          selectedElementIds: selectedElements, // 🎯 실제 선택된 요소 ID들 추가
          panelCount,
          style: 'webtoon'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '대본 생성 실패');
      }

      const result = await response.json();
      setGeneratedScript(result.data?.panels || []);
      
    } catch (error) {
      console.error('대본 생성 실패:', error);
      alert(error instanceof Error ? error.message : '대본 생성 중 오류가 발생했습니다');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyPrompt = (prompt: string, index: number) => {
    navigator.clipboard.writeText(prompt);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const generateAndCreateBatch = async () => {
    // 🚀 1단계: 먼저 대본 생성 확인
    if (!storyPrompt.trim()) {
      alert('스토리 아이디어를 입력해주세요');
      return;
    }

    if (selectedCharacters.length === 0 && selectedElements.length === 0) {
      alert('위쪽에서 캐릭터나 요소를 먼저 선택해주세요');
      return;
    }

    setIsGenerating(true);
    
    try {
      let scriptToUse = editedScript;
      
      // 🚀 2단계: 대본이 없으면 먼저 생성
      if (generatedScript.length === 0) {
        console.log('📝 대본이 없어서 먼저 생성합니다...');
        
        // 대본 생성 API 직접 호출하여 결과를 바로 받기
        const response = await fetch('/api/ai/generate-script', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            storyPrompt: storyPrompt.trim(),
            characterNames: selectedCharacters.map(id => {
              const char = characters.find(c => c.id === id);
              return char?.name || '';
            }).filter(Boolean),
            selectedCharacterIds: selectedCharacters,
            elementNames: selectedElements.map(id => {
              const element = elements.find(e => e.id === id);
              return element ? `${element.name} (${element.description})` : '';
            }).filter(Boolean),
            selectedElementIds: selectedElements,
            panelCount: selectedPanelCount === '3-5' ? 4 : 
                       selectedPanelCount === '6-8' ? 7 : 9,
            style: 'webtoon'
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '대본 생성 실패');
        }

        const result = await response.json();
        const newScript = result.data?.panels || [];
        
        // 대본 생성 실패 시 중단
        if (newScript.length === 0) {
          alert('대본 생성에 실패했습니다. 다시 시도해주세요.');
          return;
        }
        
        // 🚀 State 업데이트와 동시에 로컬 변수도 업데이트
        setGeneratedScript(newScript);
        scriptToUse = newScript;
        console.log('📝 새로 생성된 대본:', newScript);
      }

      // 대본 생성 완료 - 사용자가 수동으로 적용 가능
      console.log('✅ 대본 생성 완료 - 사용자가 캔버스에 적용 가능:', scriptToUse);

    } catch (error) {
      console.error('❌ 대본 생성 오류:', error);
      alert('대본 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-lg">AI 대본 생성기</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          <CardTitle className="text-lg">AI 대본 생성기</CardTitle>
        </div>
        <p className="text-sm text-gray-600">
          스토리 아이디어를 입력하면 컷별 프롬프트를 자동 생성합니다
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* 스토리 프롬프트 입력 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            스토리 아이디어 <span className="text-red-500">*</span>
          </label>
          <Textarea
            value={storyPrompt}
            onChange={(e) => setStoryPrompt(e.target.value)}
            placeholder="예: 카페에서 우연히 만난 두 사람의 달콤한 만남..."
            className="resize-none h-20"
            disabled={isGenerating}
          />
        </div>

        {/* 컷 수 선택 */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700">컷 수 선택</label>
          <div className="grid grid-cols-3 gap-3">
            {panelCountOptions.map((option) => (
              <button
                key={option.value}
                className={cn(
                  "p-3 border-2 rounded-lg text-left transition-all",
                  selectedPanelCount === option.value
                    ? "border-purple-300 bg-purple-50"
                    : "border-gray-200 hover:border-gray-300"
                )}
                onClick={() => setSelectedPanelCount(option.value)}
                disabled={isGenerating}
              >
                <div className="font-medium text-sm">{option.label}</div>
                <div className="text-xs text-gray-500 mt-1">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 선택된 캐릭터 & 요소 정보 표시 */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700">
            선택된 캐릭터 & 요소
          </label>
          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
            {/* 선택된 캐릭터 */}
            <div>
              <div className="text-xs font-medium text-purple-700 mb-2 flex items-center gap-1">
                <User className="h-3 w-3" />
                캐릭터 ({selectedCharacters.length}개)
              </div>
              {selectedCharacters.length === 0 ? (
                <p className="text-xs text-gray-500">위쪽에서 캐릭터를 선택해주세요</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {characters.map((character) => (
                    <Badge key={character.id} variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
                      {character.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            
            {/* 선택된 요소 */}
            <div>
              <div className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1">
                <FileText className="h-3 w-3" />
                요소 ({selectedElements.length}개)
              </div>
              {selectedElements.length === 0 ? (
                <p className="text-xs text-gray-500">위쪽에서 요소를 선택해주세요</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {elements.map((element) => (
                    <Badge key={element.id} variant="secondary" className="bg-green-100 text-green-700 text-xs">
                      {element.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 생성 버튼 */}
        <Button
          onClick={generateScript}
          disabled={!storyPrompt.trim() || isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              대본 생성 중...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              AI 대본 생성하기
            </>
          )}
        </Button>

        {/* 생성된 대본 결과 */}
        {editedScript.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">대본 편집</h3>
              <div className="flex gap-2">
                <Button
                  onClick={generateAndCreateBatch}
                  size="sm"
                  disabled={isGenerating}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      대본 만들고 배치 생성 중...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      대본 만들고 바로 배치 생성
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {editedScript.map((panel, index) => (
                <div
                  key={index}
                  className="bg-gray-50 border rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-xs">
                      {index + 1}컷
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyPrompt(panel.prompt, index)}
                    >
                      {copiedIndex === index ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  
                  <Textarea
                    value={panel.prompt}
                    onChange={(e) => handlePromptEdit(index, e.target.value)}
                    className="text-sm leading-relaxed min-h-[80px] resize-none"
                    placeholder="프롬프트를 입력하세요..."
                  />
                  
                  {(panel.characters.length > 0 || panel.elements?.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {panel.characters.map((charName, charIndex) => (
                        <Badge key={`char-${charIndex}`} variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                          👤 {charName}
                        </Badge>
                      ))}
                      {panel.elements?.map((elementName, elementIndex) => (
                        <Badge key={`elem-${elementIndex}`} variant="secondary" className="text-xs bg-green-100 text-green-700">
                          🎯 {elementName.split(' (')[0]}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}