import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function NotFound() {
  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(to bottom right, #f3f4f6, #e5e7eb)'
        }}>
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <h1 style={{ fontSize: '6rem', fontWeight: 'bold', color: '#9333ea', marginBottom: '1rem' }}>404</h1>
            <h2 style={{ fontSize: '2rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
              페이지를 찾을 수 없습니다
            </h2>
            <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
              요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
            </p>
            <Link href="/" style={{
              display: 'inline-block',
              padding: '0.75rem 2rem',
              background: '#9333ea',
              color: 'white',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              fontWeight: '500'
            }}>
              홈으로 돌아가기
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
