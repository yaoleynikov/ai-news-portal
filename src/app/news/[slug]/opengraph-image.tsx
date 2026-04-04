// src/app/news/[slug]/opengraph-image.tsx — Dynamic OG images
import { getPostBySlug, getAllPostSlugs } from '@/lib/posts';
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'SiliconFeed';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export async function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return null;

  const tag = post.tag || post.tags?.[0] || 'Tech';

  return new ImageResponse(
    (
      <div
        style={{
          background: '#0f172a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Watermark text */}
        <div
          style={{
            position: 'absolute',
            bottom: -30,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 500,
            fontWeight: 900,
            color: '#ffffff',
            opacity: 0.03,
            letterSpacing: '-0.04em',
            whiteSpace: 'nowrap',
          }}
        >
          SF
        </div>

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
            padding: '10px 28px',
            borderRadius: 9999,
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1.5px solid rgba(59, 130, 246, 0.3)',
            marginBottom: 32,
            fontSize: 20,
            fontWeight: 700,
            color: '#60a5fa',
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          {tag}
        </div>

        {/* Title */}
        <div
          style={{
            maxWidth: 1000,
            padding: '0 50px',
            fontSize: 52,
            fontWeight: 800,
            color: '#f1f5f9',
            lineHeight: 1.25,
            textAlign: 'center',
            letterSpacing: '-0.02em',
          }}
        >
          {post.title}
        </div>

        {/* Bottom branding */}
        <div
          style={{
            position: 'absolute',
            bottom: 28,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 800,
              color: '#fff',
            }}
          >
            S
          </div>
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#94a3b8',
              letterSpacing: 1,
            }}
          >
            SiliconFeed
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
