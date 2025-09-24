import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Header } from "@/components/layout/header";
import { FloatingContactButton } from "@/components/ui/floating-contact-button";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "GenToon - AI 웹툰 제작 플랫폼",
  description: "AI로 쉽고 빠르게 인스타그램 웹툰을 제작하세요. 캐릭터 일관성 유지, 간편한 스토리텔링",
  keywords: ["웹툰", "인스타툰", "AI", "만화", "창작", "인스타그램", "GenToon"],
  authors: [{ name: "GenToon" }],
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' }
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ],
  },
  openGraph: {
    title: "GenToon - AI 웹툰 제작 플랫폼",
    description: "AI로 쉽고 빠르게 인스타그램 웹툰을 제작하세요",
    type: "website",
    locale: "ko_KR",
    images: [
      {
        url: '/gentoon.webp',
        width: 1200,
        height: 630,
        alt: 'GenToon - AI 웹툰 제작 플랫폼',
      }
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased flex flex-col" suppressHydrationWarning>
        <Header />
        <main className="flex-grow">
          {children}
        </main>
        <FloatingContactButton />
      </body>
    </html>
  );
}
