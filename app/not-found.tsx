/**
 * Custom 404 page for App Router
 * Minimal implementation to avoid build errors
 */
export const dynamic = 'force-dynamic'

export default function NotFound() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>404</h1>
      <p>페이지를 찾을 수 없습니다</p>
      <a href="/">홈으로 돌아가기</a>
    </div>
  )
}
