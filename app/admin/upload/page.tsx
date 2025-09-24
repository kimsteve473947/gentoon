'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Upload, X, Plus, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

interface ProjectData {
  title: string;
  description: string;
  client: string;
  category: 'instatoon' | 'webtoon' | 'branding';
  featured: boolean;
  published: boolean;
  tags: string[];
}

interface UploadedFile {
  file: File;
  preview: string;
  id: string;
}

interface ThumbnailFile {
  file: File;
  preview: string;
}

export default function AdminUploadPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<UploadedFile[]>([]);
  const [thumbnailFile, setThumbnailFile] = useState<ThumbnailFile | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [projectData, setProjectData] = useState<ProjectData>({
    title: '',
    description: '',
    client: '',
    category: 'instatoon',
    featured: false,
    published: true,
    tags: []
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || user.email !== ADMIN_EMAIL) {
        router.push('/gallery');
        return;
      }
      
      setUser(user);
      setLoading(false);
    };

    checkAuth();
  }, [supabase.auth, router]);

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles: UploadedFile[] = [];

    files.forEach(file => {
      // 파일 타입 및 크기 검증
      if (!file.type.startsWith('image/')) {
        showAlert('error', `${file.name}은(는) 이미지 파일이 아닙니다.`);
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        showAlert('error', `${file.name}은(는) 10MB를 초과합니다.`);
        return;
      }

      const preview = URL.createObjectURL(file);
      validFiles.push({
        file,
        preview,
        id: Math.random().toString(36).substr(2, 9)
      });
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
    // 파일 input 초기화
    e.target.value = '';
  };

  // 파일 제거
  const removeFile = (id: string) => {
    setSelectedFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  // 썸네일 파일 선택 핸들러
  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 타입 및 크기 검증
    if (!file.type.startsWith('image/')) {
      showAlert('error', '썸네일은 이미지 파일만 가능합니다.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showAlert('error', '썸네일은 10MB를 초과할 수 없습니다.');
      return;
    }

    // 기존 썸네일 제거
    if (thumbnailFile) {
      URL.revokeObjectURL(thumbnailFile.preview);
    }

    const preview = URL.createObjectURL(file);
    setThumbnailFile({ file, preview });
    e.target.value = '';
  };

  // 썸네일 제거
  const removeThumbnail = () => {
    if (thumbnailFile) {
      URL.revokeObjectURL(thumbnailFile.preview);
      setThumbnailFile(null);
    }
  };

  // 이미지 업로드 (웹툰 이미지들과 썸네일)
  const uploadFiles = async (): Promise<{ images: string[], thumbnail?: string }> => {
    if (selectedFiles.length === 0) return { images: [] };

    setUploadingFiles(true);
    setUploadProgress(0);

    try {
      // 세션 토큰 가져오기
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('인증이 필요합니다.');
      }

      const formData = new FormData();
      
      // 웹툰 이미지들 추가
      selectedFiles.forEach(({ file }) => {
        formData.append('files', file);
      });

      // 썸네일이 있으면 추가
      if (thumbnailFile) {
        formData.append('thumbnail', thumbnailFile.file);
      }

      const response = await fetch('/api/webtoon/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData,
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'File upload failed');
      }

      setUploadProgress(100);
      return {
        images: result.data.urls || [],
        thumbnail: result.data.thumbnailUrl
      };
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectData.title || !projectData.description || !projectData.client) {
      showAlert('error', '모든 필수 항목을 입력해주세요.');
      return;
    }

    if (selectedFiles.length === 0) {
      showAlert('error', '최소 1개의 이미지를 업로드해주세요.');
      return;
    }

    setUploading(true);
    
    try {
      // 1단계: 파일 업로드
      showAlert('success', '이미지를 업로드하는 중...');
      const uploadResult = await uploadFiles();
      
      if (uploadResult.images.length === 0) {
        throw new Error('이미지 업로드에 실패했습니다.');
      }

      // 2단계: 프로젝트 데이터 생성
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('인증이 필요합니다.');
      }

      const projectPayload = {
        ...projectData,
        thumbnail_url: uploadResult.thumbnail || uploadResult.images[0], // 썸네일이 있으면 사용, 없으면 첫 번째 이미지
        images: uploadResult.images,
        creator_id: session.user.id
      };

      const response = await fetch('/api/webtoon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(projectPayload)
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Project creation failed');
      }

      showAlert('success', '작품이 성공적으로 업로드되었습니다!');
      
      // 폼 초기화
      setProjectData({
        title: '',
        description: '',
        client: '',
        category: 'instatoon',
        featured: false,
        published: true,
        tags: []
      });
      
      // 선택된 파일들 정리
      selectedFiles.forEach(({ preview }) => URL.revokeObjectURL(preview));
      setSelectedFiles([]);
      
      // 썸네일 정리
      if (thumbnailFile) {
        URL.revokeObjectURL(thumbnailFile.preview);
        setThumbnailFile(null);
      }
      
      // 2초 후 갤러리로 이동
      setTimeout(() => {
        router.push('/gallery');
      }, 2000);
      
    } catch (error) {
      console.error('Upload error:', error);
      showAlert('error', error instanceof Error ? error.message : '업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">권한을 확인하는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/gallery')}
            className="mb-4 text-purple-600 hover:text-purple-800"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            갤러리로 돌아가기
          </Button>
          
          <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
              🎨 새 작품 업로드
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              GenToon 갤러리에 새로운 웹툰 작품을 추가합니다
            </p>
          </div>
        </div>

        {/* 알림 */}
        {alert && (
          <div className="max-w-2xl mx-auto mb-6">
            <Alert className={cn(
              alert.type === 'success' 
                ? 'border-green-200 bg-green-50' 
                : 'border-red-200 bg-red-50'
            )}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className={
                alert.type === 'success' ? 'text-green-800' : 'text-red-800'
              }>
                {alert.message}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* 업로드 폼 */}
        <Card className="max-w-2xl mx-auto shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-2xl font-bold text-gray-900">작품 정보 입력</CardTitle>
            <CardDescription className="text-gray-600">
              업로드할 웹툰 작품의 정보를 입력해주세요
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-6">
              {/* 썸네일 업로드 */}
              <div>
                <Label className="text-gray-700 font-medium">썸네일 (회사 로고)</Label>
                <p className="text-sm text-gray-500 mt-1">
                  선택하지 않으면 첫 번째 웹툰 이미지가 썸네일로 사용됩니다
                </p>
                <div className="mt-2">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                    <div className="text-center">
                      <div className="mb-3">
                        <Label
                          htmlFor="thumbnail-upload"
                          className="cursor-pointer inline-flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          썸네일 선택
                        </Label>
                        <input
                          id="thumbnail-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleThumbnailSelect}
                          className="hidden"
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        권장: 회사 로고 (1:1 비율)
                      </p>
                    </div>
                  </div>

                  {/* 썸네일 미리보기 */}
                  {thumbnailFile && (
                    <div className="mt-3">
                      <div className="relative group inline-block">
                        <div className="aspect-square w-24 relative overflow-hidden rounded-lg border border-gray-200">
                          <Image
                            src={thumbnailFile.preview}
                            alt="Thumbnail preview"
                            fill
                            className="object-cover"
                          />
                          <button
                            type="button"
                            onClick={removeThumbnail}
                            className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 text-center">
                          썸네일
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 이미지 업로드 */}
              <div>
                <Label className="text-gray-700 font-medium">웹툰 이미지 *</Label>
                <div className="mt-2">
                  {/* 파일 업로드 버튼 */}
                  <div className="border-2 border-dashed border-purple-300 rounded-lg p-6 bg-purple-50/50 hover:bg-purple-50 transition-colors">
                    <div className="text-center">
                      <ImageIcon className="mx-auto h-12 w-12 text-purple-400 mb-4" />
                      <div className="mb-4">
                        <Label
                          htmlFor="file-upload"
                          className="cursor-pointer inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          이미지 선택
                        </Label>
                        <input
                          id="file-upload"
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </div>
                      <p className="text-sm text-gray-600">
                        JPEG, PNG, WebP, GIF 파일 (최대 10MB)
                      </p>
                    </div>
                  </div>

                  {/* 업로드된 이미지 미리보기 */}
                  {selectedFiles.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                      {selectedFiles.map((file) => (
                        <div key={file.id} className="relative group">
                          <div className="aspect-[3/4] relative overflow-hidden rounded-lg border border-gray-200">
                            <Image
                              src={file.preview}
                              alt="Preview"
                              fill
                              className="object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeFile(file.id)}
                              className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            {file.file.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 업로드 진행률 */}
                  {uploadingFiles && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                        <span>이미지 업로드 중...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 작품 제목 */}
              <div>
                <Label htmlFor="title" className="text-gray-700 font-medium">
                  작품 제목 *
                </Label>
                <Input
                  id="title"
                  value={projectData.title}
                  onChange={(e) => setProjectData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="예: 삼성 갤럭시 런칭 스토리"
                  className="mt-2 border-gray-200 focus:border-purple-500 focus:ring-purple-500"
                  required
                />
              </div>

              {/* 클라이언트 */}
              <div>
                <Label htmlFor="client" className="text-gray-700 font-medium">
                  클라이언트 *
                </Label>
                <Input
                  id="client"
                  value={projectData.client}
                  onChange={(e) => setProjectData(prev => ({ ...prev, client: e.target.value }))}
                  placeholder="예: 삼성전자"
                  className="mt-2 border-gray-200 focus:border-purple-500 focus:ring-purple-500"
                  required
                />
              </div>

              {/* 카테고리 */}
              <div>
                <Label className="text-gray-700 font-medium">카테고리 *</Label>
                <Select 
                  value={projectData.category} 
                  onValueChange={(value: 'instatoon' | 'webtoon' | 'branding') => 
                    setProjectData(prev => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger className="mt-2 border-gray-200 focus:border-purple-500 focus:ring-purple-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instatoon">인스타툰</SelectItem>
                    <SelectItem value="webtoon">웹툰</SelectItem>
                    <SelectItem value="branding">브랜딩</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 작품 설명 */}
              <div>
                <Label htmlFor="description" className="text-gray-700 font-medium">
                  작품 설명 *
                </Label>
                <Textarea
                  id="description"
                  value={projectData.description}
                  onChange={(e) => setProjectData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="작품에 대한 간략한 설명을 입력해주세요"
                  rows={4}
                  className="mt-2 border-gray-200 focus:border-purple-500 focus:ring-purple-500"
                  required
                />
              </div>

              {/* 추천작 여부 */}
              <div className="flex items-center space-x-3 p-4 bg-purple-50 rounded-lg">
                <input
                  type="checkbox"
                  id="featured"
                  checked={projectData.featured}
                  onChange={(e) => setProjectData(prev => ({ ...prev, featured: e.target.checked }))}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <Label htmlFor="featured" className="text-gray-700 font-medium">
                  추천작으로 설정 ⭐
                </Label>
              </div>

              {/* 업로드 버튼 */}
              <Button
                type="submit"
                disabled={uploading || uploadingFiles || selectedFiles.length === 0}
                className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    작품을 업로드하는 중...
                  </>
                ) : uploadingFiles ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    이미지를 업로드하는 중...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    작품 업로드하기
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 안내 메시지 */}
        <div className="max-w-2xl mx-auto mt-8 text-center">
          <p className="text-sm text-gray-500">
            업로드된 작품은 갤러리에 즉시 표시되며, 관리자만 업로드할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}