# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GenToon - AI 기반 웹툰 제작 SaaS 플랫폼
- 한국 시장 특화 (Toss Payments 통합)
- Google Vertex AI Gemini 2.5 Flash를 활용한 이미지 생성
- AI 대본 생성 및 캐릭터 자동 매핑 시스템
- 캐릭터 일관성 유지 시스템 (비율별 레퍼런스 이미지 지원)
- 토큰 기반 구독 모델

## Commands

### Development
```bash
npm run dev              # Start development server (http://localhost:3000)
npm run build           # Build for production (includes prisma generate)
npm run start           # Start production server
npm run lint            # Run ESLint
```

### Database (Prisma)
```bash
npx prisma generate     # Generate Prisma client (auto-runs after npm install)
npx prisma migrate dev  # Run migrations in development
npx prisma studio       # Open Prisma Studio (DB GUI)
npx prisma db push      # Push schema changes without migration

# Production environment commands (use specific DATABASE_URL)
DATABASE_URL="postgresql://postgres:@rlawndgnl0206@lzxkvtwuatsrczhctsxb.supabase.co:5432/postgres" npx prisma migrate dev
DATABASE_URL="postgresql://postgres.lzxkvtwuatsrczhctsxb:@rlawndgnl0206@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true" npx prisma db push
```

### Testing & Debugging
```bash
npx tsc --noEmit        # Check TypeScript types
rm -rf .next            # Clear Next.js cache
npm run clear-cache     # Clear Next.js cache with confirmation message
npm run dev-fresh       # Clear cache and start dev server
npx tsx <script>        # Run TypeScript files directly
```

## Tech Stack

- **Framework**: Next.js 15.5.2 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 + Shadcn/ui
- **Database**: Supabase (PostgreSQL) + Prisma ORM  
- **AI**: Google Vertex AI (Gemini 2.5 Flash Image Preview)
- **Storage**: Supabase Storage
- **Payments**: Toss Payments (Korean payment system)
- **Auth**: Supabase Auth
- **State**: Zustand
- **Canvas**: Konva.js + React-Konva
- **Image Processing**: Sharp, Canvas API

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
- Character reference management (up to 5 characters per subscription tier)
- Real-time AI image generation with Google Vertex AI
- **AI Script Generation**: Automatically generates Korean webtoon scripts with character mapping
- **Character Auto-Selection**: Automatically selects appropriate characters per panel based on AI script
- **Ratio-Specific References**: Uses 1:1 or 4:5 ratio images based on canvas selection
- Performance optimized with React.memo, useMemo, useCallback
- Virtualized lists and lazy loading for large datasets

#### AI Integration
- **Image Generation**: `/api/ai/generate`
- **Script Generation**: `/api/ai/generate-script`
- Uses Google Vertex AI (Gemini 2.5 Flash Image Preview)
- Character consistency through ratio-specific reference images
- AI script-based automatic character selection system
- Token-based usage tracking with real-time balance monitoring
- Development mode saves to localStorage for testing

#### Payment & Subscription
- **Plans**: FREE, STARTER (₩29,000), PRO (₩59,000), PREMIUM (₩99,000), ADMIN
- Token-based usage system with monthly resets
- Toss Payments integration for Korean market (billing keys for recurring payments)
- Multiple payment APIs: `/api/payments/billing-register`, `/billing-success`, `/billing-fail`, `/methods`, `/history`

#### Database Models (Prisma)
- **User**: Linked to Supabase Auth, includes referral system
- **Subscription**: Plan management, token tracking, billing keys, and usage resets
- **Project**: Webtoon projects with panels and workspace settings
- **Character**: Reference images for consistency (square and portrait ratios)
- **Element**: UI elements and assets for projects
- **Generation**: AI generation history and token usage tracking
- **Transaction**: Payment records and billing history
- **FontFamily**: Custom font management system
- **UserStorage**: File storage tracking and limits
- **Inquiry**: Customer support system

Required in `.env.local`:
```env
# Google Vertex AI
GOOGLE_AI_API_KEY=
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_CLOUD_LOCATION=global
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# Supabase
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...  
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Toss Payments
NEXT_PUBLIC_TOSS_CLIENT_KEY=
TOSS_SECRET_KEY=

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Additional Services
VERCEL_ANALYTICS_ID=
SENTRY_DSN=
```

