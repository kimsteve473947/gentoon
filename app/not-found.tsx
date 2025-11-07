import Link from 'next/link'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default function NotFound() {
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
        <h1 style={{ fontSize: '4rem', margin: '0 0 1rem 0' }}>404</h1>
        <p style={{ fontSize: '1.2rem', margin: '0 0 2rem 0' }}>페이지를 찾을 수 없습니다</p>
        <Link href="/" style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#0070f3',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '0.5rem'
        }}>
          홈으로 돌아가기
        </Link>
      </body>
    </html>
  )
}
