/**
 * 🔥 CRITICAL: Complete DOM environment for Node.js
 * Uses happy-dom for full DOM API compatibility, with comprehensive fallback
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

  console.log('✅ [Polyfill] Loaded happy-dom');
} catch (e) {
  // Fallback to comprehensive manual polyfills if happy-dom not available
  console.log('⚠️  [Polyfill] happy-dom not available, using manual polyfill');

  if (typeof global.self === 'undefined') {
    global.self = global;
  }

  if (typeof global.window === 'undefined') {
    global.window = global;
  }

  if (typeof global.document === 'undefined') {
    // Create a complete document polyfill for styled-jsx and webpack
    global.document = {
      querySelector: function() { return null },
      querySelectorAll: function() { return [] },
      getElementsByTagName: function() { return [] },
      getElementById: function() { return null },
      getElementsByClassName: function() { return [] },
      createElement: function(tag) {
        return {
          tagName: tag,
          setAttribute: function() {},
          appendChild: function() {},
          removeChild: function() {},
          insertBefore: function() {},
          style: {},
          classList: {
            add: function() {},
            remove: function() {},
            contains: function() { return false }
          }
        };
      },
      createTextNode: function() { return { nodeValue: '' } },
      createDocumentFragment: function() {
        return {
          appendChild: function() {},
          childNodes: []
        };
      },
      head: {
        appendChild: function() {},
        insertBefore: function() {},
        removeChild: function() {},
        childNodes: []
      },
      body: {
        appendChild: function() {},
        insertBefore: function() {},
        removeChild: function() {},
        childNodes: []
      }
    };
  }

  console.log('✅ [Polyfill] Manual polyfills loaded');
}
