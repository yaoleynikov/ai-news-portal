// src/app/news/[slug]/opengraph-image.tsx — Dynamic OG images
import { getPostBySlug, getAllPostSlugs } from '@/lib/posts';
import { ImageResponse } from 'next/og';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const alt = 'SiliconFeed';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const tagCompanyMap: Record<string, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',
  microsoft: 'microsoft',
  nvidia: 'nvidia',
  meta: 'meta',
  amazon: 'amazon',
  bitcoin: 'bitcoin',
  crypto: 'bitcoin',
  ethereum: 'ethereum',
  coinbase: 'coinbase',
  stripe: 'stripe',
  cloudflare: 'cloudflare',
  spacex: 'spacex',
  oracle: 'oracle',
  wikipedia: 'wikipedia',
  freebsd: 'freebsd',
  claude: 'anthropic',
  chatgpt: 'openai',
  gemma: 'google',
  gpt: 'openai',
  copilot: 'microsoft',
  gemini: 'google',
  algorand: 'algorand',
  tesla: 'tesla',
};

function resolveCompany(tag: string): string | null {
  const key = tag.toLowerCase();
  for (const [k, v] of Object.entries(tagCompanyMap)) {
    if (key.includes(k)) return v;
  }
  return null;
}

function extractSVGElements(svgContent: string) {
  const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 100 100';
  const jsxNodes: any[] = [];

  // Extract <path> elements (self-closing)
  const pathRegex = /<path\s+([^\/>]*?)\s*\/>/g;
  let match;
  while ((match = pathRegex.exec(svgContent)) !== null) {
    const attrs = match[1];
    const d = attrs.match(/d="([^"]+)"/)?.[1];
    const fill = attrs.match(/fill="([^"]+)"/)?.[1];
    if (d) {
      jsxNodes.push({ type: 'path', d, fill: fill || 'currentColor' });
    }
  }

  return { viewBox, jsxNodes };
}

export async function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return null;

  const tag = post.tag || post.tags?.[0] || 'Tech';
  const company = resolveCompany(tag);

  let logoSVG: { viewBox: string; jsxNodes: { type: string; d: string; fill: string }[] } | null = null;
  if (company) {
    const svgPath = path.join(process.cwd(), 'public', 'logos', company + '.svg');
    if (fs.existsSync(svgPath)) {
      try {
        const raw = fs.readFileSync(svgPath, 'utf-8');
        logoSVG = extractSVGElements(raw);
      } catch {}
    }
  }

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
        {/* Company logo watermark */}
        {logoSVG && logoSVG.jsxNodes.length > 0 && (
          <svg
            viewBox={logoSVG.viewBox}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '55%',
              height: '55%',
              color: '#e2e8f0',
              opacity: 0.07,
            }}
          >
            {logoSVG.jsxNodes.map((node, i) => (
              <path key={i} d={node.d} fill={node.fill} />
            ))}
          </svg>
        )}

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
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
