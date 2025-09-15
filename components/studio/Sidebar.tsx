"use client";

import { useState, useEffect } from "react";
import { useStudioStore } from "@/lib/stores/studio-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Plus,
  History,
  FolderOpen,
  Star,
  StarOff,
  Clock,
  Image as ImageIcon,
  Wand2,
  Upload,
  ChevronDown,
} from "lucide-react";
import { CharacterCreator } from "./CharacterCreator";

export function Sidebar() {
  const {
    characters,
    activeCharacters,
    projects,
    currentProject,
    loadCharacters,
    toggleCharacter,
    createProject,
    loadProject,
  } = useStudioStore();

  const [isAddCharacterOpen, setIsAddCharacterOpen] = useState(false);
  const [isCharacterCreatorOpen, setIsCharacterCreatorOpen] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState("");
  const [newCharacterDescription, setNewCharacterDescription] = useState("");

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  const handleAddCharacter = async () => {
    if (!newCharacterName.trim()) return;

    try {
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCharacterName.trim(),
          description: newCharacterDescription.trim(),
        }),
      });

      if (response.ok) {
        setNewCharacterName("");
        setNewCharacterDescription("");
        setIsAddCharacterOpen(false);
        await loadCharacters(); // 캐릭터 목록 새로고침
      }
    } catch (error) {
      console.error('Failed to add character:', error);
    }
  };

  const handleCharacterCreated = (character: any) => {
    loadCharacters(); // 캐릭터 목록 새로고침
  };

  return (
    <div className="h-full bg-gray-50 border-r flex flex-col">
      <div className="p-4 border-b bg-white">
        <h2 className="font-semibold text-sm text-gray-900">워크스페이스</h2>
        {currentProject && (
          <p className="text-xs text-muted-foreground mt-1">
            {currentProject.name}
          </p>
        )}
      </div>

      <Tabs defaultValue="characters" className="flex-1">
        <TabsList className="grid w-full grid-cols-3 m-2">
          <TabsTrigger value="characters" className="text-xs">
            <Users className="h-4 w-4 mr-1" />
            캐릭터
          </TabsTrigger>
          <TabsTrigger value="projects" className="text-xs">
            <FolderOpen className="h-4 w-4 mr-1" />
            프로젝트
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs">
            <History className="h-4 w-4 mr-1" />
            히스토리
          </TabsTrigger>
        </TabsList>

        <TabsContent value="characters" className="flex-1 m-2">
          <ScrollArea className="h-full">
            <div className="space-y-3">
              {/* 캐릭터 추가 버튼 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    캐릭터 추가
                    <ChevronDown className="h-4 w-4 ml-auto" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuItem onClick={() => setIsCharacterCreatorOpen(true)}>
                    <Wand2 className="h-4 w-4 mr-2" />
                    AI로 캐릭터 생성
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsAddCharacterOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    직접 입력으로 추가
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* AI 캐릭터 생성기 */}
              <CharacterCreator
                open={isCharacterCreatorOpen}
                onOpenChange={setIsCharacterCreatorOpen}
                onCharacterCreated={handleCharacterCreated}
              />

              {/* 기존 직접 입력 다이얼로그 */}
              <Dialog open={isAddCharacterOpen} onOpenChange={setIsAddCharacterOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>직접 입력으로 캐릭터 추가</DialogTitle>
                    <DialogDescription>
                      이미 캐릭터 설정이 있다면 직접 입력하세요
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="char-name">캐릭터 이름</Label>
                      <Input
                        id="char-name"
                        value={newCharacterName}
                        onChange={(e) => setNewCharacterName(e.target.value)}
                        placeholder="예: 은진"
                      />
                    </div>
                    <div>
                      <Label htmlFor="char-desc">설명</Label>
                      <Input
                        id="char-desc"
                        value={newCharacterDescription}
                        onChange={(e) => setNewCharacterDescription(e.target.value)}
                        placeholder="예: 20살 여성, 검은 단발머리, 큰 갈색 눈"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleAddCharacter}
                        disabled={!newCharacterName.trim()}
                        className="flex-1"
                      >
                        추가
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setIsAddCharacterOpen(false)}
                        className="flex-1"
                      >
                        취소
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* 활성 캐릭터 표시 */}
              {activeCharacters.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">활성 캐릭터</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {characters
                        .filter(c => c.isActive)
                        .map(char => (
                          <div 
                            key={char.id}
                            className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-md"
                          >
                            <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center">
                              <Users className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-blue-900 truncate">
                                {char.name}
                              </p>
                              {char.lastUsed && (
                                <p className="text-xs text-blue-600">
                                  최근 사용: {new Date(char.lastUsed).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleCharacter(char.id)}
                              className="p-1 h-auto"
                            >
                              <Star className="h-4 w-4 text-blue-600 fill-current" />
                            </Button>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 모든 캐릭터 목록 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">등록된 캐릭터</CardTitle>
                  <CardDescription className="text-xs">
                    클릭하여 활성화/비활성화
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {characters.length === 0 ? (
                    <div className="text-center py-6">
                      <Users className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">
                        등록된 캐릭터가 없습니다
                      </p>
                      <p className="text-xs text-gray-400">
                        캐릭터를 추가해보세요
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {characters.map(char => (
                        <div
                          key={char.id}
                          className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                            char.isActive 
                              ? "bg-blue-50 border-blue-200" 
                              : "hover:bg-gray-50 border-gray-200"
                          }`}
                          onClick={() => toggleCharacter(char.id)}
                        >
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden border">
                            {char.imageUrl ? (
                              <img 
                                src={char.imageUrl} 
                                alt={char.name}
                                className="w-full h-full rounded-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  target.parentElement!.innerHTML = '<div class="h-4 w-4 text-gray-500"><Users /></div>';
                                }}
                              />
                            ) : (
                              <Users className="h-4 w-4 text-gray-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {char.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {char.description}
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            {char.isActive ? (
                              <Star className="h-4 w-4 text-blue-500 fill-current" />
                            ) : (
                              <StarOff className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="projects" className="flex-1 m-2">
          <ScrollArea className="h-full">
            <div className="space-y-3">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => createProject("새 프로젝트")}
              >
                <Plus className="h-4 w-4 mr-2" />
                새 프로젝트
              </Button>

              {projects.length === 0 ? (
                <div className="text-center py-6">
                  <FolderOpen className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">프로젝트가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {projects.map(project => (
                    <Card 
                      key={project.id}
                      className={`cursor-pointer transition-colors ${
                        currentProject?.id === project.id 
                          ? "border-blue-500 bg-blue-50" 
                          : "hover:bg-gray-50"
                      }`}
                      onClick={() => loadProject(project.id)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{project.name}</CardTitle>
                        {project.description && (
                          <CardDescription className="text-xs">
                            {project.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" />
                            {project.panels.length}패널
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(project.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="history" className="flex-1 m-2">
          <ScrollArea className="h-full">
            <div className="space-y-2">
              <p className="text-sm text-gray-500 text-center py-6">
                생성 히스토리가 여기에 표시됩니다
              </p>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}