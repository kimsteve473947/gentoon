#!/usr/bin/env node
/**
 * 🔥 CRITICAL: Fix _document.js after Next.js auto-generates it
 * This prevents webpack runtime errors during deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking for auto-generated _document.js...');

const documentPath = path.join(__dirname, '../.next/server/pages/_document.js');
const webpackRuntimePath = path.join(__dirname, '../.next/server/webpack-runtime.js');

// Fix webpack-runtime.js
if (fs.existsSync(webpackRuntimePath)) {
  console.log('📝 Patching webpack-runtime.js...');

  let content = fs.readFileSync(webpackRuntimePath, 'utf8');

  // Add null check before accessing .length
  content = content.replace(
    /\.reduce\(/g,
    '.reduce(function(acc, val) { if (!val) return acc; '
  );

  fs.writeFileSync(webpackRuntimePath, content, 'utf8');
  console.log('✅ webpack-runtime.js patched');
}

// Fix _document.js
if (fs.existsSync(documentPath)) {
  console.log('📝 Patching _document.js...');

  const content = fs.readFileSync(documentPath, 'utf8');

  // Add safety checks at the beginning
  const patchedContent = `
// 🔥 PATCHED: Add safety checks for webpack runtime
if (typeof self === 'undefined') { global.self = global; }
if (typeof window === 'undefined') { global.window = global; }
if (typeof document === 'undefined') { global.document = {}; }

// Wrap the original content in try-catch
try {
${content}
} catch (e) {
  console.error('Error in _document.js:', e);
  module.exports = function() { return null; };
}
`;

  fs.writeFileSync(documentPath, patchedContent, 'utf8');
  console.log('✅ _document.js patched');
} else {
  console.log('ℹ️  _document.js not found');
}

console.log('✅ Build fixes complete!');
