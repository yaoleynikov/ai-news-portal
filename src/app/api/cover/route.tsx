// src/app/api/cover/route.tsx — Dynamic cover image (article cards + sharing)
import { ImageResponse } from 'next/og';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const logoMap: Record<string, string> = {
  'openai': 'openai.svg',
  'anthropic': 'anthropic.svg',
  'google': 'google.svg',
  'microsoft': 'microsoft.svg',
  'nvidia': 'nvidia.svg',
  'meta': 'meta.png',
  'amazon': 'amazon.svg',
  'bitcoin': 'bitcoin.svg',
  'crypto': 'bitcoin.svg',
  'ethereum': 'ethereum.png',
  'coinbase': 'coinbase.svg',
  'stripe': 'stripe.svg',
  'cloudflare': 'cloudflare.svg',
  'spacex': 'spacex.svg',
  'oracle': 'oracle.svg',
  'wikipedia': 'wikipedia.svg',
  'claude': 'anthropic.svg',
  'chatgpt': 'openai.svg',
  'gemma': 'google.svg',
  'gpt': 'openai.svg',
  'copilot': 'microsoft.svg',
  'gemini': 'google.svg',
  'algorand': 'algorand.png',
  'tesla': 'tesla.svg',
  'freebsd': 'freebsd.svg',
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
  } catch { return null; }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || 'SiliconFeed';
  const tag = searchParams.get('tag') || 'Tech';

  const logoFile = getLogoFile(tag);
  let logoDataUrl: string | null = null;
  if (logoFile) logoDataUrl = await getLogoBuffer(logoFile);

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
        {/* Logo watermark (blurred + clear) */}
        {logoDataUrl && (
          <>
            <img
              src={logoDataUrl}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '35%',
                height: '35%',
                objectFit: 'contain',
                opacity: 0.07,
                filter: 'blur(25px)',
              }}
            />
          </>
        )}

        {/* Top accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 4,
            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)',
          }}
        />

        {/* Tag */}
        <div
          style={{
            padding: '6px 20px',
            borderRadius: 9999,
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.2)',
            marginBottom: 24,
            fontSize: 18,
            fontWeight: 600,
            color: '#60a5fa',
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          {tag}
        </div>

        {/* Title */}
        <div
          style={{
            maxWidth: 960,
            padding: '0 40px',
            fontSize: 48,
            fontWeight: 800,
            color: '#e2e8f0',
            lineHeight: 1.2,
            textAlign: 'center',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
