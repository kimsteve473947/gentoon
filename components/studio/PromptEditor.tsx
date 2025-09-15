"use client";

import { useState, useRef, useEffect } from "react";
import { useStudioStore } from "@/lib/stores/studio-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Wand2,
  Lightbulb,
  User,
  Palette,
  Heart,
  Zap,
  Smile,
  Sparkles
} from "lucide-react";
import { type CanvasRatio } from "@/types/editor";

// 스타일 옵션
const STYLE_OPTIONS = [
  { value: "korean_webtoon", label: "한국 웹툰", icon: "🇰🇷" },
  { value: "romance", label: "로맨스", icon: "💕" },
  { value: "action", label: "액션", icon: "⚡" },
  { value: "comedy", label: "코미디", icon: "😄" },
  { value: "slice_of_life", label: "일상", icon: "🌱" },
];

// 감정 옵션
const EMOTION_OPTIONS = [
  { value: "happy", label: "행복한", icon: "😊" },
  { value: "sad", label: "슬픈", icon: "😢" },
  { value: "excited", label: "신나는", icon: "🤩" },
  { value: "romantic", label: "로맨틱한", icon: "💖" },
  { value: "mysterious", label: "신비로운", icon: "🌙" },
  { value: "dramatic", label: "드라마틱한", icon: "🎭" },
  { value: "peaceful", label: "평화로운", icon: "🕊️" },
  { value: "tense", label: "긴장감 있는", icon: "😰" },
];

// 프롬프트 템플릿
const PROMPT_TEMPLATES = [
  {
    category: "일상",
    prompts: [
      "카페에서 커피를 마시며 창밖을 바라보고 있어",
      "학교 복도에서 친구와 이야기하고 있어",
      "집에서 책을 읽으며 휴식을 취하고 있어",
      "공원에서 산책하며 생각에 잠겨있어",
    ]
  },
  {
    category: "로맨스",
    prompts: [
      "첫 데이트에서 긴장하며 상대방을 바라보고 있어",
      "손을 잡으며 석양을 바라보고 있어",
      "편지를 받고 감동받은 표정을 짓고 있어",
      "우산 하나를 쓰고 함께 걷고 있어",
    ]
  },
  {
    category: "학교",
    prompts: [
      "교실에서 수업을 듣고 있어",
      "도서관에서 공부하고 있어",
      "체육시간에 운동하고 있어",
      "급식실에서 친구들과 식사하고 있어",
    ]
  }
];

interface PromptEditorProps {
  canvasRatio: CanvasRatio;
}

