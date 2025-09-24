import { createClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";

export class ImageStorageService {
  private buckets = {
    webtoonImages: "webtoon-images",
    characterRefs: "character-refs",
    thumbnails: "thumbnails",
  };

  /**
   * 이미지 업로드
   */
  async uploadImage(
    file: File | Blob,
    bucket: keyof typeof this.buckets,
    userId: string,
    metadata?: Record<string, any>
  ): Promise<{
    url: string;
    path: string;
    size: number;
  }> {
    try {
      const supabase = await createClient();
      
      // 파일 이름 생성
      const fileExt = file.type.split("/")[1] || "png";
      const fileName = `${userId}/${uuidv4()}.${fileExt}`;
      
      // Supabase Storage에 업로드
      const { data, error } = await supabase.storage
        .from(this.buckets[bucket])
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (error) {
        console.error("Upload error:", error);
        throw new Error("이미지 업로드에 실패했습니다");
      }

      // 공개 URL 생성
      const { data: { publicUrl } } = supabase.storage
        .from(this.buckets[bucket])
        .getPublicUrl(data.path);

      return {
        url: publicUrl,
        path: data.path,
        size: file.size,
      };
    } catch (error) {
      console.error("Image upload error:", error);
      throw error;
    }
  }

  /**
   * Base64 이미지 업로드
   */
  async uploadBase64Image(
    base64Data: string,
    bucket: keyof typeof this.buckets,
    userId: string,
    mimeType: string = "image/png"
  ): Promise<{
    url: string;
    path: string;
    size: number;
  }> {
    try {
      // Base64를 Blob으로 변환
      const base64WithoutPrefix = base64Data.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64WithoutPrefix, "base64");
      const blob = new Blob([buffer], { type: mimeType });
      
      return await this.uploadImage(blob, bucket, userId);
    } catch (error) {
      console.error("Base64 upload error:", error);
      throw error;
    }
  }

  /**
   * 이미지 URL로부터 다운로드 후 업로드
   */
  async uploadFromUrl(
    imageUrl: string,
    bucket: keyof typeof this.buckets,
    userId: string
  ): Promise<{
    url: string;
    path: string;
    size: number;
  }> {
    try {
      // 이미지 다운로드
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error("이미지 다운로드에 실패했습니다");
      }
      
      const blob = await response.blob();
      return await this.uploadImage(blob, bucket, userId);
    } catch (error) {
      console.error("Upload from URL error:", error);
      throw error;
    }
  }

  /**
   * 썸네일 생성 및 저장
   */
  async createThumbnail(
    originalUrl: string,
    userId: string,
    size: { width: number; height: number } = { width: 256, height: 256 }
  ): Promise<string> {
    try {
      // 실제 구현시 이미지 리사이징 라이브러리 사용
      // 현재는 원본 URL에 파라미터 추가
      const thumbnailUrl = `${originalUrl}?w=${size.width}&h=${size.height}&fit=cover`;
      return thumbnailUrl;
    } catch (error) {
      console.error("Thumbnail creation error:", error);
      return originalUrl; // 실패시 원본 반환
    }
  }

  /**
   * 이미지 삭제
   */
  async deleteImage(
    path: string,
    bucket: keyof typeof this.buckets
  ): Promise<boolean> {
    try {
      const supabase = await createClient();
      
      const { error } = await supabase.storage
        .from(this.buckets[bucket])
        .remove([path]);

      if (error) {
        console.error("Delete error:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Image delete error:", error);
      return false;
    }
  }

  /**
   * 여러 이미지 일괄 삭제
   */
  async deleteImages(
    paths: string[],
    bucket: keyof typeof this.buckets
  ): Promise<boolean> {
    try {
      const supabase = await createClient();
      
      const { error } = await supabase.storage
        .from(this.buckets[bucket])
        .remove(paths);

      if (error) {
        console.error("Batch delete error:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Batch delete error:", error);
      return false;
    }
  }

  /**
   * 사용자의 모든 이미지 목록 조회
   */
  async listUserImages(
    userId: string,
    bucket: keyof typeof this.buckets,
    limit: number = 100
  ): Promise<Array<{
    name: string;
    url: string;
    size: number;
    createdAt: string;
  }>> {
    try {
      const supabase = await createClient();
      
      const { data, error } = await supabase.storage
        .from(this.buckets[bucket])
        .list(userId, {
          limit,
          sortBy: { column: "created_at", order: "desc" },
        });

      if (error) {
        console.error("List images error:", error);
        return [];
      }

      // 공개 URL 생성
      const images = data.map(file => {
        const { data: { publicUrl } } = supabase.storage
          .from(this.buckets[bucket])
          .getPublicUrl(`${userId}/${file.name}`);

        return {
          name: file.name,
          url: publicUrl,
          size: file.metadata?.size || 0,
          createdAt: file.created_at,
        };
      });

      return images;
    } catch (error) {
      console.error("List user images error:", error);
      return [];
    }
  }

  /**
   * 스토리지 사용량 계산
   */
  async getUserStorageUsage(userId: string): Promise<{
    totalSize: number;
    imageCount: number;
    buckets: Record<string, { size: number; count: number }>;
  }> {
    try {
      const supabase = await createClient();
      let totalSize = 0;
      let totalCount = 0;
      const bucketStats: Record<string, { size: number; count: number }> = {};

      for (const [key, bucketName] of Object.entries(this.buckets)) {
        const { data, error } = await supabase.storage
          .from(bucketName)
          .list(userId);

        if (!error && data) {
          const size = data.reduce((acc, file) => acc + (file.metadata?.size || 0), 0);
          const count = data.length;
          
          bucketStats[key] = { size, count };
          totalSize += size;
          totalCount += count;
        } else {
          bucketStats[key] = { size: 0, count: 0 };
        }
      }

      return {
        totalSize,
        imageCount: totalCount,
        buckets: bucketStats,
      };
    } catch (error) {
      console.error("Get storage usage error:", error);
      return {
        totalSize: 0,
        imageCount: 0,
        buckets: {},
      };
    }
  }

  /**
   * 이미지 메타데이터 저장 (DB)
   */
  async saveImageMetadata(
    imageData: {
      url: string;
      path: string;
      userId: string;
      projectId?: string;
      characterId?: string;
      prompt?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      
      await prisma.generation.create({
        data: {
          userId: imageData.userId,
          projectId: imageData.projectId || null,
          characterId: imageData.characterId || null,
          prompt: imageData.prompt || "",
          imageUrl: imageData.url,
          tokensUsed: 0,
          model: "storage",
        },
      });
    } catch (error) {
      console.error("Save image metadata error:", error);
      throw error;
    }
  }
}

// 싱글톤 인스턴스
export const imageStorage = new ImageStorageService();