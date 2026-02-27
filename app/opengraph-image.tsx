import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Chlo - Curated Experiences';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F7F1E7',
          fontFamily: 'Georgia, serif',
        }}
      >
        {/* Decorative top band */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '6px',
            background: 'linear-gradient(90deg, #C9A983, #E7D8C6, #C9A983)',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '0 80px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: '16px',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: '#6E5B52',
              marginBottom: '24px',
            }}
          >
            chlo.co.uk
          </p>
          <h1
            style={{
              fontSize: '160px',
              fontWeight: '700',
              color: '#3B2F2A',
              lineHeight: 1,
              margin: '0 0 32px 0',
            }}
          >
            Chlo
          </h1>
          <p
            style={{
              fontSize: '28px',
              color: '#6E5B52',
              fontStyle: 'italic',
              fontWeight: '300',
              maxWidth: '700px',
            }}
          >
            Curated experiences for modern living
          </p>
        </div>

        {/* Decorative bottom band */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '6px',
            background: 'linear-gradient(90deg, #C9A983, #E7D8C6, #C9A983)',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
