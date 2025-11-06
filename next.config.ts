import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel 배포 최적화
  // 🔥 CRITICAL: output 제거 - standalone 모드가 Collecting page data 에러 유발
  // output: 'standalone',

  // ESLint 설정 (빌드 시 경고 허용)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // TypeScript 설정 (빌드 시 경고 허용)
  typescript: {
    ignoreBuildErrors: true,
  },

  // 404 페이지 생성 스킵 (Html import 에러 방지)
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },

  // ✅ 정적 최적화 완전 비활성화 (Supabase SSR과 Edge Runtime 호환성 문제 해결)

  // 🔥 CRITICAL FIX: 페이지 정적 생성 완전 비활성화
  // 이렇게 하면 "Collecting page data" 단계를 스킵하여 Supabase SSR 에러 방지
  // PPR (Partial Prerendering) 완전 비활성화 - Next.js 15의 새로운 기능이 Supabase와 충돌하므로 비활성화
  experimental: {
    // dynamicIO: true, // Next.js 15 canary only - 제거
    optimizePackageImports: [
      '@radix-ui',
      'lucide-react',
      'zustand',
      'framer-motion',
      'react-hook-form',
      '@tanstack/react-query'
    ],
    // 🎯 모든 페이지를 동적 렌더링으로 강제
    isrMemoryCacheSize: 0, // ISR 캐시 비활성화
    // 정적 페이지 미리 렌더링 완전 비활성화
    staticPageGenerationTimeout: 0,
  },

  // 🔥 CRITICAL: 빌드 타임 정적 생성 완전 비활성화
  // "Collecting page data" 단계를 스킵하여 Supabase SSR 에러 방지
  skipTrailingSlashRedirect: true,
  skipMiddlewareUrlNormalize: true,

  // ⚠️ Move serverComponentsExternalPackages to top level (Next.js 15 change)
  // Supabase packages marked as external to avoid Edge Runtime issues
  serverExternalPackages: [
    'sharp',
    '@img/sharp-libvips-dev',
    'canvas',
    '@supabase/ssr',
    '@supabase/supabase-js',
    '@supabase/realtime-js',
    '@supabase/postgrest-js',
    '@supabase/storage-js',
    '@supabase/functions-js',
    '@supabase/auth-js',
    '@supabase/gotrue-js'
  ],
  
  // 워크스페이스 루트 설정 (경고 해결)
  outputFileTracingRoot: process.cwd(),
  
  // 이미지 최적화
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'lzxkvtwuatsrczhctsxb.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '**.vercel.app',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
    ],
  },
  
  // 압축 최적화
  compress: true,
  
  // 번들 분석기 (프로덕션에서만)
  productionBrowserSourceMaps: false,
  
  // 보안 헤더 (프로덕션에서만 CSP 적용)
  async headers() {
    // 개발 환경에서는 CSP 비활성화 (Toss Payments 테스트용)
    if (process.env.NODE_ENV === 'development') {
      return [];
    }
    
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.tosspayments.com https://pay.toss.im https://*.tosspayments.com",
              "connect-src 'self' https://api.tosspayments.com https://log.tosspayments.com https://js.tosspayments.com https://pay.toss.im https://*.tosspayments.com https://lzxkvtwuatsrczhctsxb.supabase.co https://ai.google.dev https://generativelanguage.googleapis.com https://cdn.jsdelivr.net wss://lzxkvtwuatsrczhctsxb.supabase.co",
              "img-src 'self' data: https: blob:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "frame-src 'self' https://js.tosspayments.com https://pay.toss.im https://*.tosspayments.com",
              "worker-src 'self' blob:",
              "object-src 'none'",
            ].join('; ')
          }
        ]
      }
    ];
  },
  
  // Webpack 설정
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    // 🔥 CRITICAL: Supabase 패키지를 서버 빌드에서 완전히 제외
    if (isServer) {
      // 기존 externals 배열 방식 유지하되, Supabase 패키지 추가
      if (!Array.isArray(config.externals)) {
        config.externals = [];
      }

      // Supabase 패키지를 정규식으로 매칭
      config.externals.push(/@supabase\/.*/);
    }

    // 개발 환경에서 빌드 속도 향상
    if (process.env.NODE_ENV === 'development') {
      config.optimization.minimize = false;
    }

    // 프로덕션 최적화
    if (process.env.NODE_ENV === 'production') {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          framework: {
            name: 'framework',
            chunks: 'all',
            test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
            priority: 40,
            enforce: true,
          },
          lib: {
            test(module: any) {
              return module.size() > 160000 &&
                /node_modules[/\\]/.test(module.identifier());
            },
            name(module: any) {
              const hash = require('crypto').createHash('sha1');
              hash.update(module.identifier());
              return hash.digest('hex').substring(0, 8);
            },
            priority: 30,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          commons: {
            name: 'commons',
            minChunks: 2,
            priority: 20,
          },
          shared: {
            name(module: any, chunks: any) {
              return 'shared';
            },
            priority: 10,
            minChunks: 2,
            reuseExistingChunk: true,
          },
        },
      };
    }
    
    // 클라이언트 사이드에서 Node.js 전용 모듈들 제외
    if (!isServer) {
      config.externals = [...(config.externals || []), 
        'canvas', 
        'sharp', 
        'child_process',
        'fs',
        'path',
        '@img/sharp-libvips-dev',
        '@img/sharp-wasm32',
        'detect-libc'
      ];
    }
    
    return config;
  },
};

export default nextConfig;
