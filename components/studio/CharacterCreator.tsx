"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Palette,
  User,
  Sparkles,
  RefreshCw,
  Save,
  Download,
  Eye,
  Wand2,
} from "lucide-react";

interface CharacterCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCharacterCreated: (character: any) => void;
}

interface CharacterConfig {
  name: string;
  age: string;
  gender: string;
  hairStyle: string;
  hairColor: string;
  eyeColor: string;
  skinTone: string;
  bodyType: string;
  height: string;
  personality: string;
  outfit: string;
  accessories: string[];
  artStyle: string;
  customDescription: string;
}

export function CharacterCreator({ open, onOpenChange, onCharacterCreated }: CharacterCreatorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const [config, setConfig] = useState<CharacterConfig>({
    name: "",
    age: "20대",
    gender: "female",
    hairStyle: "단발",
    hairColor: "검은색",
    eyeColor: "갈색",
    skinTone: "보통",
    bodyType: "보통",
    height: "보통",
    personality: "밝고 활발한",
    outfit: "캐주얼",
    accessories: [],
    artStyle: "웹툰 스타일",
    customDescription: "",
  });

  // 웹툰 스타일에 최적화된 옵션들
  const hairStyles = [
    "단발", "긴 생머리", "웨이브", "포니테일", "트윈테일", "보브컷",
    "짧은 단발", "앞머리", "사이드 파팅", "가르마"
  ];

  const hairColors = [
    "검은색", "갈색", "밤색", "금색", "은색", "빨간색", "파란색", 
    "보라색", "분홍색", "흰색", "회색"
  ];

  const eyeColors = [
    "갈색", "검은색", "파란색", "초록색", "회색", "보라색", 
    "빨간색", "금색", "청록색"
  ];

  const personalities = [
    "밝고 활발한", "내성적이고 조용한", "차갑고 시크한", "온화하고 상냥한",
    "장난기 많은", "진지하고 성실한", "자신감 있는", "수줍어하는",
    "도도한", "귀여운", "카리스마 있는", "신비로운"
  ];

  const outfits = [
    "교복", "캐주얼", "정장", "원피스", "후드티", "블라우스",
    "티셔츠", "스웨터", "코트", "한복", "운동복", "파티 드레스"
  ];

  const accessories = [
    "안경", "선글라스", "모자", "목걸이", "귀걸이", "팔찌",
    "반지", "헤어핀", "머리띠", "스카프", "가방"
  ];

  const artStyles = [
    "웹툰 스타일", "애니메이션 스타일", "리얼리스틱", "치비 스타일",
    "로맨스 웹툰", "액션 웹툰", "일상 웹툰", "판타지 웹툰"
  ];

  const handleAccessoryToggle = (accessory: string) => {
    setConfig(prev => ({
      ...prev,
      accessories: prev.accessories.includes(accessory)
        ? prev.accessories.filter(a => a !== accessory)
        : [...prev.accessories, accessory]
    }));
  };

  const generatePrompt = (): string => {
    const parts = [
      `${config.artStyle} character design`,
      `${config.age} ${config.gender === 'female' ? '여성' : '남성'}`,
      `${config.hairColor} ${config.hairStyle} 머리`,
      `${config.eyeColor} 눈`,
      `${config.skinTone} 피부톤`,
      `${config.bodyType} 체형`,
      `${config.height} 키`,
      `${config.personality} 성격`,
      `${config.outfit} 착용`,
    ];

    if (config.accessories.length > 0) {
      parts.push(`액세서리: ${config.accessories.join(', ')}`);
    }

    if (config.customDescription.trim()) {
      parts.push(config.customDescription);
    }

    // 웹툰 최적화 프롬프트 추가
    parts.push("high quality", "clean lines", "webtoon art style", "korean webtoon", "full body");

    return parts.join(', ');
  };

  const handleGeneratePreview = async () => {
    setIsGenerating(true);
    try {
      const prompt = generatePrompt();
      
      // 캐릭터 전용 생성 API 호출 (1:1 비율, 배경 없음 강제)
      const response = await fetch('/api/ai/character/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          style: 'character_reference'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.imageUrl) {
          setPreviewImage(data.imageUrl);
          console.log('✅ 캐릭터 생성 성공:', data.message);
        } else {
          console.error('캐릭터 생성 실패:', data.error);
          alert(data.error || '캐릭터 생성에 실패했습니다');
        }
      } else {
        const errorData = await response.json();
        console.error('캐릭터 생성 API 오류:', errorData);
        alert(errorData.error || '캐릭터 생성 요청에 실패했습니다');
      }
    } catch (error) {
      console.error('캐릭터 생성 오류:', error);
      alert('캐릭터 생성 중 네트워크 오류가 발생했습니다');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveCharacter = async () => {
    if (!config.name.trim()) {
      alert('캐릭터 이름을 입력해주세요.');
      return;
    }

    try {
      const characterData = {
        name: config.name,
        description: generatePrompt(),
        config: config,
        imageUrl: previewImage,
      };

      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(characterData),
      });

      if (response.ok) {
        const newCharacter = await response.json();
        onCharacterCreated(newCharacter);
        onOpenChange(false);
        
        // 상태 초기화
        setConfig({
          name: "",
          age: "20대",
          gender: "female",
          hairStyle: "단발",
          hairColor: "검은색",
          eyeColor: "갈색",
          skinTone: "보통",
          bodyType: "보통",
          height: "보통",
          personality: "밝고 활발한",
          outfit: "캐주얼",
          accessories: [],
          artStyle: "웹툰 스타일",
          customDescription: "",
        });
        setPreviewImage(null);
      }
    } catch (error) {
      console.error('Error saving character:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-purple-600" />
            AI 캐릭터 생성기
          </DialogTitle>
          <DialogDescription>
            웹툰에 맞는 캐릭터를 직접 생성해보세요. 각 옵션을 선택하면 AI가 자동으로 캐릭터를 만들어줍니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 설정 패널 */}
          <div className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">기본 정보</TabsTrigger>
                <TabsTrigger value="appearance">외모</TabsTrigger>
                <TabsTrigger value="style">스타일</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">캐릭터 기본 정보</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="name">캐릭터 이름 *</Label>
                      <Input
                        id="name"
                        value={config.name}
                        onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="예: 은지, 민호, 소연"
                      />
                    </div>

                    <div>
                      <Label htmlFor="age">나이대</Label>
                      <Select value={config.age} onValueChange={(value) => setConfig(prev => ({ ...prev, age: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10대">10대</SelectItem>
                          <SelectItem value="20대">20대</SelectItem>
                          <SelectItem value="30대">30대</SelectItem>
                          <SelectItem value="40대">40대</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="gender">성별</Label>
                      <Select value={config.gender} onValueChange={(value) => setConfig(prev => ({ ...prev, gender: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="female">여성</SelectItem>
                          <SelectItem value="male">남성</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="personality">성격</Label>
                      <Select value={config.personality} onValueChange={(value) => setConfig(prev => ({ ...prev, personality: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {personalities.map((personality) => (
                            <SelectItem key={personality} value={personality}>
                              {personality}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="appearance" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">외모 설정</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>헤어스타일</Label>
                        <Select value={config.hairStyle} onValueChange={(value) => setConfig(prev => ({ ...prev, hairStyle: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {hairStyles.map((style) => (
                              <SelectItem key={style} value={style}>
                                {style}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>머리 색상</Label>
                        <Select value={config.hairColor} onValueChange={(value) => setConfig(prev => ({ ...prev, hairColor: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {hairColors.map((color) => (
                              <SelectItem key={color} value={color}>
                                {color}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>눈 색상</Label>
                        <Select value={config.eyeColor} onValueChange={(value) => setConfig(prev => ({ ...prev, eyeColor: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {eyeColors.map((color) => (
                              <SelectItem key={color} value={color}>
                                {color}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>피부톤</Label>
                        <Select value={config.skinTone} onValueChange={(value) => setConfig(prev => ({ ...prev, skinTone: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="밝은">밝은</SelectItem>
                            <SelectItem value="보통">보통</SelectItem>
                            <SelectItem value="어두운">어두운</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label>체형</Label>
                      <Select value={config.bodyType} onValueChange={(value) => setConfig(prev => ({ ...prev, bodyType: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="마른">마른</SelectItem>
                          <SelectItem value="보통">보통</SelectItem>
                          <SelectItem value="통통한">통통한</SelectItem>
                          <SelectItem value="근육질">근육질</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="style" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">스타일 & 의상</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>의상 스타일</Label>
                      <Select value={config.outfit} onValueChange={(value) => setConfig(prev => ({ ...prev, outfit: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {outfits.map((outfit) => (
                            <SelectItem key={outfit} value={outfit}>
                              {outfit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>아트 스타일</Label>
                      <Select value={config.artStyle} onValueChange={(value) => setConfig(prev => ({ ...prev, artStyle: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {artStyles.map((style) => (
                            <SelectItem key={style} value={style}>
                              {style}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>액세서리</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {accessories.map((accessory) => (
                          <Badge
                            key={accessory}
                            variant={config.accessories.includes(accessory) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => handleAccessoryToggle(accessory)}
                          >
                            {accessory}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="custom">추가 설명</Label>
                      <Textarea
                        id="custom"
                        value={config.customDescription}
                        onChange={(e) => setConfig(prev => ({ ...prev, customDescription: e.target.value }))}
                        placeholder="특별한 특징이나 추가하고 싶은 설명을 입력하세요..."
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* 미리보기 패널 */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  캐릭터 미리보기
                </CardTitle>
                <CardDescription>
                  생성 버튼을 눌러 캐릭터를 확인하세요
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-[3/4] bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center mb-4">
                  {previewImage ? (
                    <img 
                      src={previewImage} 
                      alt="Generated character" 
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="text-center">
                      <User className="h-16 w-16 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">
                        미리보기 생성을 클릭하세요
                      </p>
                    </div>
                  )}
                </div>

                <Button 
                  onClick={handleGeneratePreview}
                  disabled={isGenerating}
                  className="w-full mb-2"
                  variant="outline"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      미리보기 생성
                    </>
                  )}
                </Button>

                <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                  <strong>생성될 프롬프트:</strong>
                  <p className="mt-1">{generatePrompt()}</p>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button 
                onClick={handleSaveCharacter}
                disabled={!config.name.trim() || isGenerating}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                캐릭터 저장
              </Button>
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                취소
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}