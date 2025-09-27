import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = '젠툰(GenToon) - AI 웹툰 제작 플랫폼';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* 로고/아이콘 영역 */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '50px',
            padding: '30px',
            marginBottom: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '30px',
              width: '80px',
              height: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px',
            }}
          >
            🎨
          </div>
        </div>

        {/* 메인 타이틀 */}
        <div
          style={{
            fontSize: '72px',
            fontWeight: 'bold',
            color: 'white',
            textAlign: 'center',
            marginBottom: '20px',
            textShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}
        >
          젠툰(GenToon)
        </div>

        {/* 서브 타이틀 */}
        <div
          style={{
            fontSize: '36px',
            color: 'rgba(255, 255, 255, 0.9)',
            textAlign: 'center',
            marginBottom: '40px',
            fontWeight: '500',
          }}
        >
          AI 웹툰 제작 플랫폼
        </div>

        {/* 키 포인트들 */}
        <div
          style={{
            display: 'flex',
            gap: '40px',
            fontSize: '24px',
            color: 'rgba(255, 255, 255, 0.8)',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            ✨ AI 자동 생성
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            👥 캐릭터 일관성
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            📱 인스타툰 최적화
          </div>
        </div>

        {/* 하단 URL */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            right: '40px',
            fontSize: '24px',
            color: 'rgba(255, 255, 255, 0.7)',
            fontWeight: '500',
          }}
        >
          gentoon.ai
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}