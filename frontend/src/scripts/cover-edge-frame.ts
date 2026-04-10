/**
 * Client: pick backdrop color for letterboxed logo covers (hosts that send CORS on <img>).
 * R2 covers get the same color from SSR (see sampleCoverEdgeBackdropServer); this fills gaps for other hosts.
 */
import { COVER_EDGE_SAMPLE, sampleEdgeBackdropFromRgbaLayout } from '../lib/cover-edge-sample';

export function sampleEdgeDominantColor(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): string {
  const W = COVER_EDGE_SAMPLE;
  const H = COVER_EDGE_SAMPLE;
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
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, ox, oy, dw, dh);

  const data = ctx.getImageData(0, 0, W, H).data;
  return sampleEdgeBackdropFromRgbaLayout(data, W, H, ox, oy, dw, dh);
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
