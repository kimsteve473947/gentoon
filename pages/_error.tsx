function Error({ statusCode }: { statusCode: number }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(to bottom right, #f3f4f6, #e5e7eb)'
    }}>
      <div style={{ textAlign: 'center', padding: '1rem' }}>
        <h1 style={{ fontSize: '6rem', fontWeight: 'bold', color: '#9333ea', marginBottom: '1rem' }}>
          {statusCode}
        </h1>
        <p style={{ fontSize: '1.5rem', color: '#6b7280', marginBottom: '2rem' }}>
          {statusCode === 404
            ? '페이지를 찾을 수 없습니다'
            : '서버 오류가 발생했습니다'}
        </p>
        <a href="/" style={{
          display: 'inline-block',
          padding: '0.75rem 2rem',
          background: '#9333ea',
          color: 'white',
          borderRadius: '0.5rem',
          textDecoration: 'none',
          fontWeight: '500'
        }}>
          홈으로 돌아가기
        </a>
      </div>
    </div>
  )
}

Error.getInitialProps = ({ res, err }: any) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}

export default Error
