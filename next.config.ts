import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ESLint 설정 (빌드 시 경고 허용)
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // TypeScript 설정 (빌드 시 경고 허용)
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 성능 최적화 설정
  experimental: {
    optimizePackageImports: [
      '@radix-ui',
      'lucide-react',
      '@supabase/supabase-js',
      'zustand',
      'framer-motion',
      'react-hook-form',
      '@tanstack/react-query'
    ],
  },
  
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
    ],
  },
  
  // 압축 최적화
  compress: true,
  
  // 번들 분석기 (프로덕션에서만)
  productionBrowserSourceMaps: false,
  
  // Webpack 설정
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
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
    
    // 클라이언트 사이드에서 canvas 모듈 제외
    if (!isServer) {
      config.externals = [...(config.externals || []), 'canvas'];
    }
    
    return config;
  },
};

export default nextConfig;
