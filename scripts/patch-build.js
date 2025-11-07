#!/usr/bin/env node
/**
 * Pre-build script to ensure instrumentation.ts exists
 * This must run BEFORE next build to be included in compilation
 */

const fs = require('fs');
const path = require('path');

// Create or update instrumentation.ts BEFORE build
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
console.log('✅ Pre-build: instrumentation.ts ready for compilation');
