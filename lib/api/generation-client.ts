/**
 * Generation API 클라이언트
 * 406 에러 방지를 위해 서버 API route를 통해 안전하게 접근
 */

export interface GenerationData {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string;
  tokensUsed: number;
  createdAt: string;
}

export interface GenerationResponse {
  success: boolean;
  generation?: GenerationData;
  error?: string;
}

/**
 * Generation 정보를 서버 API를 통해 안전하게 가져오기
 * 직접 Supabase 접근 시 406 에러 방지
 */
export async function getGenerationById(generationId: string): Promise<GenerationResponse> {
  try {
    const response = await fetch(`/api/generation/${generationId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Generation API client error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

/**
 * Generation 존재 여부만 확인 (경량 요청)
 */
export async function checkGenerationExists(generationId: string): Promise<boolean> {
  try {
    const result = await getGenerationById(generationId);
    return result.success && !!result.generation;
  } catch {
    return false;
  }
}