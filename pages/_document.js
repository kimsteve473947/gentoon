// 🔥 CRITICAL: Minimal _document.js to prevent auto-generation errors
// This prevents Next.js from generating a broken _document.js during build

// Add polyfills immediately
if (typeof self === 'undefined') {
  global.self = global;
}
if (typeof window === 'undefined') {
  global.window = global;
}

const { Html, Head, Main, NextScript } = require('next/document');
const React = require('react');

function Document() {
  return React.createElement(
    Html,
    { lang: 'ko' },
    React.createElement(Head, null),
    React.createElement(
      'body',
      null,
      React.createElement(Main, null),
      React.createElement(NextScript, null)
    )
  );
}

module.exports = Document;
module.exports.default = Document;
