/**
 * 🔥 CRITICAL: Complete DOM environment for Node.js
 * Uses happy-dom for full DOM API compatibility
 */

// Try to use happy-dom for complete DOM environment
try {
  const { Window } = require('happy-dom');
  const window = new Window();

  // Set global APIs
  global.window = window;
  global.document = window.document;
  global.self = global;
  global.navigator = window.navigator;
  global.location = window.location;
} catch (e) {
  // Fallback to minimal polyfills if happy-dom not available
  if (typeof self === 'undefined') {
    global.self = global;
  }

  if (typeof window === 'undefined') {
    global.window = global;
  }

  if (typeof document === 'undefined') {
    global.document = {};
  }
}
