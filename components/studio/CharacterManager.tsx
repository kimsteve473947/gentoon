"use client";

import { useState, useCallback } from "react";
import { Upload, X, Star, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Character } from "@/types";
import { formatFileSize, formatRelativeTime } from "@/lib/utils";

interface CharacterManagerProps {
  characters: Character[];
  maxCharacters: number;
  onCharacterAdd: (character: Omit<Character, "id" | "userId" | "createdAt" | "updatedAt">) => void;
  onCharacterRemove: (id: string) => void;
  onCharacterToggleFavorite: (id: string) => void;
}

export function CharacterManager({
  characters,
  maxCharacters,
  onCharacterAdd,
  onCharacterRemove,
  onCharacterToggleFavorite,
}: CharacterManagerProps) {
  const [isAddingCharacter, setIsAddingCharacter] = useState(false);
  const [newCharacter, setNewCharacter] = useState({
    name: "",
    description: "",
    styleGuide: "",
    referenceImages: [] as string[],
  });
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // 파일 업로드 처리
  const handleFileUpload = useCallback((files: FileList | null) => {
    if (!files) return;

    const validFiles = Array.from(files).filter(file => {
      const isImage = file.type.startsWith("image/");
      const isUnder5MB = file.size <= 5 * 1024 * 1024;
      return isImage && isUnder5MB;
    });

    if (validFiles.length + uploadedFiles.length > 5) {
      alert("최대 5개의 이미지만 업로드할 수 있습니다");
      return;
    }

    setUploadedFiles(prev => [...prev, ...validFiles]);
    
    // 파일을 base64로 변환 (실제로는 서버에 업로드)
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewCharacter(prev => ({
          ...prev,
          referenceImages: [...prev.referenceImages, reader.result as string],
        }));
      };
      reader.readAsDataURL(file);
    });
  }, [uploadedFiles.length]);

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  // 캐릭터 추가
  const handleAddCharacter = () => {
    if (!newCharacter.name || !newCharacter.description) {
      alert("캐릭터 이름과 설명은 필수입니다");
      return;
    }

    onCharacterAdd({
      ...newCharacter,
      thumbnailUrl: newCharacter.referenceImages[0],
      isPublic: false,
      isFavorite: false,
    });

    // 초기화
    setNewCharacter({
      name: "",
      description: "",
      styleGuide: "",
      referenceImages: [],
    });
    setUploadedFiles([]);
    setIsAddingCharacter(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">캐릭터 관리</h2>
          <p className="text-muted-foreground">
            {characters.length}/{maxCharacters}개 캐릭터 등록됨
          </p>
        </div>
        
        <Dialog open={isAddingCharacter} onOpenChange={setIsAddingCharacter}>
          <DialogTrigger asChild>
            <Button
              disabled={characters.length >= maxCharacters}
            >
              <Plus className="mr-2 h-4 w-4" />
              캐릭터 추가
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>새 캐릭터 추가</DialogTitle>
              <DialogDescription>
                일관성 있는 캐릭터를 생성하기 위한 정보를 입력하세요
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">캐릭터 이름</Label>
                <Input
                  id="name"
                  value={newCharacter.name}
                  onChange={(e) => setNewCharacter(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="예: 김철수"
                />
              </div>
              
              <div>
                <Label htmlFor="description">캐릭터 설명</Label>
                <Textarea
                  id="description"
                  value={newCharacter.description}
                  onChange={(e) => setNewCharacter(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="예: 20대 남성, 검은 단발머리, 파란 눈, 흰 셔츠와 청바지 착용"
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="styleGuide">스타일 가이드 (선택)</Label>
                <Textarea
                  id="styleGuide"
                  value={newCharacter.styleGuide || ""}
                  onChange={(e) => setNewCharacter(prev => ({ ...prev, styleGuide: e.target.value }))}
                  placeholder="예: 부드러운 선, 파스텔 톤, 만화 스타일"
                  rows={2}
                />
              </div>
              
              <div>
                <Label>레퍼런스 이미지 (최대 5개)</Label>
                <div
                  className={`mt-2 border-2 border-dashed rounded-lg p-6 text-center ${
                    isDragging ? "border-primary bg-primary/10" : "border-gray-300"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">
                    이미지를 드래그하거나 클릭하여 업로드
                  </p>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e.target.files)}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload">
                    <Button variant="outline" size="sm" className="mt-2" asChild>
                      <span>파일 선택</span>
                    </Button>
                  </label>
                </div>
                
                {uploadedFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm truncate">{file.name}</span>
                        <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddingCharacter(false)}>
                  취소
                </Button>
                <Button onClick={handleAddCharacter}>
                  캐릭터 추가
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {characters.map((character) => (
          <Card key={character.id} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{character.name}</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    {character.createdAt && formatRelativeTime(character.createdAt)}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onCharacterToggleFavorite(character.id)}
                  >
                    <Star
                      className={`h-4 w-4 ${
                        character.isFavorite ? "fill-yellow-400 text-yellow-400" : ""
                      }`}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onCharacterRemove(character.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {character.thumbnailUrl && (
                <div className="aspect-square bg-gray-100 rounded-md mb-3 overflow-hidden">
                  <img
                    src={character.thumbnailUrl}
                    alt={character.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <p className="text-sm text-gray-600 line-clamp-3">
                {character.description}
              </p>
              {character.styleGuide && (
                <p className="text-xs text-gray-500 mt-2 italic">
                  스타일: {character.styleGuide}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}