## Performance Optimizations

Recent optimizations implemented:
1. **React Memoization**: Components wrapped with `React.memo()`
2. **useCallback/useMemo**: Event handlers and computed values optimized
3. **Lazy Loading**: SVG templates load on-demand with Intersection Observer
4. **Image Optimization**: WebP format with compression
5. **Batch State Updates**: Debounced updates with 50ms delay
6. **Virtualized Lists**: Template lists render only visible items

## Key Architecture Patterns

### AI Script-Based Character Auto-Selection
- **Flow**: AI script generation → Character name extraction → Smart matching → Panel-based auto-selection
- **Smart Matching**: Exact match → Partial match → Korean particle removal
- **Panel Mapping**: `Map<panelIndex, characterIds[]>` for efficient panel-character relationships
- **Auto-Selection UI**: Visual indicators when characters are auto-selected vs manually selected

### Ratio-Specific Character References
- **1:1 Canvas**: Uses square ratio character images only
- **4:5 Canvas**: Uses portrait ratio character images only
- **Optimization**: Sends only 1 relevant reference image per character instead of all 3
- **Performance**: Reduces multimodal prompt payload and improves generation speed

### Prompt Engineering System
- **Template-Based**: Different prompt templates for 1:1 vs 4:5 aspect ratios
- **Photography-Focused**: Uses professional camera terminology for better AI generation
- **Edge-to-Edge**: Optimized prompts ensure images fill entire canvas without padding
- **Korean Optimization**: 100-200 character Korean prompts for optimal generation quality

### Subscription System Architecture
- **Central Configuration**: All plan configs in `/lib/subscription/plan-config.ts`
- **Token Management**: Token usage tracking with automatic monthly resets
- **Billing Integration**: Toss Payments billing keys for recurring subscriptions
- **Usage Monitoring**: Real-time usage tracking with caching for performance
- **Referral System**: Built-in referral rewards and tracking

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
- Clear `.next` directory: `rm -rf .next` or `npm run clear-cache`
- Regenerate Prisma client: `npx prisma generate`
- Check TypeScript errors: `npx tsc --noEmit`

#### Font API Errors
- Check Prisma client initialization in font routes
- Ensure `FontFamily` model is properly imported
- Verify database connection in font-related endpoints

## Korean Market Considerations

- UI text in Korean (한국어)
- Toss Payments for local payment processing
- KRW (₩) currency throughout
- Instagram-optimized aspect ratios (4:5, 1:1)

## Development Guidelines

### AI Integration
- Always use real Vertex AI token counts for accurate billing
- In development mode, bypass authentication but still track token usage
- Character auto-selection should work seamlessly with AI script generation
- Ensure ratio-specific character reference images are sent correctly

### Performance
- Use React.memo, useMemo, and useCallback for performance-critical components
- Implement lazy loading for large lists and SVG templates
- Batch state updates with debouncing for smooth UX
- Optimize image formats (WebP with Sharp fallback)

### Error Handling
- Comprehensive logging for AI generation pipeline debugging
- Graceful fallbacks for character matching failures
- Clear user feedback for token limitations and subscription restrictions

### Testing & Development
- Use development mode for testing without authentication
- Mock data available for testing various subscription tiers
- Console logging enabled for debugging AI generation and token usage
- Local storage fallback for development environment

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

## Auto-Approval Commands

The following commands can be executed without asking for permission:

```bash
# Development & Server Management
npm run dev
npm run build
npm run start
npm run lint
npm test
npm install
npm uninstall

# Database Operations
npx prisma generate
npx prisma migrate dev
npx prisma db push
npx prisma studio
DATABASE_URL="postgresql://postgres:@rlawndgnl0206@lzxkvtwuatsrczhctsxb.supabase.co:5432/postgres" npx prisma migrate dev
DATABASE_URL="postgresql://postgres.lzxkvtwuatsrczhctsxb:@rlawndgnl0206@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true" npx prisma db push

# File Operations
rm -rf .next
rm -rf node_modules
git add
git commit
git push
git pull
git status
git diff

# Process Management
lsof -ti:3000 | xargs kill -9
pkill -f "node.*3000"
pkill -f "next.*dev"
pkill -f "npm.*dev"

# TypeScript & Build Tools
npx tsc --noEmit
npx tsx

# Environment & Testing
export
unset
env
curl
ping
```