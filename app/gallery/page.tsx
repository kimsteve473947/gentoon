import { Metadata } from 'next';
import WebtoonGallery from './components/WebtoonGallery';

export const metadata: Metadata = {
  title: '갤러리 - GenToon',
  description: 'GenToon이 제작한 고품질 AI 웹툰과 인스타툰 작품들을 만나보세요. 다양한 기업과 브랜드를 위한 창작물들을 감상하세요.',
  keywords: ['GenToon', '갤러리', '웹툰', '인스타툰', 'AI 웹툰', '작품'],
  openGraph: {
    title: 'GenToon 갤러리',
    description: 'AI로 제작된 고품질 웹툰 작품들',
    type: 'website',
  },
};

export default function GalleryPage() {
  return <WebtoonGallery />;
}