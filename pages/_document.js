/**
 * 🔥 CRITICAL: Minimal _document.js to prevent Next.js auto-generation
 * This prevents webpack runtime errors during build
 */

// Use React.createElement instead of JSX to avoid Html component import
const React = require('react')

function Document() {
  return null // Minimal implementation
}

Document.getInitialProps = async function(ctx) {
  const initialProps = { html: '', head: [], styles: [] }
  return initialProps
}

module.exports = Document
module.exports.default = Document
