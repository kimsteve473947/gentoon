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

// Complete document polyfill to avoid webpack runtime errors
if (typeof document === 'undefined') {
  // Mock collection with length property (required by webpack)
  const mockCollection = {
    length: 0,
    item: () => null,
    entries: function*() {},
    forEach: () => {},
    keys: function*() {},
    values: function*() {},
    [Symbol.iterator]: function*() {},
  };

  global.document = {
    querySelector: () => null,
    querySelectorAll: () => mockCollection,
    getElementById: () => null,
    getElementsByClassName: () => mockCollection,
    getElementsByTagName: () => mockCollection,
    getElementsByName: () => mockCollection,
    createElement: () => ({}),
    createTextNode: () => ({}),
    body: {},
    head: {},
    documentElement: {},
    scripts: mockCollection,
    styleSheets: mockCollection,
    all: mockCollection,
  };
}
