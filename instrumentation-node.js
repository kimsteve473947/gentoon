/**
 * 🔥 CRITICAL: Pre-load polyfill for Node.js --require flag
 * This loads BEFORE any other module, including commons.js
 */

if (typeof global.self === 'undefined') {
  global.self = global
}

if (typeof global.window === 'undefined') {
  global.window = global
}

if (typeof global.document === 'undefined') {
  // Create a more complete document polyfill for styled-jsx
  global.document = {
    querySelector: function() { return null },
    querySelectorAll: function() { return [] },
    getElementsByTagName: function() { return [] },
    getElementById: function() { return null },
    createElement: function() {
      return {
        setAttribute: function() {},
        appendChild: function() {},
        style: {}
      }
    },
    createTextNode: function() { return {} },
    head: {
      appendChild: function() {},
      insertBefore: function() {}
    },
    body: {
      appendChild: function() {},
      insertBefore: function() {}
    }
  }
}

console.log('✅ [Pre-load] Global polyfills loaded via --require')
