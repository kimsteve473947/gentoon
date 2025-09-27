"use client";

import { useState, useEffect } from 'react';
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
  characters: string[];
  elements: string[];
}

interface AIScriptGeneratorProps {
  onScriptGenerated: (panels: ScriptPanel[]) => void;
  onApplyToCanvas?: (panels: ScriptPanel[]) => void;
  className?: string;
}

export function AIScriptGenerator({ onScriptGenerated, onApplyToCanvas, className }: AIScriptGeneratorProps) {
  const [storyPrompt, setStoryPrompt] = useState('');
  const [selectedPanelCount, setSelectedPanelCount] = useState<'3-5' | '6-8' | '8-10'>('3-5');
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [elements, setElements] = useState<Element[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<ScriptPanel[]>([]);
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

  useEffect(() => {
    loadCharactersAndElements();
  }, []);

  const loadCharactersAndElements = async () => {
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

      // 캐릭터와 요소를 병렬로 로드
      const [charactersResult, elementsResult] = await Promise.all([
        supabase
          .from('character')
          .select('id, name, description, thumbnailUrl')
          .eq('userId', userData.id)
          .order('createdAt', { ascending: false }),
        supabase
          .from('element')
          .select('id, name, description, category, thumbnailUrl')
          .eq('userId', userData.id)
          .order('createdAt', { ascending: false })
      ]);

      setCharacters(charactersResult.data || []);
      setElements(elementsResult.data || []);
    } catch (error) {
      console.error('캐릭터/요소 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCharacterToggle = (characterId: string) => {
    setSelectedCharacters(prev => 
      prev.includes(characterId)
        ? prev.filter(id => id !== characterId)
        : [...prev, characterId]
    );
  };

  const handleElementToggle = (elementId: string) => {
    setSelectedElements(prev => 
      prev.includes(elementId)
        ? prev.filter(id => id !== elementId)
        : [...prev, elementId]
    );
  };

  const generateScript = async () => {
    if (!storyPrompt.trim()) {
      alert('스토리 아이디어를 입력해주세요');
      return;
    }

    setIsGenerating(true);
    
    try {
      // 선택된 캐릭터와 요소 정보 수집
      const characterNames = selectedCharacters.map(id => {
        const char = characters.find(c => c.id === id);
        return char?.name || '';
      }).filter(Boolean);

      const elementNames = selectedElements.map(id => {
        const element = elements.find(e => e.id === id);
        return element ? `${element.name} (${element.description})` : '';
      }).filter(Boolean);

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
          elementNames,
          panelCount,
          style: 'webtoon'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '대본 생성 실패');
      }

      const result = await response.json();
      setGeneratedScript(result.panels);
      
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

  const useGeneratedScript = () => {
    onScriptGenerated(generatedScript);
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

        {/* 캐릭터 선택 */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700">
            등장 캐릭터 (선택사항)
          </label>
          {characters.length === 0 ? (
            <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-lg">
              <User className="h-6 w-6 mx-auto mb-2" />
              <p className="text-sm">등록된 캐릭터가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {characters.map((character) => (
                <div
                  key={character.id}
                  className={cn(
                    "flex items-center gap-3 p-2 border rounded-lg cursor-pointer transition-all",
                    selectedCharacters.includes(character.id)
                      ? "border-purple-300 bg-purple-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                  onClick={() => handleCharacterToggle(character.id)}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={character.thumbnailUrl} alt={character.name} />
                    <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">
                      {character.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{character.name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {character.description}
                    </div>
                  </div>
                  {selectedCharacters.includes(character.id) && (
                    <Check className="h-4 w-4 text-purple-600" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 요소 선택 - 🚨 FORCED VISIBLE FOR DEBUGGING */}
        <div className="space-y-3" style={{backgroundColor: '#ffeb3b', padding: '10px', border: '2px solid red'}}>
          <label className="text-sm font-medium text-gray-700">
            🎯 등장 요소 (선택사항) - Elements: {elements.length}
          </label>
          {elements.length === 0 ? (
            <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-lg">
              <FileText className="h-6 w-6 mx-auto mb-2" />
              <p className="text-sm">등록된 요소가 없습니다 (개발 모드: 강제 표시)</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {elements.map((element) => (
                <div
                  key={element.id}
                  className={cn(
                    "flex items-center gap-3 p-2 border rounded-lg cursor-pointer transition-all",
                    selectedElements.includes(element.id)
                      ? "border-green-300 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                  onClick={() => handleElementToggle(element.id)}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={element.thumbnailUrl} alt={element.name} />
                    <AvatarFallback className="bg-green-100 text-green-700 text-xs">
                      {element.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{element.name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {element.description}
                    </div>
                    <div className="text-xs text-blue-600 font-medium">
                      {element.category}
                    </div>
                  </div>
                  {selectedElements.includes(element.id) && (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                </div>
              ))}
            </div>
          )}
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
        {generatedScript.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">생성된 대본</h3>
              <div className="flex gap-2">
                <Button
                  onClick={() => onApplyToCanvas?.(generatedScript)}
                  size="sm"
                  variant="outline"
                  className="border-blue-300 text-blue-600 hover:bg-blue-50"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  패널에 적용하기
                </Button>
                <Button
                  onClick={useGeneratedScript}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  한꺼번에 생성하기
                </Button>
              </div>
            </div>
            
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {generatedScript.map((panel, index) => (
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
                  
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {panel.prompt}
                  </p>
                  
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