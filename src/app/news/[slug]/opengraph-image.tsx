// src/app/news/[slug]/opengraph-image.tsx
// Dynamic OG images: dark bg + blurred logo overlay + clean typography
import { getPostBySlug, getAllPostSlugs } from '@/lib/posts';
import { ImageResponse } from 'next/og';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs'; // Need file system access
export const alt = 'SiliconFeed';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const logoMap: Record<string, string> = {
  'openai': 'openai.svg',
  'anthropic': 'anthropic.svg',
  'google': 'google.svg',
  'microsoft': 'microsoft.svg',
  'nvidia': 'nvidia.svg',
  'meta': 'meta.svg',
  'amazon': 'amazon.svg',
  'bitcoin': 'bitcoin.svg',
  'ethereum': 'ethereum.svg',
  'crypto': 'bitcoin.svg',
  'coinbase': 'coinbase.svg',
  'stripe': 'stripe.svg',
  'cloudflare': 'cloudflare.svg',
  'spacex': 'spacex.svg',
  'oracle': 'oracle.svg',
  'wikipedia': 'wikipedia.svg',
  'freebsd': 'freebsd.svg',
  'claude': 'anthropic.svg',
  'chatgpt': 'openai.svg',
  'gemma': 'google.svg',
  'gpt': 'openai.svg',
  'copilot': 'microsoft.svg',
  'gemini': 'google.svg',
  'algorand': 'algorand.png',
  'marvell': 'nvidia.svg',
  'tesla': 'tesla.svg',
};

function getLogoFile(tag: string): string | null {
  const key = tag.toLowerCase();
  for (const [k, file] of Object.entries(logoMap)) {
    if (key.includes(k)) return file;
  }
  return null;
}

async function getLogoBuffer(logoFile: string): Promise<string | null> {
  try {
    const logosDir = path.join(process.cwd(), 'public', 'logos');
    const filePath = path.join(logosDir, logoFile);
    if (!fs.existsSync(filePath)) return null;
    const file = fs.readFileSync(filePath);
    return `data:image/${logoFile.endsWith('.svg') ? 'svg+xml' : 'png'};base64,${file.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) return null;

  const tag = post.tags?.[0] || 'Tech';
  const logoFile = getLogoFile(tag);
  let logoDataUrl: string | null = null;
  if (logoFile) logoDataUrl = await getLogoBuffer(logoFile);

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
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Blurred background logo at 15% opacity, 40% height */}
        {logoDataUrl ? (
          <img
            src={logoDataUrl}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '40%',
              height: '40%',
              objectFit: 'contain',
              opacity: 0.12,
              filter: 'blur(30px)',
            }}
          />
        ) : null}

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
            background: 'rgba(31, 41, 55, 0.8)',
            border: '1px solid #374151',
            marginBottom: 28,
            fontSize: 22,
            fontWeight: 600,
            color: '#9ca3af',
            letterSpacing: 2,
            textTransform: 'uppercase',
            zIndex: 1,
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
            fontSize: 52,
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.2,
            textAlign: 'center',
            letterSpacing: '-0.02em',
            zIndex: 1,
          }}
        >
          {post.title}
        </div>

        {/* Clear logo foreground (20% height, centered) */}
        {logoDataUrl ? (
          <img
            src={logoDataUrl}
            style={{
              position: 'absolute',
              top: '60%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '20%',
              height: '20%',
              objectFit: 'contain',
              opacity: 0.25,
              zIndex: 1,
            }}
          />
        ) : null}


      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
