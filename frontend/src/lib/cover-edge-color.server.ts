/**
 * Server-only: fetch cover bytes and sample edge backdrop (R2 etc. without browser CORS).
 */
import sharp from 'sharp';
import { normalizeCoverUrl, isCoverHostAllowedForServerImageFetch } from './articles-db';
import { COVER_EDGE_SAMPLE, sampleEdgeBackdropFromRgbaLayout } from './cover-edge-sample';

const FETCH_TIMEOUT_MS = 12_000;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function toClamped(data: Buffer): Uint8ClampedArray {
  return new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
}

export async function sampleCoverEdgeBackdropServer(rawUrl: string): Promise<string | null> {
  const url = normalizeCoverUrl(String(rawUrl || '').trim());
  if (!url) return null;
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!isCoverHostAllowedForServerImageFetch(hostname)) return null;

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  let buf: Buffer;
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { Accept: 'image/*', 'User-Agent': 'SiliconFeedCoverTint/1.0' },
      redirect: 'follow'
    });
    if (!res.ok) return null;
    const len = res.headers.get('content-length');
    if (len && parseInt(len, 10) > MAX_IMAGE_BYTES) return null;
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_IMAGE_BYTES) return null;
    buf = Buffer.from(ab);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }

  let meta: sharp.Metadata;
  try {
    meta = await sharp(buf).metadata();
  } catch {
    return null;
  }
  const iw = meta.width ?? 0;
  const ih = meta.height ?? 0;
  if (!iw || !ih) return null;

  const W = COVER_EDGE_SAMPLE;
  const H = COVER_EDGE_SAMPLE;
  const scale = Math.min(W / iw, H / ih);
  const dw = Math.max(1, Math.round(iw * scale));
  const dh = Math.max(1, Math.round(ih * scale));
  const ox = Math.floor((W - dw) / 2);
  const oy = Math.floor((H - dh) / 2);

  let resized: Buffer;
  try {
    resized = await sharp(buf)
      .resize(dw, dh, { kernel: sharp.kernel.nearest, fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer();
  } catch {
    return null;
  }

  let flat: Buffer;
  try {
    flat = await sharp({
      create: {
        width: W,
        height: H,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([
        {
          input: resized,
          raw: { width: dw, height: dh, channels: 4 },
          left: ox,
          top: oy
        }
      ])
      .raw()
      .toBuffer();
  } catch {
    return null;
  }

  const rgba = toClamped(flat);
  const color = sampleEdgeBackdropFromRgbaLayout(rgba, W, H, ox, oy, dw, dh);
  return color || null;
}
