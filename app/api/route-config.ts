/**
 * 🔥 CRITICAL: Force all API routes to use Node.js runtime
 * This prevents Edge Runtime issues with Supabase SSR
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
