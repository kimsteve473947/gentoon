/**
 * 🔥 CRITICAL: Minimal browser API polyfills for Node.js environment
 * Only polyfill what's absolutely necessary for Supabase SSR
 */

// Core polyfills required by Supabase
if (typeof self === 'undefined') {
  global.self = global;
}

if (typeof window === 'undefined') {
  global.window = global;
}

// Minimal document polyfill with essential methods only
if (typeof document === 'undefined') {
  global.document = {
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    getElementsByClassName: () => [],
    getElementsByTagName: () => [],
    createElement: () => ({}),
    body: {},
    head: {},
    documentElement: {},
  };
}
