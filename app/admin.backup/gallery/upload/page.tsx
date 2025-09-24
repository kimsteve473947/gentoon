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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, X, Plus, Save, Eye, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { 
  ProjectType, 
  AspectRatio, 
  TargetPlatform,
  CreateGallerySeriesRequest,
  CreateGalleryEpisodeRequest 
} from '@/types/gallery';

// 관리자 전용 이메일
const ADMIN_EMAIL = 'kimjh473947@gmail.com';

interface User {
  id: string;
  email: string;
}

export default function AdminGalleryUploadPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'series' | 'episodes'>('series');
  const [uploadedSeriesId, setUploadedSeriesId] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 시리즈 폼 데이터
  const [seriesData, setSeriesData] = useState<CreateGallerySeriesRequest>({
    title: '',
    description: '',
    author: 'GenToon',
    tags: [],
    category: 'advertisement',
    is_outsourced: true,
    client_company: '',
    client_brand: '',
    project_type: 'instatoon',
    aspect_ratio: '4:5',
    target_platform: 'instagram',
    display_order: 0,
    is_published: false,
    client_metadata: {},
    project_brief: ''
  });

  const [newTag, setNewTag] = useState('');
  const [episodes, setEpisodes] = useState<CreateGalleryEpisodeRequest[]>([]);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  const handleAddTag = () => {
    if (newTag.trim() && !seriesData.tags.includes(newTag.trim())) {
      setSeriesData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSeriesData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleAddEpisode = () => {
    const newEpisode: CreateGalleryEpisodeRequest = {
      series_id: '', // Will be set after series creation
      title: '',
      description: '',
      episode_number: episodes.length + 1,
      panels_data: [],
      instagram_order: episodes.length + 1,
      slide_count: 1,
      caption: '',
      hashtags: [],
      social_media_optimized: true,
      call_to_action: ''
    };
    setEpisodes(prev => [...prev, newEpisode]);
  };

  const handleUpdateEpisode = (index: number, field: keyof CreateGalleryEpisodeRequest, value: any) => {
    setEpisodes(prev => prev.map((ep, i) => 
      i === index ? { ...ep, [field]: value } : ep
    ));
  };

  const handleRemoveEpisode = (index: number) => {
    setEpisodes(prev => prev.filter((_, i) => i !== index));
    // 에피소드 번호 재정렬
    setEpisodes(prev => prev.map((ep, i) => ({
      ...ep,
      episode_number: i + 1,
      instagram_order: i + 1
    })));
  };

  const handleUploadSeries = async () => {
    setUploading(true);
    try {
      const response = await fetch('/api/admin/gallery/series', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(seriesData),
      });

      const result = await response.json();

      if (response.ok) {
        setUploadedSeriesId(result.series.id);
        setCurrentStep('episodes');
        showAlert('success', '시리즈가 성공적으로 업로드되었습니다!');
      } else {
        showAlert('error', result.error || '시리즈 업로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showAlert('error', '업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadEpisodes = async () => {
    if (!uploadedSeriesId) return;

    setUploading(true);
    try {
      const episodesToUpload = episodes.map(ep => ({
        ...ep,
        series_id: uploadedSeriesId
      }));

      const response = await fetch('/api/admin/gallery/episodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ episodes: episodesToUpload }),
      });

      const result = await response.json();

      if (response.ok) {
        showAlert('success', `${episodes.length}개의 에피소드가 성공적으로 업로드되었습니다!`);
        // 업로드 완료 후 갤러리로 이동
        setTimeout(() => {
          router.push(`/gallery/${uploadedSeriesId}`);
        }, 2000);
      } else {
        showAlert('error', result.error || '에피소드 업로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('Episode upload error:', error);
      showAlert('error', '에피소드 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/gallery')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            갤러리로 돌아가기
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📤 외주 프로젝트 업로드
          </h1>
          <p className="text-gray-600">
            관리자 전용: 외주 프로젝트를 갤러리에 업로드합니다
          </p>
        </div>

        {/* 알림 */}
        {alert && (
          <Alert className={cn(
            "mb-6",
            alert.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
          )}>
            <AlertDescription className={alert.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {alert.message}
            </AlertDescription>
          </Alert>
        )}

        {/* 진행 단계 표시 */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
              currentStep === 'series' ? 'bg-blue-600 text-white' : uploadedSeriesId ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
            )}>
              1
            </div>
            <span className={cn(
              "text-sm font-medium",
              currentStep === 'series' ? 'text-blue-600' : uploadedSeriesId ? 'text-green-600' : 'text-gray-600'
            )}>
              시리즈 정보
            </span>
            <div className="w-12 h-0.5 bg-gray-300"></div>
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
              currentStep === 'episodes' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
            )}>
              2
            </div>
            <span className={cn(
              "text-sm font-medium",
              currentStep === 'episodes' ? 'text-blue-600' : 'text-gray-600'
            )}>
              에피소드 업로드
            </span>
          </div>
        </div>

        <Tabs value={currentStep} className="space-y-6">
          <TabsContent value="series">
            <Card>
              <CardHeader>
                <CardTitle>시리즈 정보 입력</CardTitle>
                <CardDescription>
                  외주 프로젝트의 기본 정보를 입력해주세요
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 기본 정보 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="title">프로젝트 제목 *</Label>
                    <Input
                      id="title"
                      value={seriesData.title}
                      onChange={(e) => setSeriesData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="예: 삼성 갤럭시 S24 런칭 캠페인"
                    />
                  </div>
                  <div>
                    <Label htmlFor="author">작가명</Label>
                    <Input
                      id="author"
                      value={seriesData.author}
                      onChange={(e) => setSeriesData(prev => ({ ...prev, author: e.target.value }))}
                      placeholder="GenToon"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">프로젝트 설명 *</Label>
                  <Textarea
                    id="description"
                    value={seriesData.description}
                    onChange={(e) => setSeriesData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="프로젝트에 대한 자세한 설명을 입력해주세요"
                    rows={3}
                  />
                </div>

                {/* 클라이언트 정보 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="client_company">클라이언트 회사 *</Label>
                    <Input
                      id="client_company"
                      value={seriesData.client_company}
                      onChange={(e) => setSeriesData(prev => ({ ...prev, client_company: e.target.value }))}
                      placeholder="예: 삼성전자"
                    />
                  </div>
                  <div>
                    <Label htmlFor="client_brand">브랜드명</Label>
                    <Input
                      id="client_brand"
                      value={seriesData.client_brand}
                      onChange={(e) => setSeriesData(prev => ({ ...prev, client_brand: e.target.value }))}
                      placeholder="예: 갤럭시"
                    />
                  </div>
                </div>

                {/* 프로젝트 타입 및 설정 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>프로젝트 타입 *</Label>
                    <Select
                      value={seriesData.project_type}
                      onValueChange={(value: ProjectType) => setSeriesData(prev => ({ ...prev, project_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instatoon">인스타툰</SelectItem>
                        <SelectItem value="webtoon">웹툰</SelectItem>
                        <SelectItem value="advertisement">광고</SelectItem>
                        <SelectItem value="promotional">프로모션</SelectItem>
                        <SelectItem value="branding">브랜딩</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>화면 비율 *</Label>
                    <Select
                      value={seriesData.aspect_ratio}
                      onValueChange={(value: AspectRatio) => setSeriesData(prev => ({ ...prev, aspect_ratio: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1:1">정사각형 (1:1)</SelectItem>
                        <SelectItem value="4:5">세로형 (4:5)</SelectItem>
                        <SelectItem value="16:9">가로형 (16:9)</SelectItem>
                        <SelectItem value="9:16">세로 영상 (9:16)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>타겟 플랫폼 *</Label>
                    <Select
                      value={seriesData.target_platform}
                      onValueChange={(value: TargetPlatform) => setSeriesData(prev => ({ ...prev, target_platform: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instagram">인스타그램</SelectItem>
                        <SelectItem value="facebook">페이스북</SelectItem>
                        <SelectItem value="youtube">유튜브</SelectItem>
                        <SelectItem value="tiktok">틱톡</SelectItem>
                        <SelectItem value="web">웹사이트</SelectItem>
                        <SelectItem value="blog">블로그</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 태그 입력 */}
                <div>
                  <Label>태그</Label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="태그 입력"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                    />
                    <Button type="button" onClick={handleAddTag} variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {seriesData.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* 프로젝트 브리프 */}
                <div>
                  <Label htmlFor="project_brief">프로젝트 브리프</Label>
                  <Textarea
                    id="project_brief"
                    value={seriesData.project_brief}
                    onChange={(e) => setSeriesData(prev => ({ ...prev, project_brief: e.target.value }))}
                    placeholder="클라이언트의 요구사항, 프로젝트 목표 등을 입력해주세요"
                    rows={4}
                  />
                </div>

                {/* 설정 옵션 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="display_order">진열 순서</Label>
                      <p className="text-sm text-gray-600">낮은 숫자일수록 먼저 표시됩니다</p>
                    </div>
                    <Input
                      id="display_order"
                      type="number"
                      value={seriesData.display_order}
                      onChange={(e) => setSeriesData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                      className="w-24"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="is_published">즉시 게시</Label>
                      <p className="text-sm text-gray-600">활성화하면 갤러리에 바로 표시됩니다</p>
                    </div>
                    <Switch
                      id="is_published"
                      checked={seriesData.is_published}
                      onCheckedChange={(checked) => setSeriesData(prev => ({ ...prev, is_published: checked }))}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleUploadSeries}
                  disabled={uploading || !seriesData.title || !seriesData.description || !seriesData.client_company}
                  className="w-full"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      시리즈 저장하고 다음 단계로
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="episodes">
            <Card>
              <CardHeader>
                <CardTitle>에피소드 관리</CardTitle>
                <CardDescription>
                  시리즈의 에피소드들을 추가하고 관리합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">에피소드 목록 ({episodes.length}개)</h3>
                  <Button onClick={handleAddEpisode} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    에피소드 추가
                  </Button>
                </div>

                {episodes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>아직 에피소드가 없습니다.</p>
                    <p className="text-sm">에피소드를 추가해보세요.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {episodes.map((episode, index) => (
                      <Card key={index} className="border-l-4 border-l-blue-500">
                        <CardHeader className="pb-4">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-base">
                              에피소드 {episode.episode_number}
                            </CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveEpisode(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>에피소드 제목 *</Label>
                              <Input
                                value={episode.title}
                                onChange={(e) => handleUpdateEpisode(index, 'title', e.target.value)}
                                placeholder="에피소드 제목"
                              />
                            </div>
                            <div>
                              <Label>슬라이드 수</Label>
                              <Input
                                type="number"
                                value={episode.slide_count}
                                onChange={(e) => handleUpdateEpisode(index, 'slide_count', parseInt(e.target.value) || 1)}
                                min="1"
                              />
                            </div>
                          </div>
                          <div>
                            <Label>에피소드 설명</Label>
                            <Textarea
                              value={episode.description}
                              onChange={(e) => handleUpdateEpisode(index, 'description', e.target.value)}
                              placeholder="에피소드 설명"
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label>인스타그램 캡션</Label>
                            <Textarea
                              value={episode.caption}
                              onChange={(e) => handleUpdateEpisode(index, 'caption', e.target.value)}
                              placeholder="SNS 게시용 캡션"
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label>콜투액션</Label>
                            <Input
                              value={episode.call_to_action}
                              onChange={(e) => handleUpdateEpisode(index, 'call_to_action', e.target.value)}
                              placeholder="예: 더 많은 정보는 프로필 링크에서!"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {episodes.length > 0 && (
                  <div className="flex gap-4">
                    <Button
                      onClick={handleUploadEpisodes}
                      disabled={uploading || episodes.some(ep => !ep.title)}
                      className="flex-1"
                    >
                      {uploading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          업로드 중...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          모든 에피소드 업로드
                        </>
                      )}
                    </Button>
                    {uploadedSeriesId && (
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/gallery/${uploadedSeriesId}`)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        갤러리에서 보기
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}