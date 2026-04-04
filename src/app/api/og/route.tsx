// src/app/api/og/route.tsx — Dynamic OG image generator
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') || 'SiliconFeed';
  const tag = searchParams.get('tag') || 'Tech';
  const isHome = searchParams.get('home') === 'true';

  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)',
          }}
        />

        {/* Tag badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 24px',
            borderRadius: 9999,
            background: '#1f2937',
            border: '1px solid #374151',
            marginBottom: 28,
            fontSize: 22,
            fontWeight: 600,
            color: '#9ca3af',
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          {tag}
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            maxWidth: 1000,
            padding: '0 40px',
            fontSize: isHome ? 72 : 52,
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.2,
            textAlign: 'center',
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </div>

        {/* Bottom branding */}
        <div
          style={{
            position: 'absolute',
            bottom: 36,
            left: 48,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 900,
              color: '#fff',
            }}
          >
            S
          </div>
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#6b7280',
              letterSpacing: 1,
            }}
          >
            siliconfeed.online
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
