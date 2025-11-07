#!/usr/bin/env node
/**
 * Post-build script to add global.self polyfill
 * Adds to instrumentation.ts to run before any other code
 */

const fs = require('fs');
const path = require('path');

// Create or update instrumentation.ts
const instrumentationPath = path.join(__dirname, '../instrumentation.ts');
const instrumentationContent = `
/**
 * 🔥 CRITICAL: Add self polyfill for Supabase compatibility
 * This runs before any other code during Next.js initialization
 */
export function register() {
  if (typeof self === 'undefined') {
    (global as any).self = global;
  }
}
`;

fs.writeFileSync(instrumentationPath, instrumentationContent, 'utf8');
console.log('✅ Successfully created instrumentation.ts with self polyfill');

// Patch webpack-runtime.js to handle undefined values
const webpackRuntimePath = path.join(__dirname, '../.next/server/webpack-runtime.js');

if (fs.existsSync(webpackRuntimePath)) {
  console.log('📝 Patching webpack-runtime.js...');

  let content = fs.readFileSync(webpackRuntimePath, 'utf8');

  // Fix the specific error: Cannot read properties of undefined (reading 'length')
  // Replace array.reduce without null check with one that has it
  content = content.replace(
    /function\s*\(([^)]*)\)\s*{\s*return\s+([^.]+)\.reduce\(/g,
    'function($1) { return ($2 || []).reduce('
  );

  // Also add safety check for map
  content = content.replace(
    /function\s*\(([^)]*)\)\s*{\s*return\s+([^.]+)\.map\(/g,
    'function($1) { return ($2 || []).map('
  );

  fs.writeFileSync(webpackRuntimePath, content, 'utf8');
  console.log('✅ webpack-runtime.js patched');
} else {
  console.log('⚠️  webpack-runtime.js not found');
}

// Patch _document.js if it exists
const documentPath = path.join(__dirname, '../.next/server/pages/_document.js');

if (fs.existsSync(documentPath)) {
  console.log('📝 Patching _document.js...');

  const content = fs.readFileSync(documentPath, 'utf8');
  const patchedContent = `
// 🔥 PATCHED: Add safety checks
if (typeof self === 'undefined') { global.self = global; }
if (typeof window === 'undefined') { global.window = global; }

${content}
`;

  fs.writeFileSync(documentPath, patchedContent, 'utf8');
  console.log('✅ _document.js patched');
}

// Also check if commons.js exists and patch it
const commonsPath = path.join(__dirname, '../.next/server/commons.js');

if (fs.existsSync(commonsPath)) {
  const content = fs.readFileSync(commonsPath, 'utf8');
  const patchedContent = `
// 🔥 PATCHED: Add self polyfill
if (typeof self === 'undefined') {
  global.self = global;
}

${content}
`;
  fs.writeFileSync(commonsPath, patchedContent, 'utf8');
  console.log('✅ Successfully patched .next/server/commons.js');
} else {
  console.log('⚠️  .next/server/commons.js not found (normal for local builds)');
}
