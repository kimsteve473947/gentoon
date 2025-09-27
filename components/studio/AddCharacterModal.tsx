"use client";

import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Upload,
  Sparkles,
  Loader2,
  X,
  ImageIcon,
  User,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createBrowserClient } from '@supabase/ssr';
import { CharacterLimitModal } from './CharacterLimitModal';

interface AddCharacterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCharacterAdded?: () => void;
  canvasRatio?: '4:5' | '1:1' | '16:9'; // 현재 캔버스 비율
}

type CreationMode = 'upload' | 'ai' | 'convert' | null;

export function AddCharacterModal({ 
  open, 
  onOpenChange, 
  onCharacterAdded,
  canvasRatio = '4:5' // 기본값 4:5
}: AddCharacterModalProps) {
  const [mode, setMode] = useState<CreationMode>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [personImage, setPersonImage] = useState<File | null>(null);
  const [personPreviewUrl, setPersonPreviewUrl] = useState<string | null>(null);
  const [convertedCharacterUrl, setConvertedCharacterUrl] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitModalData, setLimitModalData] = useState<{
    currentPlan: 'FREE' | 'PRO' | 'PREMIUM';
    currentCount: number;
    maxCount: number;
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const personFileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 모달 초기화
  const resetModal = () => {
    setMode(null);
    setName('');
    setDescription('');
    setAiPrompt('');
    setUploadedImage(null);
    setPreviewUrl(null);
    setPersonImage(null);
    setPersonPreviewUrl(null);
    setConvertedCharacterUrl(null);
    setIsConverting(false);
    setIsCreating(false);
    setShowLimitModal(false);
    setLimitModalData(null);
  };

  // 모달 닫기
  const handleClose = () => {
    if (!isCreating && !isConverting) {
      resetModal();
      onOpenChange(false);
    }
  };

  // 파일 업로드 처리 (비율 조정 포함)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지 파일만 허용
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    // 파일 크기 제한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB를 초과할 수 없습니다.');
      return;
    }

    try {
      // 이미지 리사이즈 기능 임시 비활성화 (Sharp 라이브러리 문제로 인해)
      console.log('Image resize temporarily disabled due to Sharp library issue');
      setUploadedImage(file);
      
      // 미리보기 생성 (Data URL 사용 - CSP 호환)
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setPreviewUrl(dataUrl);
        console.log(`✅ 이미지 미리보기 생성 완료: ${file.name}`);
      };
      reader.onerror = () => {
        console.error('❌ 파일 읽기 실패');
        alert('이미지 파일을 읽을 수 없습니다.');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('이미지 리사이즈 실패:', error);
      alert('이미지 처리 중 오류가 발생했습니다. 다른 이미지를 선택해주세요.');
    }
  };

  // 사람 사진 업로드 처리
  const handlePersonImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지 파일만 허용
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    // 파일 크기 제한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB를 초과할 수 없습니다.');
      return;
    }

    try {
      setPersonImage(file);
      
      // 미리보기 생성
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setPersonPreviewUrl(dataUrl);
        console.log(`✅ 사람 이미지 미리보기 생성 완료: ${file.name}`);
      };
      reader.onerror = () => {
        console.error('❌ 파일 읽기 실패');
        alert('이미지 파일을 읽을 수 없습니다.');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('이미지 처리 실패:', error);
      alert('이미지 처리 중 오류가 발생했습니다. 다른 이미지를 선택해주세요.');
    }
  };

  // 파일명 안전화 함수
  const sanitizeFileName = (fileName: string): string => {
    // 파일 확장자 추출
    const extension = fileName.substring(fileName.lastIndexOf('.'));
    const nameWithoutExtension = fileName.substring(0, fileName.lastIndexOf('.'));
    
    // 한글, 특수문자, 공백을 안전한 문자로 변환
    const sanitized = nameWithoutExtension
      .replace(/[가-힣]/g, 'char') // 한글을 'char'로 변환
      .replace(/[^\w\-_.]/g, '_') // 영문, 숫자, 하이픈, 언더스코어, 점만 허용
      .replace(/_{2,}/g, '_') // 연속된 언더스코어를 하나로 축약
      .replace(/^_|_$/g, ''); // 시작/끝 언더스코어 제거
    
    return sanitized + extension;
  };

  // 브라우저에서 WebP 변환 및 업로드
  const convertToWebPInBrowser = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      // 파일 검증
      if (!file) {
        reject(new Error('파일이 없습니다'));
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        reject(new Error('이미지 파일이 아닙니다. 지원되는 형식: JPG, PNG, GIF, WebP'));
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB 제한
        reject(new Error('파일 크기가 너무 큽니다. 최대 10MB까지 허용됩니다.'));
        return;
      }
      
      console.log('🔍 이미지 파일 정보:', {
        name: file.name,
        type: file.type,
        size: (file.size / 1024).toFixed(2) + 'KB'
      });

      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas 2D context를 얻을 수 없습니다'));
        return;
      }

      img.onload = () => {
        try {
          // 최대 크기 제한 (1024px)
          const maxSize = 1024;
          let { width, height } = img;
          
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height * maxSize) / width;
              width = maxSize;
            } else {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          
          // Canvas clear 후 이미지 그리기
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          // WebP 지원 확인
          const supportsWebP = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
          
          if (supportsWebP) {
            // WebP로 변환 (0.85 품질)
            canvas.toBlob((blob) => {
              if (blob) {
                console.log('✅ WebP 변환 성공:', blob.size, 'bytes');
                resolve(blob);
              } else {
                reject(new Error('WebP 변환 실패'));
              }
            }, 'image/webp', 0.85);
          } else {
            // WebP 미지원시 JPEG로 폴백
            console.warn('⚠️ WebP 미지원, JPEG로 변환');
            canvas.toBlob((blob) => {
              if (blob) {
                console.log('✅ JPEG 변환 성공:', blob.size, 'bytes');
                resolve(blob);
              } else {
                reject(new Error('JPEG 변환 실패'));
              }
            }, 'image/jpeg', 0.85);
          }
        } catch (error) {
          console.error('Canvas 처리 중 오류:', error);
          reject(error);
        } finally {
          // URL 객체 해제
          if (img.src) {
            URL.revokeObjectURL(img.src);
          }
        }
      };

      img.onerror = (error) => {
        console.error('이미지 로드 오류:', error);
        // URL 객체 해제
        if (img.src) {
          URL.revokeObjectURL(img.src);
        }
        reject(new Error('이미지 로드 실패: 파일이 손상되었거나 지원하지 않는 형식입니다'));
      };
      
      try {
        const objectUrl = URL.createObjectURL(file);
        console.log('🔗 Object URL 생성:', objectUrl.substring(0, 50) + '...');
        img.src = objectUrl;
        
        // 타임아웃 설정 (10초)
        setTimeout(() => {
          if (img.complete === false) {
            console.error('⏰ 이미지 로드 타임아웃');
            URL.revokeObjectURL(objectUrl);
            reject(new Error('이미지 로드 시간 초과'));
          }
        }, 10000);
        
      } catch (error) {
        console.error('Object URL 생성 실패:', error);
        reject(new Error('파일 처리 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류')));
      }
    });
  };

  // 이미지를 Base64로 변환하여 DB에 저장
  const uploadImageToStorage = async (file: File): Promise<string> => {
    try {
      console.log('🔄 이미지를 Base64로 변환 중...', file.name, (file.size / 1024).toFixed(2) + 'KB');
      
      // 파일 검증
      if (!file) {
        throw new Error('파일이 없습니다');
      }
      
      if (!file.type.startsWith('image/')) {
        throw new Error('이미지 파일이 아닙니다. 지원되는 형식: JPG, PNG, GIF, WebP');
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB 제한
        throw new Error('파일 크기가 너무 큽니다. 최대 10MB까지 허용됩니다.');
      }
      
      // 브라우저에서 WebP 변환 시도
      try {
        console.log('🔄 WebP 변환 시도...');
        const convertedBlob = await convertToWebPInBrowser(file);
        
        // Base64로 변환
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result);
          };
          reader.onerror = () => reject(new Error('Base64 변환 실패'));
          reader.readAsDataURL(convertedBlob);
        });
        
        console.log(`✅ WebP 변환 및 Base64 인코딩 완료: ${(base64Data.length / 1024).toFixed(2)}KB`);
        return base64Data;
        
      } catch (webpError) {
        console.warn('⚠️ WebP 변환 실패, 원본 파일로 진행:', webpError);
        
        // WebP 변환 실패시 원본 파일을 Base64로 변환
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result);
          };
          reader.onerror = () => reject(new Error('Base64 변환 실패'));
          reader.readAsDataURL(file);
        });
        
        console.log(`✅ 원본 파일 Base64 인코딩 완료: ${(base64Data.length / 1024).toFixed(2)}KB`);
        return base64Data;
      }
      
    } catch (error) {
      console.error('❌ 이미지 업로드 중 오류:', error);
      throw new Error(`이미지 업로드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  // AI 캐릭터 생성
  const generateAiCharacter = async (prompt: string): Promise<string> => {
    const response = await fetch('/api/ai/character/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        style: 'character_reference',
        aspectRatio: canvasRatio // AI 생성 시에도 캔버스 비율 전달
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'AI 캐릭터 생성에 실패했습니다.');
    }

    const result = await response.json();
    return result.imageUrl;
  };

  // 사람을 캐릭터로 변환 (미리보기용)
  const handleConvertPersonToCharacter = async () => {
    if (!personImage) {
      alert('사람 사진을 선택해주세요.');
      return;
    }

    try {
      setIsConverting(true);
      
      const formData = new FormData();
      formData.append('image', personImage);
      formData.append('aspectRatio', canvasRatio);

      const response = await fetch('/api/ai/character/convert', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '사람을 캐릭터로 변환하는데 실패했습니다.');
      }

      const result = await response.json();
      setConvertedCharacterUrl(result.imageUrl);
      
    } catch (error) {
      console.error('변환 실패:', error);
      alert(error instanceof Error ? error.message : '이미지 변환 중 오류가 발생했습니다.');
    } finally {
      setIsConverting(false);
    }
  };

  // 캐릭터 생성/저장
  const handleCreateCharacter = async () => {
    if (!name.trim()) {
      alert('캐릭터 이름을 입력해주세요.');
      return;
    }

    if (!description.trim()) {
      alert('캐릭터 설명을 입력해주세요.');
      return;
    }

    if (mode === 'upload' && !uploadedImage) {
      alert('이미지를 업로드해주세요.');
      return;
    }

    if (mode === 'ai' && !aiPrompt.trim()) {
      alert('AI 생성 프롬프트를 입력해주세요.');
      return;
    }

    if (mode === 'convert' && !convertedCharacterUrl) {
      alert('먼저 사람 사진을 캐릭터로 변환해주세요.');
      return;
    }

    try {
      setIsCreating(true);
      
      // 사용자 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }

      // 사용자 데이터 조회
      const { data: userData } = await supabase
        .from('user')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!userData) {
        throw new Error('사용자 정보를 찾을 수 없습니다');
      }

      // 멤버십 정보 확인
      const { data: subscriptionData } = await supabase
        .from('subscription')
        .select('plan')
        .eq('userId', userData.id)
        .single();

      const userPlan = subscriptionData?.plan || 'FREE';

      // 현재 사용자가 등록한 캐릭터 수 확인
      const { count: currentCharacterCount } = await supabase
        .from('character')
        .select('*', { count: 'exact' })
        .eq('userId', userData.id);

      // 멤버십별 캐릭터 등록 제한 확인 (실제 등록 제한값)
      const maxCharacters = userPlan === 'FREE' ? 2 : userPlan === 'PRO' ? 7 : 15;
      
      if ((currentCharacterCount || 0) >= maxCharacters) {
        // 제한 팝업 데이터 설정
        setLimitModalData({
          currentPlan: userPlan as 'FREE' | 'PRO' | 'PREMIUM',
          currentCount: currentCharacterCount || 0,
          maxCount: maxCharacters
        });
        setShowLimitModal(true);
        return;
      }

      let imageUrl = '';
      let referenceImages: string[] = [];
      let ratioImages: any = null;

      if (mode === 'upload' && uploadedImage) {
        // 이미지 업로드
        imageUrl = await uploadImageToStorage(uploadedImage);
        referenceImages = [imageUrl];
        
        // API를 통한 멀티 비율 이미지 처리
        console.log('🎨 API 기반 multi-ratio processing 시작...');
        try {
          const processingResponse = await fetch('/api/characters/process-images', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              referenceImages,
              userId: userData.id
            })
          });

          const processingResult = await processingResponse.json();
          
          if (processingResult.success && processingResult.ratioImages) {
            ratioImages = processingResult.ratioImages;
            console.log('✅ Multi-ratio processing completed:', ratioImages);
          } else {
            console.error('❌ Multi-ratio processing failed:', processingResult.error);
            // 실패해도 원본 이미지는 저장되도록 계속 진행
          }
        } catch (processingError) {
          console.error('❌ Multi-ratio processing API error:', processingError);
          // API 오류가 발생해도 원본 이미지는 저장되도록 계속 진행
        }
      } else if (mode === 'ai' && aiPrompt.trim()) {
        // AI 캐릭터 생성
        imageUrl = await generateAiCharacter(aiPrompt);
        referenceImages = [imageUrl];
        
        // AI 생성 이미지도 API를 통한 멀티 비율 처리
        console.log('🤖 AI character API 기반 multi-ratio processing 시작...');
        try {
          const processingResponse = await fetch('/api/characters/process-images', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              referenceImages,
              userId: userData.id
            })
          });

          const processingResult = await processingResponse.json();
          
          if (processingResult.success && processingResult.ratioImages) {
            ratioImages = processingResult.ratioImages;
            console.log('✅ AI character multi-ratio processing completed:', ratioImages);
          } else {
            console.error('❌ AI character multi-ratio processing failed:', processingResult.error);
            // 실패해도 원본 이미지는 저장되도록 계속 진행
          }
        } catch (processingError) {
          console.error('❌ AI character multi-ratio processing API error:', processingError);
          // API 오류가 발생해도 원본 이미지는 저장되도록 계속 진행
        }
      } else if (mode === 'convert' && convertedCharacterUrl) {
        // 이미 변환된 캐릭터 이미지 사용
        imageUrl = convertedCharacterUrl;
        referenceImages = [imageUrl];
        
        // 변환된 이미지도 API를 통한 멀티 비율 처리
        console.log('👤 Person-to-character API 기반 multi-ratio processing 시작...');
        try {
          const processingResponse = await fetch('/api/characters/process-images', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              referenceImages,
              userId: userData.id
            })
          });

          const processingResult = await processingResponse.json();
          
          if (processingResult.success && processingResult.ratioImages) {
            ratioImages = processingResult.ratioImages;
            console.log('✅ Person-to-character multi-ratio processing completed:', ratioImages);
          } else {
            console.error('❌ Person-to-character multi-ratio processing failed:', processingResult.error);
            // 실패해도 원본 이미지는 저장되도록 계속 진행
          }
        } catch (processingError) {
          console.error('❌ Person-to-character multi-ratio processing API error:', processingError);
          // API 오류가 발생해도 원본 이미지는 저장되도록 계속 진행
        }
      }

      // 캐릭터 API를 통해 데이터베이스에 저장
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          referenceImages: referenceImages,
          ratioImages: ratioImages,
          visualFeatures: {
            hairColor: "",
            hairStyle: "",
            eyeColor: "",
            faceShape: "",
            bodyType: "",
            height: "",
            age: "",
            gender: "",
            skinTone: "",
            distinctiveFeatures: []
          },
          clothing: {
            default: "",
            variations: []
          },
          personality: ""
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '캐릭터 생성에 실패했습니다');
      }

      const result = await response.json();

      // 성공 처리
      onCharacterAdded?.();
      handleClose();
      
    } catch (error) {
      console.error('캐릭터 생성 실패:', error);
      alert(error instanceof Error ? error.message : '캐릭터 생성 중 오류가 발생했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            새 캐릭터 추가
          </DialogTitle>
          <DialogDescription>
            캐릭터를 생성하여 웹툰에서 일관된 외모로 활용하세요
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 생성 방식 선택 */}
          {!mode && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setMode('upload')}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-slate-300 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-all"
                >
                  <Upload className="h-8 w-8 text-slate-400" />
                  <div className="text-center">
                    <p className="font-medium text-slate-700">이미지 업로드</p>
                    <p className="text-sm text-slate-500">컴퓨터에서 직접 선택</p>
                  </div>
                </button>
                
                <button
                  onClick={() => setMode('convert')}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all"
                >
                  <Users className="h-8 w-8 text-slate-400" />
                  <div className="text-center">
                    <p className="font-medium text-slate-700">사람 → 캐릭터</p>
                    <p className="text-sm text-slate-500">사람 사진을 캐릭터로 변환</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* 캐릭터 기본 정보 */}
          {mode && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">캐릭터 정보</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode(null)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="name">캐릭터 이름 *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예: 지민이, 캐릭터A"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="description">캐릭터 설명 *</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="캐릭터의 외모, 성격, 특징을 설명해주세요"
                    className="mt-1 min-h-[80px]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 이미지 업로드 모드 */}
          {mode === 'upload' && (
            <div className="space-y-4">
              <Label className="text-base font-medium">레퍼런스 이미지</Label>
              
              <div className="space-y-3">
                {!uploadedImage ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-slate-300 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-all cursor-pointer"
                  >
                    <ImageIcon className="h-12 w-12 text-slate-400" />
                    <div className="text-center">
                      <p className="font-medium text-slate-700">이미지 선택</p>
                      <p className="text-sm text-slate-500 mt-1">
                        PNG, JPG 파일 (최대 10MB)
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <img
                      src={previewUrl!}
                      alt="미리보기"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => {
                        setUploadedImage(null);
                        setPreviewUrl(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* 사람 → 캐릭터 변환 모드 */}
          {mode === 'convert' && (
            <div className="space-y-4">
              <Label className="text-base font-medium">1단계: 사람 사진 업로드</Label>
              
              <div className="space-y-3">
                {!personImage ? (
                  <div
                    onClick={() => personFileInputRef.current?.click()}
                    className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer"
                  >
                    <Users className="h-12 w-12 text-blue-400" />
                    <div className="text-center">
                      <p className="font-medium text-slate-700">사람 사진 선택</p>
                      <p className="text-sm text-slate-500 mt-1">
                        PNG, JPG 파일 (최대 10MB)
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <img
                      src={personPreviewUrl!}
                      alt="사람 사진 미리보기"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => {
                        setPersonImage(null);
                        setPersonPreviewUrl(null);
                        setConvertedCharacterUrl(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
                <input
                  ref={personFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePersonImageUpload}
                  className="hidden"
                />
              </div>

              {/* AI 변환 버튼 */}
              {personImage && !convertedCharacterUrl && (
                <Button
                  onClick={handleConvertPersonToCharacter}
                  disabled={isConverting}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                >
                  {isConverting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      AI 변환 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      캐릭터로 변환하기
                    </>
                  )}
                </Button>
              )}

              {/* 변환된 캐릭터 미리보기 */}
              {convertedCharacterUrl && (
                <div className="space-y-3">
                  <Label className="text-base font-medium">2단계: 변환된 캐릭터 확인</Label>
                  <div className="relative">
                    <img
                      src={convertedCharacterUrl}
                      alt="변환된 캐릭터"
                      className="w-full h-48 object-cover rounded-lg border-2 border-green-300"
                    />
                    <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
                      변환 완료
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2 bg-white"
                      onClick={() => {
                        setConvertedCharacterUrl(null);
                      }}
                    >
                      다시 변환
                    </Button>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-800">
                      ✅ <strong>변환 완료!</strong> 결과가 마음에 드시면 아래에서 캐릭터 정보를 입력하고 생성하세요.
                    </p>
                  </div>
                </div>
              )}
              
              {!convertedCharacterUrl && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    ✨ <strong>AI 변환:</strong> 업로드된 사람 사진을 AI가 웹툰 스타일 캐릭터로 자동 변환합니다. 얼굴이 잘 보이는 정면 사진을 사용하시면 더 좋은 결과를 얻을 수 있습니다.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 액션 버튼 */}
          {mode && (
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setMode(null)}
                disabled={isCreating || isConverting}
                className="flex-1"
              >
                이전
              </Button>
              
              <Button
                onClick={handleCreateCharacter}
                disabled={
                  isCreating || 
                  isConverting || 
                  !name.trim() || 
                  !description.trim() ||
                  (mode === 'convert' && !convertedCharacterUrl)
                }
                className={cn(
                  "flex-1",
                  mode === 'convert' 
                    ? "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                    : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                )}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {'캐릭터 생성 중...'}
                  </>
                ) : (
                  <>
                    {mode === 'convert' ? (
                      <Users className="h-4 w-4 mr-2" />
                    ) : mode === 'ai' ? (
                      <Sparkles className="h-4 w-4 mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    캐릭터 생성
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      {/* 캐릭터 제한 팝업 */}
      {limitModalData && (
        <CharacterLimitModal
          open={showLimitModal}
          onOpenChange={setShowLimitModal}
          currentPlan={limitModalData.currentPlan}
          currentCount={limitModalData.currentCount}
          maxCount={limitModalData.maxCount}
        />
      )}
    </Dialog>
  );
}