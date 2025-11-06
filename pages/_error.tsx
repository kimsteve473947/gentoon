/**
 * Minimal _error page to prevent Next.js auto-generation
 */
import { NextPageContext } from 'next'

function Error({ statusCode }: { statusCode?: number }) {
  return null // Will never be rendered in App Router
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 404
  return { statusCode }
}

export default Error
