import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Header } from "@/components/layout/header";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "인스타툰 - AI 웹툰 제작 플랫폼",
  description: "AI로 쉽고 빠르게 인스타그램 웹툰을 제작하세요. 캐릭터 일관성 유지, 간편한 스토리텔링",
  keywords: ["웹툰", "인스타툰", "AI", "만화", "창작", "인스타그램"],
  authors: [{ name: "InstaToon" }],
  openGraph: {
    title: "인스타툰 - AI 웹툰 제작 플랫폼",
    description: "AI로 쉽고 빠르게 인스타그램 웹툰을 제작하세요",
    type: "website",
    locale: "ko_KR",
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
      </body>
    </html>
  );
}
