/**
 * 🔥 CRITICAL: Instrumentation hook for Next.js
 * This runs BEFORE any server code, including webpack runtime
 * Reference: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

// Apply polyfills immediately at module load time
if (typeof global.self === 'undefined') {
  (global as any).self = global
}

// Temporarily disable window polyfill to debug location issue
// if (typeof (global as any).window === 'undefined') {
//   (global as any).window = global
// }

if (typeof (global as any).document === 'undefined') {
  (global as any).document = {}
}

export function register() {
  // Polyfills are already applied at module load
  console.log('✅ [Instrumentation] Global polyfills active')
}
