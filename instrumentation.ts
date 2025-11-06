
/**
 * 🔥 CRITICAL: Add self polyfill for Supabase compatibility
 * This runs before any other code during Next.js initialization
 */
export function register() {
  if (typeof self === 'undefined') {
    (global as any).self = global;
  }
}
