# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GenToon (InstaToon) - AI 기반 인스타그램 웹툰 제작 SaaS 플랫폼
- 한국 시장 특화 (Toss Payments 통합)
- Google Gemini 2.5 Flash를 활용한 이미지 생성
- 캐릭터 일관성 유지 시스템
- 토큰 기반 구독 모델

## Commands

### Development
```bash
npm run dev              # Start development server (http://localhost:3000)
npm run build           # Build for production  
npm run start           # Start production server
npm run lint            # Run ESLint
```

### Database (Prisma)
```bash
npx prisma generate     # Generate Prisma client
npx prisma migrate dev  # Run migrations in development
npx prisma studio       # Open Prisma Studio (DB GUI)
npx prisma db push      # Push schema changes without migration
```

### Testing & Debugging
```bash
npx tsc --noEmit        # Check TypeScript types
rm -rf .next            # Clear Next.js cache
```

## Tech Stack

- **Framework**: Next.js 15.5.2 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 + Shadcn/ui
- **Database**: Supabase (PostgreSQL) + Prisma ORM  
- **AI**: Google Gemini 2.5 Flash (gemini-2-5-flash-image-preview)
- **Storage**: Vercel Blob
- **Payments**: Toss Payments (Korean payment system)
- **Auth**: Supabase Auth (Clerk temporarily disabled)
- **State**: Zustand

## Architecture

### Project Structure
```
/app                    # Next.js App Router
  /api                 # API routes
    /ai/generate       # AI image generation endpoint
    /payments          # Toss Payments webhooks
    /gallery           # Gallery API endpoints
  /studio              # Main webtoon editor (MiriCanvasStudioUltimate)
  /dashboard           # User dashboard
  /projects            # Project management
  /pricing             # Subscription plans

/components
  /studio              # Editor components (optimized with memoization)
    MiriCanvasStudioUltimate.tsx  # Main studio component
    BubbleTemplates.tsx           # Speech bubble SVG templates (12 templates)
    VirtualizedTemplateList.tsx   # Performance-optimized template list
    OptimizedImage.tsx            # Image loading optimization
    LazyBubbleTemplateRenderer.tsx # Lazy loading for SVG templates
  /ui                  # Shadcn/ui base components

/lib
  /ai                  # AI service integration
    nano-banana-service.ts  # Main AI service
  /db                  # Database utilities
  /payments            # Payment processing
  /supabase            # Supabase client setup
  /utils               # Utility functions
    imageOptimizer.ts  # Image compression utilities

/hooks                 # Custom React hooks
  useDebounce.ts      # Debouncing for performance
  useBatchStateUpdater.ts  # Batch state updates

/prisma
  schema.prisma       # Database schema
```

### Key Components

#### Studio System (MiriCanvasStudioUltimate)
- Main webtoon creation interface at `/studio`
- Multi-panel canvas with drag-and-drop
- Speech bubble system with 12 dynamic SVG templates
- Character reference management (up to 5 characters)
- Real-time AI image generation with Google Gemini
- Performance optimized with React.memo, useMemo, useCallback
- Virtualized lists and lazy loading for large datasets

#### AI Integration
- **Endpoint**: `/api/ai/generate`
- Uses Google Gemini 2.5 Flash for image generation
- Character consistency through reference system
- Token-based usage tracking
- Development mode saves to localStorage for testing

#### Payment & Subscription
- **Plans**: FREE, PERSONAL (₩30,000), HEAVY (₩100,000), ENTERPRISE (₩200,000)
- Token-based usage system
- Toss Payments integration for Korean market
- Webhooks: `/api/payments/billing-success`, `/billing-fail`, `/billing-register`

#### Database Models (Prisma)
- **User**: Linked to Supabase Auth (supabaseId)
- **Subscription**: Plan management and token tracking
- **Project**: Webtoon projects with workspace settings
- **Character**: Reference images for consistency
- **Generation**: AI generation history
- **Transaction**: Payment records

Required in `.env.local`:
```env
# Google AI
GOOGLE_AI_API_KEY=

# Supabase
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...  
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Vercel Blob Storage
VERCEL_BLOB_READ_WRITE_TOKEN=

# Toss Payments
NEXT_PUBLIC_TOSS_CLIENT_KEY=
TOSS_SECRET_KEY=

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Performance Optimizations

Recent optimizations implemented:
1. **React Memoization**: Components wrapped with `React.memo()`
2. **useCallback/useMemo**: Event handlers and computed values optimized
3. **Lazy Loading**: SVG templates load on-demand with Intersection Observer
4. **Image Optimization**: WebP format with compression
5. **Batch State Updates**: Debounced updates with 50ms delay
6. **Virtualized Lists**: Template lists render only visible items

## Development Mode Features

- Mock user ID for testing without auth
- Local storage for generated images  
- Skip character reference manager in development
- Console logging for debugging

## Common Issues & Solutions

#### Database Connection
If Prisma can't connect to Supabase:
1. Check DATABASE_URL in `.env.local`
2. Ensure Supabase project is active
3. Run `npx prisma generate` after schema changes

#### AI Generation Errors
- Check GOOGLE_AI_API_KEY is valid
- Verify token balance for user
- In dev mode, check localStorage for cached images

#### Build Errors
- Clear `.next` directory: `rm -rf .next`
- Regenerate Prisma client: `npx prisma generate`
- Check TypeScript errors: `npx tsc --noEmit`

## Korean Market Considerations

- UI text in Korean (한국어)
- Toss Payments for local payment processing
- KRW (₩) currency throughout
- Instagram-optimized aspect ratios (4:5, 1:1)