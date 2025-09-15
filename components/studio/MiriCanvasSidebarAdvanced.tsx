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
  Plus
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

interface MiriCanvasSidebarAdvancedProps {
  onAddText?: (text: string) => void;
  onAddBubble?: (text: string) => void;
}

export function MiriCanvasSidebarAdvanced({ onAddText, onAddBubble }: MiriCanvasSidebarAdvancedProps) {
  const [activeTab, setActiveTab] = useState<MenuTab>('bubble');

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
    <div className="w-72 bg-white border-r flex">
      {/* 메뉴 탭 */}
      <div className="w-16 bg-gray-50 border-r">
        <div className="py-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full px-2 py-3 flex flex-col items-center gap-1 transition-colors hover:bg-gray-100",
                  activeTab === item.id && "bg-white border-l-2 border-blue-500"
                )}
                title={item.description}
              >
                <Icon className={cn(
                  "h-5 w-5",
                  activeTab === item.id ? "text-blue-600" : "text-gray-600"
                )} />
                <span className={cn(
                  "text-[10px] text-center",
                  activeTab === item.id ? "text-blue-600 font-medium" : "text-gray-600"
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
        <div className="p-3 border-b">
          <h3 className="font-semibold text-sm">
            {menuItems.find(item => item.id === activeTab)?.label}
          </h3>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3">
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
    { id: 'speech', label: '일반', preview: '💬', style: 'rounded' },
    { id: 'thought', label: '생각', preview: '💭', style: 'cloud' },
    { id: 'shout', label: '외침', preview: '💥', style: 'star' },
    { id: 'whisper', label: '속삭임', preview: '🔉', style: 'dashed' },
  ];

  const handleAddBubble = (type: string) => {
    if (onAddBubble) {
      onAddBubble(bubbleText || '대사를 입력하세요');
      setBubbleText('');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">
          대사 입력
        </label>
        <Textarea 
          value={bubbleText}
          onChange={(e) => setBubbleText(e.target.value)}
          placeholder="말풍선에 들어갈 대사를 입력하세요"
          className="min-h-[80px] text-sm"
        />
      </div>

      <div>
        <p className="text-xs font-medium text-gray-700 mb-2">말풍선 스타일</p>
        <div className="grid grid-cols-2 gap-2">
          {bubbleTypes.map(type => (
            <button
              key={type.id}
              onClick={() => handleAddBubble(type.id)}
              className="p-3 border rounded-lg hover:bg-gray-50 hover:border-blue-400 transition-colors flex flex-col items-center gap-1"
            >
              <span className="text-2xl">{type.preview}</span>
              <span className="text-xs">{type.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Button 
        className="w-full" 
        size="sm"
        onClick={() => handleAddBubble('speech')}
      >
        <Plus className="h-4 w-4 mr-2" />
        말풍선 추가
      </Button>

      <div className="pt-2">
        <p className="text-xs text-gray-500 mb-2">빠른 대사</p>
        <div className="flex flex-wrap gap-1">
          {['안녕?', '뭐야!', '정말?', '좋아!', '싫어', '...'].map(text => (
            <button
              key={text}
              onClick={() => {
                setBubbleText(text);
                handleAddBubble('speech');
              }}
              className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
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
  
  const fontStyles = [
    { id: 'title', label: '제목', size: 24, weight: 'bold' },
    { id: 'subtitle', label: '부제목', size: 18, weight: 'semibold' },
    { id: 'body', label: '본문', size: 14, weight: 'normal' },
    { id: 'caption', label: '캡션', size: 12, weight: 'light' }
  ];

  const handleAddText = (style: any) => {
    if (onAddText) {
      onAddText(text || '텍스트를 입력하세요');
      setText('');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">
          텍스트 입력
        </label>
        <Textarea 
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="텍스트를 입력하세요"
          className="min-h-[80px] text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">
          폰트
        </label>
        <select className="w-full border rounded-md px-3 py-2 text-sm">
          <option>Noto Sans KR</option>
          <option>나눔고딕</option>
          <option>나눔명조</option>
          <option>배민 주아체</option>
        </select>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-700 mb-2">텍스트 스타일</p>
        <div className="space-y-2">
          {fontStyles.map(style => (
            <button
              key={style.id}
              onClick={() => handleAddText(style)}
              className="w-full p-2 border rounded-lg hover:bg-gray-50 hover:border-blue-400 transition-colors text-left"
            >
              <span 
                className="block"
                style={{ 
                  fontSize: style.size + 'px',
                  fontWeight: style.weight as any
                }}
              >
                {style.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1">
          <span className="font-bold">B</span>
        </Button>
        <Button variant="outline" size="sm" className="flex-1">
          <span className="italic">I</span>
        </Button>
        <Button variant="outline" size="sm" className="flex-1">
          <span className="underline">U</span>
        </Button>
      </div>

      <Button 
        className="w-full" 
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
  
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">
          캐릭터 이름
        </label>
        <Input 
          value={characterName}
          onChange={(e) => setCharacterName(e.target.value)}
          placeholder="예: 김철수" 
          className="text-sm" 
        />
      </div>

      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">
          캐릭터 설명
        </label>
        <Textarea 
          value={characterDesc}
          onChange={(e) => setCharacterDesc(e.target.value)}
          placeholder="캐릭터의 외모와 특징을 설명해주세요"
          className="min-h-[100px] text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">
          레퍼런스 이미지
        </label>
        <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer">
          <Image className="h-8 w-8 mx-auto text-gray-400 mb-2" />
          <p className="text-xs text-gray-500">클릭하여 업로드</p>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG (최대 10MB)</p>
        </div>
      </div>

      <Button className="w-full" size="sm">
        <Sparkles className="h-4 w-4 mr-2" />
        캐릭터 생성
      </Button>

      <div className="pt-2">
        <p className="text-xs text-gray-500 mb-2">저장된 캐릭터</p>
        <div className="space-y-2">
          {['주인공', '친구', '선생님'].map(name => (
            <div key={name} className="flex items-center gap-2 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full" />
              <div className="flex-1">
                <span className="text-sm font-medium">{name}</span>
                <p className="text-xs text-gray-500">캐릭터 설명...</p>
              </div>
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
  
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">
          장르
        </label>
        <select 
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm"
        >
          <option value="romance">로맨스</option>
          <option value="action">액션</option>
          <option value="comedy">코미디</option>
          <option value="daily">일상</option>
          <option value="fantasy">판타지</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">
          줄거리
        </label>
        <Textarea 
          value={plot}
          onChange={(e) => setPlot(e.target.value)}
          placeholder="간단한 줄거리를 입력하세요"
          className="min-h-[120px] text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">
          컷 수
        </label>
        <select 
          value={cutCount}
          onChange={(e) => setCutCount(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm"
        >
          <option value="4">4컷</option>
          <option value="6">6컷</option>
          <option value="8">8컷</option>
          <option value="10">10컷</option>
        </select>
      </div>

      <Button className="w-full" size="sm">
        <FileText className="h-4 w-4 mr-2" />
        대본 생성
      </Button>

      <div className="pt-2">
        <p className="text-xs text-gray-500 mb-2">생성된 대본</p>
        <div className="p-3 bg-gray-50 rounded-lg max-h-60 overflow-y-auto">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-700">1컷</p>
              <p className="text-xs text-gray-600 mt-1">
                여기에 생성된 대본이 표시됩니다...
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-700">2컷</p>
              <p className="text-xs text-gray-600 mt-1">
                각 컷별 대본이 순서대로 표시됩니다...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}