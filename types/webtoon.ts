// 웹툰 갤러리 시스템 타입 정의

export interface WebtoonProject {
  id: string;
  title: string;
  description: string;
  client: string;
  thumbnail_url?: string;
  images: string[]; // 여러 이미지 URL 배열
  category: 'instatoon' | 'webtoon' | 'branding';
  featured: boolean;
  created_at: string;
  updated_at: string;
  views: number;
  likes: number;
  published: boolean;
  creator_id: string;
  tags?: string[];
  episode_count?: number;
}

export interface CreateWebtoonRequest {
  title: string;
  description: string;
  client: string;
  category: 'instatoon' | 'webtoon' | 'branding';
  featured: boolean;
  images: File[];
  tags?: string[];
}

export interface UpdateWebtoonRequest {
  id: string;
  title?: string;
  description?: string;
  client?: string;
  category?: 'instatoon' | 'webtoon' | 'branding';
  featured?: boolean;
  published?: boolean;
  tags?: string[];
}

export interface WebtoonResponse {
  success: boolean;
  data: WebtoonProject[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export interface SingleWebtoonResponse {
  success: boolean;
  data: WebtoonProject;
  error?: string;
}

// API 에러 타입
export interface WebtoonError {
  code: string;
  message: string;
  details?: any;
}

// 필터링 옵션
export interface WebtoonFilters {
  category?: 'instatoon' | 'webtoon' | 'branding' | 'all';
  featured?: boolean;
  client?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'created_at' | 'views' | 'likes' | 'title';
  sortOrder?: 'asc' | 'desc';
}

// 업로드 상태
export interface UploadState {
  uploading: boolean;
  progress: number;
  error?: string;
  success: boolean;
}