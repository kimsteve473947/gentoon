/**
 * 🔥 CRITICAL: Instrumentation hook for Next.js
 * This runs BEFORE any server code, including webpack runtime
 * Reference: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Node.js runtime only
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Polyfill global.self for Supabase SSR
    if (typeof global.self === 'undefined') {
      (global as any).self = global
    }

    // Add window polyfill
    if (typeof (global as any).window === 'undefined') {
      (global as any).window = global
    }

    // Add document polyfill
    if (typeof (global as any).document === 'undefined') {
      (global as any).document = {}
    }

    console.log('✅ [Instrumentation] Global polyfills loaded')
  }
}
