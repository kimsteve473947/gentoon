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
