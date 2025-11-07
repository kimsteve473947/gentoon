#!/usr/bin/env node
/**
 * Patch _document.js to prevent webpack runtime errors
 * This fixes the "Cannot read properties of undefined (reading 'length')" error
 */

const fs = require('fs');
const path = require('path');

const documentPath = path.join(__dirname, '../.next/server/pages/_document.js');

console.log('🔍 Checking for _document.js...');

if (fs.existsSync(documentPath)) {
  console.log('📝 Patching _document.js...');

  const content = fs.readFileSync(documentPath, 'utf8');

  // Add polyfill at the very beginning of the file
  const patchedContent = `
// 🔥 PATCHED: Add polyfills for Supabase SSR
if (typeof self === 'undefined') {
  global.self = global;
}
if (typeof window === 'undefined') {
  global.window = global;
}
if (typeof document === 'undefined') {
  global.document = {};
}

${content}
`;

  fs.writeFileSync(documentPath, patchedContent, 'utf8');
  console.log('✅ Successfully patched _document.js');
} else {
  console.log('ℹ️  _document.js not found (this is OK for App Router only apps)');
}
