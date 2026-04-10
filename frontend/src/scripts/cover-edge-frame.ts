/**
 * Sample border pixels of a downscaled cover, pick dominant quantized RGB, set container background.
 * Requires crossOrigin on <img> + CORS on the image host; otherwise getImageData may throw (caught).
 */
const QUANT = 28;

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
