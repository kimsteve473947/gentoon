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
  global.document = {}
}

console.log('✅ [Pre-load] Global polyfills loaded via --require')
