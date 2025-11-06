/**
 * 🔥 CRITICAL: Global browser API polyfills for Node.js environment
 * This must run before any Supabase code is loaded
 */
if (typeof self === 'undefined') {
  global.self = global;
}

if (typeof window === 'undefined') {
  global.window = global;
}

if (typeof document === 'undefined') {
  // Create a minimal document mock with common methods
  global.document = {
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    getElementsByClassName: () => [],
    getElementsByTagName: () => [],
    createElement: () => ({}),
    createTextNode: () => ({}),
    addEventListener: () => {},
    removeEventListener: () => {},
    body: {},
    head: {},
    documentElement: {},
  };
}

if (typeof navigator === 'undefined') {
  global.navigator = { userAgent: 'node' };
}

if (typeof location === 'undefined') {
  global.location = { href: '', origin: '', protocol: 'https:', hostname: 'localhost' };
}
