// src/app/news/[slug]/opengraph-image.tsx — Canvas-based OG images (JPEG)
import { getPostBySlug, getAllPostSlugs } from '@/lib/posts';
import { createCanvas, loadImage, Canvas } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const alt = 'SiliconFeed Article';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/jpeg';

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

async function loadLogo(name: string): Promise<any> {
  const logosDir = path.join(process.cwd(), 'public', 'logos');
  for (const ext of ['.png', '.jpg', '.jpeg']) {
    const p = path.join(logosDir, name + ext);
    if (fs.existsSync(p)) return loadImage(p);
  }
  const svgPath = path.join(logosDir, name + '.svg');
  if (fs.existsSync(svgPath)) {
    try {
      const svgBuf = fs.readFileSync(svgPath);
      return loadImage(svgBuf);
    } catch {}
  }
  return null;
}

function wrapText(
  ctx: any,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
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
  if (!post) return Buffer.alloc(0);

  const tag = post.tag || post.tags?.[0] || 'Tech';
  const company = resolveCompany(tag);

  const canvas = createCanvas(1200, 630);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1200, 630);

  // Top gradient bar
  const grad = ctx.createLinearGradient(0, 0, 1200, 0);
  grad.addColorStop(0, '#3b82f6');
  grad.addColorStop(0.5, '#8b5cf6');
  grad.addColorStop(1, '#ec4899');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1200, 6);

  // Company logo watermark
  if (company) {
    const logo = await loadLogo(company);
    if (logo) {
      ctx.globalAlpha = 0.07;
      ctx.drawImage(logo, 250, 160, 700, 700);
      ctx.globalAlpha = 0.22;
      const sm = 180;
      ctx.drawImage(logo, 1200 - sm - 24, 630 - sm - 24, sm, sm);
      ctx.globalAlpha = 1;
    }
  }

  // Tag badge
  ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
  const tagT = tag.toUpperCase();
  const tw = ctx.measureText(tagT).width + 56;
  const bx = (1200 - tw) / 2;
  const by = 100;
  const bh = 42;
  ctx.fillStyle = 'rgba(59,130,246,0.12)';
  roundRect(ctx, bx, by, tw, bh, bh / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(59,130,246,0.3)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, bx, by, tw, bh, bh / 2);
  ctx.stroke();
  ctx.fillStyle = '#60a5fa';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tagT, 600, by + bh / 2);

  // Title
  ctx.font = 'bold 52px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#f1f5f9';
  ctx.textAlign = 'center';
  const lines = wrapText(ctx, post.title, 900);
  const lh = 64;
  const blockH = lines.length * lh;
  const sy = (630 - blockH) / 2 + 20;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 600, sy + i * lh);
  }

  return canvas.toBuffer('image/jpeg', 0.92);
}
