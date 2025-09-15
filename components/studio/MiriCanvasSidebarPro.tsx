"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  MessageSquare, 
  Type, 
  UserPlus,
  FileText,
  Image,
  Sparkles,
  Plus,
  Palette,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type MenuTab = 'bubble' | 'text' | 'ai-character' | 'ai-script';

interface MenuItem {
  id: MenuTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const menuItems: MenuItem[] = [
  {
    id: 'bubble',
    label: '말풍선',
    icon: MessageSquare,
    description: '다양한 말풍선 추가'
  },
  {
    id: 'text',
    label: '텍스트',
    icon: Type,
    description: '텍스트 삽입'
  },
  {
    id: 'ai-character',
    label: 'AI 캐릭터',
    icon: UserPlus,
    description: '일관된 캐릭터 생성'
  },
  {
    id: 'ai-script',
    label: 'AI 대본',
    icon: FileText,
    description: 'AI로 스토리 작성'
  }
];

interface MiriCanvasSidebarProProps {
  onAddText?: (text: string) => void;
  onAddBubble?: (text: string) => void;
}

export function MiriCanvasSidebarPro({ onAddText, onAddBubble }: MiriCanvasSidebarProProps) {
  const [activeTab, setActiveTab] = useState<MenuTab>('bubble');
  const [searchQuery, setSearchQuery] = useState('');

  const renderContent = () => {
    switch (activeTab) {
      case 'bubble':
        return <BubblePanel onAddBubble={onAddBubble} />;
      case 'text':
        return <TextPanel onAddText={onAddText} />;
      case 'ai-character':
        return <AICharacterPanel />;
      case 'ai-script':
        return <AIScriptPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="w-80 bg-white border-r border-slate-200 flex">
      {/* 메뉴 탭 */}
      <div className="w-20 bg-slate-50 border-r border-slate-200">
        <div className="py-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full px-3 py-4 flex flex-col items-center gap-2 transition-all hover:bg-white",
                  activeTab === item.id && "bg-white border-r-2 border-purple-500 text-purple-600"
                )}
                title={item.description}
              >
                <Icon className={cn(
                  "h-6 w-6",
                  activeTab === item.id ? "text-purple-600" : "text-slate-500"
                )} />
                <span className={cn(
                  "text-xs font-medium text-center leading-tight",
                  activeTab === item.id ? "text-purple-600" : "text-slate-500"
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 컨텐츠 패널 */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-3">
            {menuItems.find(item => item.id === activeTab)?.label}
          </h3>
          {/* 검색 바 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="검색..."
              className="pl-9 h-9 text-sm border-slate-200"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4">
            {renderContent()}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// 말풍선 패널
function BubblePanel({ onAddBubble }: { onAddBubble?: (text: string) => void }) {
  const [bubbleText, setBubbleText] = useState('');
  
  const bubbleTypes = [
    { id: 'speech', label: '일반 말풍선', preview: '💬', color: 'from-blue-500 to-blue-600' },
    { id: 'thought', label: '생각 말풍선', preview: '💭', color: 'from-purple-500 to-purple-600' },
    { id: 'shout', label: '외침 말풍선', preview: '💥', color: 'from-red-500 to-red-600' },
    { id: 'whisper', label: '속삭임', preview: '🔉', color: 'from-green-500 to-green-600' },
  ];

  const handleAddBubble = (type: string) => {
    if (onAddBubble) {
      onAddBubble(bubbleText || '대사를 입력하세요');
      setBubbleText('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">
          대사 입력
        </label>
        <Textarea 
          value={bubbleText}
          onChange={(e) => setBubbleText(e.target.value)}
          placeholder="말풍선에 들어갈 대사를 입력하세요..."
          className="min-h-[80px] text-sm resize-none border-slate-200"
        />
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700 mb-3">말풍선 스타일</p>
        <div className="grid grid-cols-1 gap-3">
          {bubbleTypes.map(type => (
            <button
              key={type.id}
              onClick={() => handleAddBubble(type.id)}
              className="p-4 border border-slate-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 
                       transition-all group flex items-center gap-3"
            >
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${type.color} 
                            flex items-center justify-center text-lg`}>
                {type.preview}
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-slate-900">{type.label}</p>
                <p className="text-xs text-slate-500">클릭하여 추가</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Button 
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" 
        size="sm"
        onClick={() => handleAddBubble('speech')}
      >
        <Plus className="h-4 w-4 mr-2" />
        말풍선 추가
      </Button>

      <div className="pt-2">
        <p className="text-sm font-medium text-slate-700 mb-2">빠른 대사</p>
        <div className="flex flex-wrap gap-2">
          {['안녕?', '뭐야!', '정말?', '좋아!', '싫어', '어?', '와!', '헉!'].map(text => (
            <button
              key={text}
              onClick={() => {
                setBubbleText(text);
                handleAddBubble('speech');
              }}
              className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-full 
                       hover:bg-purple-100 hover:text-purple-700 transition-colors"
            >
              {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// 텍스트 패널
function TextPanel({ onAddText }: { onAddText?: (text: string) => void }) {
  const [text, setText] = useState('');
  
  const textStyles = [
    { id: 'title', label: '큰 제목', preview: 'Aa', size: 'text-2xl', weight: 'font-bold', color: 'from-slate-700 to-slate-900' },
    { id: 'subtitle', label: '소제목', preview: 'Aa', size: 'text-lg', weight: 'font-semibold', color: 'from-slate-600 to-slate-800' },
    { id: 'body', label: '본문', preview: 'Aa', size: 'text-base', weight: 'font-normal', color: 'from-slate-500 to-slate-700' },
    { id: 'caption', label: '캡션', preview: 'Aa', size: 'text-sm', weight: 'font-light', color: 'from-slate-400 to-slate-600' }
  ];

  const handleAddText = (style: any) => {
    if (onAddText) {
      onAddText(text || '텍스트를 입력하세요');
      setText('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">
          텍스트 입력
        </label>
        <Textarea 
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="추가할 텍스트를 입력하세요..."
          className="min-h-[80px] text-sm resize-none border-slate-200"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">
          폰트 선택
        </label>
        <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
          <option>Noto Sans KR (기본)</option>
          <option>나눔고딕</option>
          <option>나눔명조</option>
          <option>배민 주아체</option>
          <option>카페24 써라운드</option>
        </select>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700 mb-3">텍스트 스타일</p>
        <div className="space-y-2">
          {textStyles.map(style => (
            <button
              key={style.id}
              onClick={() => handleAddText(style)}
              className="w-full p-3 border border-slate-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 
                       transition-all text-left group flex items-center justify-between"
            >
              <div>
                <p className={`${style.size} ${style.weight} bg-gradient-to-r ${style.color} bg-clip-text text-transparent`}>
                  {style.label}
                </p>
                <p className="text-xs text-slate-500 mt-1">클릭하여 추가</p>
              </div>
              <div className={`text-2xl font-bold bg-gradient-to-r ${style.color} bg-clip-text text-transparent`}>
                {style.preview}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 border-slate-200">
          <span className="font-bold">B</span>
        </Button>
        <Button variant="outline" size="sm" className="flex-1 border-slate-200">
          <span className="italic">I</span>
        </Button>
        <Button variant="outline" size="sm" className="flex-1 border-slate-200">
          <span className="underline">U</span>
        </Button>
        <Button variant="outline" size="sm" className="flex-1 border-slate-200">
          <Palette className="h-4 w-4" />
        </Button>
      </div>

      <Button 
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" 
        size="sm"
        onClick={() => handleAddText({ size: 16, weight: 'normal' })}
      >
        <Type className="h-4 w-4 mr-2" />
        텍스트 추가
      </Button>
    </div>
  );
}

// AI 캐릭터 생성 패널
function AICharacterPanel() {
  const [characterName, setCharacterName] = useState('');
  const [characterDesc, setCharacterDesc] = useState('');
  
  const savedCharacters = [
    { name: '주인공', desc: '활발하고 긍정적인 성격', color: 'from-blue-400 to-purple-500' },
    { name: '친구', desc: '재미있고 유머러스한 캐릭터', color: 'from-green-400 to-blue-500' },
    { name: '선생님', desc: '엄격하지만 따뜻한 마음', color: 'from-orange-400 to-red-500' }
  ];
  
  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">
          캐릭터 이름
        </label>
        <Input 
          value={characterName}
          onChange={(e) => setCharacterName(e.target.value)}
          placeholder="예: 김철수" 
          className="text-sm border-slate-200" 
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">
          캐릭터 설명
        </label>
        <Textarea 
          value={characterDesc}
          onChange={(e) => setCharacterDesc(e.target.value)}
          placeholder="캐릭터의 외모, 성격, 특징을 자세히 설명해주세요..."
          className="min-h-[100px] text-sm resize-none border-slate-200"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">
          레퍼런스 이미지
        </label>
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center 
                      hover:border-purple-400 hover:bg-purple-50 transition-all cursor-pointer">
          <Image className="h-12 w-12 mx-auto text-slate-400 mb-3" />
          <p className="text-sm font-medium text-slate-600 mb-1">클릭하여 업로드</p>
          <p className="text-xs text-slate-400">JPG, PNG (최대 10MB)</p>
        </div>
      </div>

      <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" size="sm">
        <Sparkles className="h-4 w-4 mr-2" />
        캐릭터 생성
      </Button>

      <div className="pt-2">
        <p className="text-sm font-medium text-slate-700 mb-3">저장된 캐릭터</p>
        <div className="space-y-3">
          {savedCharacters.map((character, index) => (
            <div key={index} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg 
                                      hover:border-purple-300 hover:bg-purple-50 cursor-pointer transition-all">
              <div className={`w-12 h-12 bg-gradient-to-br ${character.color} rounded-lg flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{character.name}</p>
                <p className="text-xs text-slate-500 truncate">{character.desc}</p>
              </div>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// AI 대본 작성 패널
function AIScriptPanel() {
  const [genre, setGenre] = useState('romance');
  const [plot, setPlot] = useState('');
  const [cutCount, setCutCount] = useState('4');
  
  const genres = [
    { value: 'romance', label: '로맨스', color: 'from-pink-500 to-red-500' },
    { value: 'action', label: '액션', color: 'from-orange-500 to-red-500' },
    { value: 'comedy', label: '코미디', color: 'from-yellow-500 to-orange-500' },
    { value: 'daily', label: '일상', color: 'from-green-500 to-blue-500' },
    { value: 'fantasy', label: '판타지', color: 'from-purple-500 to-pink-500' }
  ];
  
  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">
          장르 선택
        </label>
        <div className="grid grid-cols-2 gap-2">
          {genres.map(g => (
            <button
              key={g.value}
              onClick={() => setGenre(g.value)}
              className={cn(
                "p-3 rounded-lg border-2 transition-all text-sm font-medium",
                genre === g.value 
                  ? "border-purple-300 bg-purple-50 text-purple-700"
                  : "border-slate-200 hover:border-slate-300"
              )}
            >
              <div className={`w-6 h-6 bg-gradient-to-r ${g.color} rounded mx-auto mb-1`} />
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">
          줄거리
        </label>
        <Textarea 
          value={plot}
          onChange={(e) => setPlot(e.target.value)}
          placeholder="어떤 이야기를 만들고 싶나요? 간단한 줄거리를 입력해주세요..."
          className="min-h-[120px] text-sm resize-none border-slate-200"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">
          컷 수
        </label>
        <select 
          value={cutCount}
          onChange={(e) => setCutCount(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="4">4컷 (짧은 에피소드)</option>
          <option value="6">6컷 (중간 길이)</option>
          <option value="8">8컷 (긴 에피소드)</option>
          <option value="10">10컷 (상세한 스토리)</option>
        </select>
      </div>

      <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" size="sm">
        <FileText className="h-4 w-4 mr-2" />
        대본 생성
      </Button>

      <div className="pt-2">
        <p className="text-sm font-medium text-slate-700 mb-3">생성된 대본</p>
        <div className="p-4 bg-slate-50 rounded-lg max-h-60 overflow-y-auto">
          <div className="space-y-4">
            <div className="p-3 bg-white rounded border-l-4 border-purple-500">
              <p className="text-xs font-semibold text-purple-600 mb-1">1컷</p>
              <p className="text-sm text-slate-700">
                여기에 AI가 생성한 대본이 표시됩니다...
              </p>
            </div>
            <div className="p-3 bg-white rounded border-l-4 border-purple-500">
              <p className="text-xs font-semibold text-purple-600 mb-1">2컷</p>
              <p className="text-sm text-slate-700">
                각 컷별 대본과 장면 설명이 순서대로 나타납니다...
              </p>
            </div>
            <div className="p-3 bg-white rounded border-l-4 border-slate-300">
              <p className="text-xs text-slate-400 mb-1">3컷 ~ {cutCount}컷</p>
              <p className="text-sm text-slate-400">
                대본 생성 버튼을 클릭하면 완성됩니다
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}