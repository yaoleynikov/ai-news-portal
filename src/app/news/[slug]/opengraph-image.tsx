// src/app/news/[slug]/opengraph-image.tsx — Canvas-based OG images
import { getPostBySlug, getAllPostSlugs } from '@/lib/posts';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import type { Canvas } from '@napi-rs/canvas';
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'SiliconFeed Article';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const tagCompanyMap: Record<string, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',
  apple: 'apple',
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

async function loadLogo(name: string): Promise<any> {
  const logosDir = path.join(process.cwd(), 'public', 'logos');
  for (const ext of ['.png', '.jpg', '.jpeg']) {
    const p = path.join(logosDir, name + ext);
    if (fs.existsSync(p)) return loadImage(p);
  }
  const svgPath = path.join(logosDir, name + '.svg');
  if (fs.existsSync(svgPath)) return loadImage(fs.readFileSync(svgPath));
  return null;
}

function wrapText(ctx: any, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function renderCanvas(
  post: { title: string; tag?: string; tags?: string[] }
): Promise<Canvas> {
  const tag = post.tag || post.tags?.[0] || 'Tech';
  const company = resolveCompany(tag);

  const canvas = createCanvas(1200, 630);
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1200, 630);

  // Top accent bar
  const grad = ctx.createLinearGradient(0, 0, 1200, 0);
  grad.addColorStop(0, '#3b82f6');
  grad.addColorStop(0.5, '#8b5cf6');
  grad.addColorStop(1, '#ec4899');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1200, 6);

  // Company logo: blurred background (center)
  if (company) {
    try {
      const logo = await loadLogo(company);
      if (logo) {
        // Blurred background logo — 6% opacity with simulated blur
        ctx.save();
        ctx.globalAlpha = 0.06;
        // Simple blur by drawing multiple offset copies
        const blurSize = 500;
        const offsetX = (1200 - blurSize) / 2;
        const offsetY = (630 - blurSize) / 2;
        const offsets = [-4, -2, 0, 2, 4];
        for (const dx of offsets) {
          for (const dy of offsets) {
            ctx.drawImage(logo, offsetX + dx, offsetY + dy, blurSize, blurSize);
          }
        }
        ctx.restore();

        // Clear logo at 40% opacity, centered-right
        ctx.save();
        ctx.globalAlpha = 0.40;
        const clearSize = 450;
        ctx.drawImage(
          logo,
          1200 - clearSize - 40,
          (630 - clearSize) / 2,
          clearSize,
          clearSize
        );
        ctx.restore();
      }
    } catch {}
  }

  // Tag badge
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  const tagText = tag.toUpperCase();
  const tw = ctx.measureText(tagText).width + 48;
  const bx = 40;
  const by = 28;
  const bh = 34;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.06)';
  roundRect(ctx, bx, by, tw, bh, bh / 2);
  ctx.fill();
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tagText, bx + tw / 2, by + bh / 2);

  // Title
  ctx.font = 'bold 52px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'left';
  const lines = wrapText(ctx, post.title, 560);
  const lh = 62;
  const startY = 180;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 40, startY + i * lh);
  }

  // "siliconfeed.online" branding bottom
  ctx.font = '600 16px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#9ca3af';
  ctx.textAlign = 'left';
  ctx.fillText('siliconfeed.online', 40, 600);

  return canvas;
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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
  if (!post) {
    const canvas = await renderCanvas({ title: 'SiliconFeed', tag: 'Tech' });
    const buf = canvas.toBuffer('image/png');
    return new ImageResponse(
      <img src={`data:image/png;base64,${buf.toString('base64')}`}
        style={{ width: '100%', height: '100%' }} />
    );
  }

  const canvas = await renderCanvas(post);
  const buf = canvas.toBuffer('image/png');
  return new ImageResponse(
    <img src={`data:image/png;base64,${buf.toString('base64')}`}
      style={{ width: '100%', height: '100%' }} />
  );
}
