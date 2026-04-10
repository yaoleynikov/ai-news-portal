/**
 * Pick a backdrop color for letterboxed logo covers: prefer average of corner patches (true flat
 * background on app-style squares); fall back to dominant border color on the 64×64 thumb.
 * Cross-origin images without CORS taint the canvas; getImageData then throws (caught — CSS fallback).
 */
const QUANT = 28;
/** Pixels per corner when estimating flat backdrop (inside letterboxed draw rect). */
const CORNER_PATCH = 4;
/** If corner patches disagree strongly (photo / gradient), use border histogram instead. */
const CORNER_MAX_SPREAD_SQ = 55 * 55 * 3;

function quantKey(r: number, g: number, b: number): number {
  const rq = Math.round(r / QUANT) * QUANT;
  const gq = Math.round(g / QUANT) * QUANT;
  const bq = Math.round(b / QUANT) * QUANT;
  return ((rq & 255) << 16) | ((gq & 255) << 8) | (bq & 255);
}

function rgbFromKey(key: number): string {
  const r = (key >> 16) & 255;
  const g = (key >> 8) & 255;
  const b = key & 255;
  return `rgb(${r},${g},${b})`;
}

type RGB = { r: number; g: number; b: number };

function avgPatch(
  data: Uint8ClampedArray,
  W: number,
  H: number,
  x0: number,
  y0: number,
  pw: number,
  ph: number
): RGB | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = y0; y < y0 + ph && y < H; y++) {
    for (let x = x0; x < x0 + pw && x < W; x++) {
      if (x < 0 || y < 0) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < 120) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
  }
  if (n < 4) return null;
  return { r: r / n, g: g / n, b: b / n };
}

function colorDistSq(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function sampleCornerBackdrop(
  data: Uint8ClampedArray,
  W: number,
  H: number,
  ox: number,
  oy: number,
  dw: number,
  dh: number
): string {
  const pw = Math.min(CORNER_PATCH, dw);
  const ph = Math.min(CORNER_PATCH, dh);
  if (pw < 2 || ph < 2) return '';

  const xR = ox + dw - pw;
  const yB = oy + dh - ph;
  const patches = [
    avgPatch(data, W, H, ox, oy, pw, ph),
    avgPatch(data, W, H, xR, oy, pw, ph),
    avgPatch(data, W, H, ox, yB, pw, ph),
    avgPatch(data, W, H, xR, yB, pw, ph)
  ].filter((p): p is RGB => p != null);

  if (patches.length < 2) return '';

  let maxSpread = 0;
  for (let i = 0; i < patches.length; i++) {
    for (let j = i + 1; j < patches.length; j++) {
      maxSpread = Math.max(maxSpread, colorDistSq(patches[i], patches[j]));
    }
  }
  if (maxSpread > CORNER_MAX_SPREAD_SQ) return '';

  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of patches) {
    r += p.r;
    g += p.g;
    b += p.b;
  }
  r /= patches.length;
  g /= patches.length;
  b /= patches.length;
  return rgbFromKey(quantKey(Math.round(r), Math.round(g), Math.round(b)));
}

function sampleBorderDominant(data: Uint8ClampedArray, W: number, H: number): string {
  const counts = new Map<number, number>();
  const border = 2;

  const add = (i: number) => {
    const a = data[i + 3];
    if (a < 120) return;
    const k = quantKey(data[i], data[i + 1], data[i + 2]);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (y < border || y >= H - border || x < border || x >= W - border) {
        add((y * W + x) * 4);
      }
    }
  }

  let bestK = 0xffffff;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      bestN = n;
      bestK = k;
    }
  }
  if (bestN === 0) return '';
  return rgbFromKey(bestK);
}

export function sampleEdgeDominantColor(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): string {
  const W = 64;
  const H = 64;
  canvas.width = W;
  canvas.height = H;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return '';

  const scale = Math.min(W / iw, H / ih);
  const dw = Math.max(1, Math.round(iw * scale));
  const dh = Math.max(1, Math.round(ih * scale));
  const ox = Math.floor((W - dw) / 2);
  const oy = Math.floor((H - dh) / 2);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, ox, oy, dw, dh);

  const data = ctx.getImageData(0, 0, W, H).data;

  const fromCorners = sampleCornerBackdrop(data, W, H, ox, oy, dw, dh);
  if (fromCorners) return fromCorners;

  return sampleBorderDominant(data, W, H);
}

function paintFrame(root: HTMLElement): void {
  if (root.dataset.coverEdgeDone === '1') return;
  const img = root.querySelector<HTMLImageElement>(':scope > img');
  if (!img?.src) return;

  const apply = () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      const color = sampleEdgeDominantColor(img, canvas, ctx);
      if (color) {
        root.style.backgroundColor = color;
        root.dataset.coverEdgeDone = '1';
      }
    } catch {
      /* CORS-tainted canvas or decode error — keep CSS fallback */
    }
  };

  if (img.complete && img.naturalWidth > 0) {
    requestAnimationFrame(apply);
  } else {
    img.addEventListener('load', () => requestAnimationFrame(apply), { once: true });
    img.addEventListener('error', () => {}, { once: true });
  }
}

export function initCoverEdgeFrames(): void {
  document.querySelectorAll<HTMLElement>('[data-cover-edge]').forEach(paintFrame);
}
