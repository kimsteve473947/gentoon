'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ko">
      <body style={{
        margin: 0,
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <h1 style={{ fontSize: '4rem', margin: '0 0 1rem 0' }}>500</h1>
        <p style={{ fontSize: '1.2rem', margin: '0 0 2rem 0' }}>문제가 발생했습니다</p>
        <button onClick={() => reset()} style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          fontSize: '1rem'
        }}>
          다시 시도
        </button>
      </body>
    </html>
  )
}
