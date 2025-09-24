import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import WebtoonDetailPage from './components/WebtoonDetailPage';
import type { WebtoonProject } from '@/types/webtoon';

async function getWebtoonProject(id: string): Promise<WebtoonProject | null> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/webtoon/${id}`, {
      cache: 'no-store' // Always fetch fresh data
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Failed to fetch webtoon project:', error);
    return null;
  }
}

interface PageProps {
  params: {
    id: string;
  };
}

export default async function WebtoonDetailPageWrapper({ params }: PageProps) {
  const project = await getWebtoonProject(params.id);

  if (!project) {
    notFound();
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">작품을 불러오는 중...</p>
        </div>
      </div>
    }>
      <WebtoonDetailPage project={project} />
    </Suspense>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps) {
  const project = await getWebtoonProject(params.id);

  if (!project) {
    return {
      title: '작품을 찾을 수 없습니다 - GenToon Gallery',
    };
  }

  return {
    title: `${project.title} - GenToon Gallery`,
    description: project.description,
    openGraph: {
      title: project.title,
      description: project.description,
      images: project.thumbnail_url ? [project.thumbnail_url] : [],
    },
  };
}