export function PromptEditor({ canvasRatio }: PromptEditorProps) {
  const {
    panels,
    activePanel,
    characters,
    activeCharacters,
    selectedStyle,
    selectedEmotion,
    updatePanelPrompt,
    setStyle,
    setEmotion,
    generatePanel,
  } = useStudioStore();

  const [promptSuggestions, setPromptSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const currentPanel = activePanel !== null ? panels[activePanel] : null;
  const currentPrompt = currentPanel?.prompt || "";

  // 캐릭터 이름 자동완성
  const [characterSuggestions, setCharacterSuggestions] = useState<typeof characters>([]);

  useEffect(() => {
    if (currentPrompt) {
      // 간단한 프롬프트 개선 제안
      generatePromptSuggestions(currentPrompt);
    }
  }, [currentPrompt]);

  // 프롬프트 업데이트
  const handlePromptChange = (value: string) => {
    if (activePanel !== null) {
      // 캔버스 비율 정보를 프롬프트에 추가
      const aspectRatioInfo = canvasRatio === '4:5' 
        ? 'vertical format, 4:5 aspect ratio, Instagram portrait style' 
        : 'square format, 1:1 aspect ratio, Instagram square style';
      
      const enhancedValue = value.includes('[ASPECT]') 
        ? value.replace('[ASPECT]', aspectRatioInfo)
        : value;
      
      updatePanelPrompt(activePanel, enhancedValue);
      
      // 캐릭터 이름 감지 및 자동완성 제안
      detectCharacterMentions(value);
    }
  };

  // 캐릭터 언급 감지
  const detectCharacterMentions = (prompt: string) => {
    const words = prompt.toLowerCase().split(/\s+/);
    const lastWord = words[words.length - 1];
    
    if (lastWord.length > 0) {
      const suggestions = characters.filter(char => 
        char.name.toLowerCase().includes(lastWord) ||
        char.aliases.some(alias => alias.toLowerCase().includes(lastWord))
      );
      setCharacterSuggestions(suggestions);
    } else {
      setCharacterSuggestions([]);
    }
  };

  // 프롬프트 제안 생성
  const generatePromptSuggestions = (prompt: string) => {
    const suggestions = [];
    
    // 기본 개선 제안
    if (prompt.length < 20) {
      suggestions.push(prompt + "의 모습을 자세히 묘사해서");
    }
    
    // 감정 추가 제안
    if (!prompt.includes("표정") && !prompt.includes("기분")) {
      suggestions.push(prompt + " (밝은 표정으로)");
      suggestions.push(prompt + " (감정이 풍부하게)");
    }
    
    // 배경 추가 제안
    if (!prompt.includes("배경") && !prompt.includes("에서")) {
      suggestions.push(prompt + " 아름다운 배경과 함께");
    }
    
    setPromptSuggestions(suggestions.slice(0, 3));
  };

  // 프롬프트 개선 AI 요청
  const improvePrompt = async () => {
    if (!currentPrompt) return;
    
    try {
      const response = await fetch('/api/ai/improve-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: currentPrompt,
          style: selectedStyle,
          characters: activeCharacters,
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        handlePromptChange(data.improvedPrompt);
      }
    } catch (error) {
      console.error('Failed to improve prompt:', error);
    }
  };

  // 템플릿 적용
  const applyTemplate = (template: string) => {
    const activeChar = characters.find(c => c.isActive);
    const finalPrompt = activeChar 
      ? template.replace(/\b(그|그녀|주인공)\b/g, activeChar.name + "이")
      : template;
    
    handlePromptChange(finalPrompt);
  };

  // 캐릭터 이름 삽입
  const insertCharacterName = (character: typeof characters[0]) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = textarea.value;
    
    const newValue = currentValue.substring(0, start) + 
                    character.name + "이" + 
                    currentValue.substring(end);
    
    handlePromptChange(newValue);
    
    // 커서 위치 조정
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + character.name.length + 1, start + character.name.length + 1);
    }, 0);
  };

  if (!currentPanel) {
    return (
      <div className="h-full flex items-center justify-center p-4 text-center">
        <div>
          <Lightbulb className="h-12 w-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500 mb-2">패널을 선택하세요</p>
          <p className="text-sm text-gray-400">
            캔버스에서 패널을 클릭하면 편집할 수 있습니다
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="prompt" className="flex-1">
        <TabsList className="grid w-full grid-cols-3 m-4">
          <TabsTrigger value="prompt">프롬프트</TabsTrigger>
          <TabsTrigger value="style">스타일</TabsTrigger>
          <TabsTrigger value="templates">템플릿</TabsTrigger>
        </TabsList>

        <TabsContent value="prompt" className="flex-1 px-4 pb-4">
          <div className="space-y-4 h-full flex flex-col">
            {/* 활성 캐릭터 표시 */}
            {activeCharacters.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">활성 캐릭터</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {characters
                    .filter(c => c.isActive)
                    .map(char => (
                      <Badge 
                        key={char.id} 
                        variant="secondary"
                        className="text-xs cursor-pointer"
                        onClick={() => insertCharacterName(char)}
                      >
                        <User className="h-3 w-3 mr-1" />
                        {char.name}
                      </Badge>
                    ))
                  }
                </div>
              </div>
            )}

            {/* 프롬프트 입력 */}
            <div className="flex-1 flex flex-col">
              <Label htmlFor="prompt" className="mb-2">프롬프트</Label>
              <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-xs text-yellow-800">
                  ⚠️ <strong>중요:</strong> 프롬프트에 대사나 텍스트를 넣지 마세요. 
                  AI는 이미지만 생성합니다. 대사는 생성 후 말풍선으로 추가하세요.
                </p>
              </div>
              <Textarea
                ref={textareaRef}
                id="prompt"
                value={currentPrompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                placeholder="캐릭터와 배경만 설명하세요. 예: '학교 교실에서 창밖을 바라보는 여학생'"
                className="flex-1 min-h-[120px] resize-none"
              />
              
              {/* 캐릭터 자동완성 */}
              {characterSuggestions.length > 0 && (
                <div className="mt-1 p-2 bg-white border rounded-md shadow-sm">
                  <div className="text-xs text-gray-500 mb-1">캐릭터 제안:</div>
                  <div className="flex flex-wrap gap-1">
                    {characterSuggestions.slice(0, 3).map(char => (
                      <Badge
                        key={char.id}
                        variant="outline"
                        className="text-xs cursor-pointer hover:bg-gray-50"
                        onClick={() => insertCharacterName(char)}
                      >
                        {char.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 프롬프트 개선 제안 */}
            {promptSuggestions.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">개선 제안</Label>
                <div className="space-y-1">
                  {promptSuggestions.map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-left h-auto py-2 px-3 text-xs"
                      onClick={() => handlePromptChange(suggestion)}
                    >
                      <Lightbulb className="h-3 w-3 mr-2 flex-shrink-0" />
                      <span className="truncate">{suggestion}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* 액션 버튼들 */}
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={improvePrompt}
                disabled={!currentPrompt}
                className="w-full"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                AI로 프롬프트 개선
              </Button>
              
              <Button
                onClick={() => generatePanel(activePanel)}
                disabled={!currentPrompt || currentPanel.isGenerating}
                className="w-full"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                {currentPanel.imageUrl ? "재생성" : "생성"} (1토큰)
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="style" className="flex-1 px-4 pb-4">
          <div className="space-y-6">
            {/* 스타일 선택 */}
            <div>
              <Label className="mb-3 block">웹툰 스타일</Label>
              <div className="grid grid-cols-1 gap-2">
                {STYLE_OPTIONS.map((style) => (
                  <Button
                    key={style.value}
                    variant={selectedStyle === style.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStyle(style.value)}
                    className="justify-start"
                  >
                    <span className="mr-2">{style.icon}</span>
                    {style.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* 감정 선택 */}
            <div>
              <Label className="mb-3 block">감정/분위기</Label>
              <div className="grid grid-cols-2 gap-2">
                {EMOTION_OPTIONS.map((emotion) => (
                  <Button
                    key={emotion.value}
                    variant={selectedEmotion === emotion.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEmotion(emotion.value)}
                    className="justify-start text-xs"
                  >
                    <span className="mr-1">{emotion.icon}</span>
                    {emotion.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="flex-1 px-4 pb-4">
          <div className="space-y-4">
            {PROMPT_TEMPLATES.map((category) => (
              <div key={category.category}>
                <Label className="mb-2 block">{category.category}</Label>
                <div className="space-y-1">
                  {category.prompts.map((template, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-left h-auto py-2 px-3 text-xs"
                      onClick={() => applyTemplate(template)}
                    >
                      {template}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}