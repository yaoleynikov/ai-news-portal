import fetch from 'node-fetch';
import { config } from '../config.js';
import { loadSharp } from './sharp-loader.js';

/** Final cover dimensions (OG / cards). */
const COVER_WIDTH = 1200;
const COVER_HEIGHT = 630;

/** Smaller canvas edge — used for logo scale and padding math. */
const COVER_MIN_SIDE = Math.min(COVER_WIDTH, COVER_HEIGHT);

/**
 * Padding from cover edges (fraction of shorter side). Keeps the mark away from the crop/safe-zone.
 */
const COMPANY_COVER_EDGE_PAD_FRAC = 0.05;

/**
 * Logo graphic is fitted with `contain` inside a square whose side = this fraction × shorter cover side (e.g. 0.8 → 80%).
 */
const COMPANY_LOGO_FRAC_OF_MIN_SIDE = 0.8;

/**
 * Logo.dev raster size cap (~800); request high enough for downscale without blur.
 * @see https://docs.logo.dev/logo-images/get
 */
const LOGODEV_FETCH_SIZE = 800;

function normalizeLogoDomainKeyword(keyword) {
  const s = String(keyword ?? '').trim();
  if (!s) return '';
  try {
    if (/^https?:\/\//i.test(s)) {
      return new URL(s).hostname.toLowerCase();
    }
  } catch {
    /* ignore */
  }
  return s
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split('?')[0]
    .toLowerCase();
}

/**
 * img.logo.dev may miss one hostname; try related brands (e.g. YouTube stories tagged google.com).
 */
function logoDevDomainsTryList(primary) {
  const aliases = {
    'google.com': ['google.com', 'youtube.com'],
    'youtube.com': ['youtube.com', 'google.com'],
    'meta.com': ['meta.com', 'facebook.com'],
    'fb.com': ['facebook.com', 'meta.com']
  };
  const chain = aliases[primary] ?? [primary];
  const out = [];
  const seen = new Set();
  for (const d of chain) {
    const x = String(d).trim().toLowerCase();
    if (!x || seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

/** Logo raster → canvas color + (для «рамка + плашка») выровнять растр под плашку. */
const LOGO_EDGE_ALPHA_MIN = 120;
const LOGO_ALPHA_TRANSPARENT = 128;
const LOGO_TRANSPARENT_RATIO = 0.055;
const LOGO_EDGE_HIST_QUANT = 10;
/** Два ряда от bbox — цвет внешней кромки файла. */
const LOGO_SOLID_RING_DEPTH = 2;
const LOGO_RING_MIN_SAMPLES = 8;
/** Внутрь от края bbox: зона «плашки» без внешней рамки (и без белого текста). */
const LOGO_PLATE_INSET_FRAC = 0.065;
const LOGO_PLATE_MIN_SAMPLES = 48;
/** Если расстояние в RGB между кромкой и плашкой больше — двухслойная карточка (как Oppo). */
const LOGO_TWO_TONE_MIN_RGB_DIST = 26;
/** Полоса у края bbox, куда подменяем цвет кромки на цвет плашки. */
const LOGO_FLATTEN_BAND_FRAC = 0.12;
const LOGO_LUM_WHITE_INK = 238;

function logoLuminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function rgbDistSq(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

/**
 * Полноразмерный растр: цвет холста и при необходимости буфер с выровненной рамкой.
 * @param {import('sharp')} sharp
 * @param {ArrayBuffer | Buffer} logoBuffer
 * @returns {Promise<{ canvasBg: { r: number; g: number; b: number }; source: string; processedBuffer: Buffer } | null>}
 */
async function prepareCompanyLogoCanvasAndRaster(sharp, logoBuffer) {
  const buf = Buffer.from(logoBuffer);
  let W;
  let H;
  let raw;
  try {
    const img = sharp(buf).ensureAlpha();
    const meta = await img.metadata();
    if (!meta.width || !meta.height) return null;
    W = meta.width;
    H = meta.height;
    const out = await img.raw().toBuffer({ resolveWithObject: true });
    raw = Buffer.from(out.data);
  } catch (e) {
    console.warn('[MEDIA] company cover: logo raster decode failed:', e?.message || e);
    return null;
  }

  const q = (c) => Math.round(Math.min(255, Math.max(0, c)) / LOGO_EDGE_HIST_QUANT) * LOGO_EDGE_HIST_QUANT;
  const pixKey = (r, g, b) => ((q(r) & 255) << 16) | ((q(g) & 255) << 8) | (q(b) & 255);

  const sumCounts = (m) => [...m.values()].reduce((a, b) => a + b, 0);

  function dominantFromCounts(counts) {
    let bestK = 0;
    let bestN = -1;
    for (const [k, n] of counts) {
      if (n > bestN) {
        bestN = n;
        bestK = k;
      }
    }
    if (bestN < 1) return null;
    const r = (bestK >> 16) & 255;
    const g = (bestK >> 8) & 255;
    const b = bestK & 255;
    return { r, g, b };
  }

  function addHist(counts, i, skipWhiteInk) {
    if (raw[i + 3] < LOGO_EDGE_ALPHA_MIN) return;
    const r = raw[i];
    const gch = raw[i + 1];
    const b = raw[i + 2];
    if (skipWhiteInk && logoLuminance(r, gch, b) >= LOGO_LUM_WHITE_INK) return;
    const k = pixKey(r, gch, b);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const totalPx = W * H;
  let transparentCount = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (raw[i + 3] < LOGO_ALPHA_TRANSPARENT) transparentCount++;
    }
  }
  const transparentRatio = transparentCount / totalPx;

  if (transparentRatio >= LOGO_TRANSPARENT_RATIO) {
    let sumL = 0;
    let n = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (raw[i + 3] < LOGO_EDGE_ALPHA_MIN) continue;
        sumL += logoLuminance(raw[i], raw[i + 1], raw[i + 2]);
        n++;
      }
    }
    const avgL = n > 0 ? sumL / n : 255;
    const canvasBg =
      n < 8 ? { r: 255, g: 255, b: 255 } : avgL >= 168 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
    const source =
      n < 8 ? 'transparent-fallback-white' : avgL >= 168 ? 'transparent-light-glyph' : 'transparent-dark-glyph';
    return {
      canvasBg,
      source,
      processedBuffer: buf
    };
  }

  let minX = W;
  let minY = H;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (raw[i + 3] < LOGO_EDGE_ALPHA_MIN) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX) return null;

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const ring = new Map();
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = Math.min(x - minX, maxX - x, y - minY, maxY - y);
      if (d < LOGO_SOLID_RING_DEPTH) addHist(ring, (y * W + x) * 4, false);
    }
  }

  const inset = Math.max(3, Math.floor(Math.min(bw, bh) * LOGO_PLATE_INSET_FRAC));
  const plate = new Map();
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = Math.min(x - minX, maxX - x, y - minY, maxY - y);
      if (d >= inset) addHist(plate, (y * W + x) * 4, true);
    }
  }

  const outerRgb = dominantFromCounts(ring);
  const plateRgb = dominantFromCounts(plate);
  const ringN = sumCounts(ring);
  const plateN = sumCounts(plate);

  if (!outerRgb) {
    const any = new Map();
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        addHist(any, (y * W + x) * 4, false);
      }
    }
    const rgb = dominantFromCounts(any);
    if (!rgb) return null;
    const processedBuffer = await sharp(raw, { raw: { width: W, height: H, channels: 4 } })
      .webp()
      .toBuffer();
    return { canvasBg: rgb, source: 'solid-bbox-fallback-mode', processedBuffer };
  }

  const twoTone =
    plateRgb &&
    plateN >= LOGO_PLATE_MIN_SAMPLES &&
    ringN >= LOGO_RING_MIN_SAMPLES &&
    Math.sqrt(
      rgbDistSq(outerRgb.r, outerRgb.g, outerRgb.b, plateRgb.r, plateRgb.g, plateRgb.b)
    ) >= LOGO_TWO_TONE_MIN_RGB_DIST;

  if (twoTone && plateRgb) {
    const band = Math.max(3, Math.floor(Math.min(bw, bh) * LOGO_FLATTEN_BAND_FRAC));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.min(x - minX, maxX - x, y - minY, maxY - y);
        if (d >= band) continue;
        const i = (y * W + x) * 4;
        if (raw[i + 3] < LOGO_EDGE_ALPHA_MIN) continue;
        const r = raw[i];
        const gch = raw[i + 1];
        const b = raw[i + 2];
        if (logoLuminance(r, gch, b) >= LOGO_LUM_WHITE_INK) continue;
        const dOut = rgbDistSq(r, gch, b, outerRgb.r, outerRgb.g, outerRgb.b);
        const dPl = rgbDistSq(r, gch, b, plateRgb.r, plateRgb.g, plateRgb.b);
        if (dOut <= dPl + 120) {
          raw[i] = plateRgb.r;
          raw[i + 1] = plateRgb.g;
          raw[i + 2] = plateRgb.b;
        }
      }
    }
    const processedBuffer = await sharp(raw, { raw: { width: W, height: H, channels: 4 } })
      .webp()
      .toBuffer();
    return {
      canvasBg: { r: plateRgb.r, g: plateRgb.g, b: plateRgb.b },
      source: 'solid-two-tone-flatten-plate',
      processedBuffer
    };
  }

  if (ringN >= LOGO_RING_MIN_SAMPLES) {
    const processedBuffer = await sharp(raw, { raw: { width: W, height: H, channels: 4 } })
      .webp()
      .toBuffer();
    return {
      canvasBg: { r: outerRgb.r, g: outerRgb.g, b: outerRgb.b },
      source: 'solid-2row-ring-mode',
      processedBuffer
    };
  }

  const any = new Map();
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      addHist(any, (y * W + x) * 4, false);
    }
  }
  const rgb = dominantFromCounts(any);
  if (!rgb) return null;
  const processedBuffer = await sharp(raw, { raw: { width: W, height: H, channels: 4 } })
    .webp()
    .toBuffer();
  return { canvasBg: rgb, source: 'solid-bbox-fallback-mode', processedBuffer };
}

/**
 * Composite 1200×630 canvas from a Logo.dev raster.
 */
async function composeCompanyCoverFromLogoBuffer(logoBuffer) {
  const sharp = await loadSharp();

  if (!sharp) {
    console.warn('[MEDIA] company cover: no sharp — using raw Logo.dev WebP (no composite)');
    return {
      buffer: Buffer.from(logoBuffer),
      contentType: 'image/webp',
      extension: 'webp'
    };
  }

  const edgePad = Math.round(COVER_MIN_SIDE * COMPANY_COVER_EDGE_PAD_FRAC);
  const innerW = COVER_WIDTH - 2 * edgePad;
  const innerH = COVER_HEIGHT - 2 * edgePad;
  const targetLogoSide = Math.round(COVER_MIN_SIDE * COMPANY_LOGO_FRAC_OF_MIN_SIDE);
  const logoBox = Math.min(targetLogoSide, innerW, innerH);

  const prep = await prepareCompanyLogoCanvasAndRaster(sharp, logoBuffer);
  const canvasBg = prep?.canvasBg ?? { r: 255, g: 255, b: 255 };
  const rasterForResize = prep?.processedBuffer ?? Buffer.from(logoBuffer);
  if (prep) {
    console.log(
      `[MEDIA] company cover: canvas backdrop rgb(${canvasBg.r},${canvasBg.g},${canvasBg.b}) (${prep.source})`
    );
  }

  const processedLogo = await sharp(rasterForResize)
    .resize(logoBox, logoBox, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .toBuffer();

  const coverBuffer = await sharp({
    create: {
      width: COVER_WIDTH,
      height: COVER_HEIGHT,
      channels: 4,
      background: { ...canvasBg, alpha: 1 }
    }
  })
    .composite([{ input: processedLogo, gravity: 'center' }])
    .webp({ quality: 85 })
    .toBuffer();

  return { buffer: coverBuffer, contentType: 'image/webp', extension: 'webp' };
}

/**
 * Company cover: centered logo with edge padding; logo max extent ≤ 80% of the shorter cover side.
 */
async function generateCompanyCover(domainInput) {
  if (!config.media.logoDevKey) {
    throw new Error(
      'Logo.dev publishable key missing: set LOGODEV_API_KEY, LOGO_DEV_PUBLISHABLE_KEY, or LOGO_DEV_TOKEN (pk_... for img CDN)'
    );
  }

  const primary = normalizeLogoDomainKeyword(domainInput);
  if (!primary) {
    throw new Error('company cover: empty cover_keyword (expected a domain like google.com)');
  }

  const candidates = logoDevDomainsTryList(primary);
  let lastErr;
  for (const domain of candidates) {
    const logoUrl = `https://img.logo.dev/${encodeURIComponent(domain)}?token=${config.media.logoDevKey}&size=${LOGODEV_FETCH_SIZE}&format=webp`;
    try {
      const response = await fetch(logoUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const buf = await response.arrayBuffer();
      console.log(`[MEDIA] company cover: Logo.dev ok for ${domain}`);
      return await composeCompanyCoverFromLogoBuffer(buf);
    } catch (e) {
      lastErr = e;
      console.warn(`[MEDIA] company cover: img.logo.dev/${domain} failed — ${e.message}`);
    }
  }

  throw new Error(
    `Logo.dev failed for [${candidates.join(', ')}] — last: ${lastErr?.message ?? 'unknown'} (use a publishable pk_ token; sk_ often returns 401 on img CDN)`
  );
}

/** Ordered HF tokens: primary then optional secondary (deduped). */
function hfBearerKeys() {
  const k1 = config.ai.hfKey?.trim();
  const k2 = config.ai.hfKey2?.trim();
  const out = [];
  if (k1) out.push(k1);
  if (k2 && k2 !== k1) out.push(k2);
  return out;
}

/** Whether to try the next API key (quota / billing / auth), not cold-start 503. */
function shouldTryAlternateHfKey(httpStatus, bodySnippet) {
  if (httpStatus === 503) return false;
  if (httpStatus === 402 || httpStatus === 429 || httpStatus === 401 || httpStatus === 403) return true;
  const s = String(bodySnippet || '').toLowerCase();
  return /limit|quota|exceeded|insufficient|payment|credit|billing|monthly|free tier|rate limit|too many requests/.test(
    s
  );
}

/**
 * One HF token: 503 cold-start retries on this key only; other HTTP errors throw (may trigger key fallback outside).
 */
async function generateAbstractCoverWithKey(keyword, bearerKey, inferenceUrl) {
  const prompt = [
    'Editorial news photography, photorealistic, natural daylight or soft indoor light,',
    'contemporary real world 2020s setting, grounded everyday scene.',
    `Subject and mood must match this brief (no brand logos or readable text): ${keyword}.`,
    'Avoid: science fiction, futuristic armor, cyborgs, robots, holograms, neon cyberpunk,',
    'space stations, glowing wireframe heads, fantasy weapons, abstract particles,',
    'unless the brief explicitly requires that exact topic.',
    'NO text, NO typography, NO words, NO letters, NO UI screenshots, NO app mockups.'
  ].join(' ');

  const maxAttempts = 3;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(inferenceUrl, {
        headers: {
          Authorization: `Bearer ${bearerKey}`,
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({ inputs: prompt })
      });

      if (response.status === 503) {
        let waitTime = 20;
        try {
          const result = await response.json();
          waitTime = result.estimated_time || 20;
        } catch {
          /* ignore */
        }
        console.log(
          `[MEDIA] HF Model loading, waiting ${waitTime}s (attempt ${attempts + 1}/${maxAttempts})`
        );
        await new Promise((r) => setTimeout(r, waitTime * 1000));
        attempts++;
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        const err = new Error(`HF API error: ${response.status} ${errText.slice(0, 240)}`);
        err.hfHttpStatus = response.status;
        err.hfBodyPreview = errText;
        throw err;
      }

      const ct = (response.headers.get('content-type') || '').toLowerCase();
      if (!ct.includes('image')) {
        const errText = await response.text();
        throw new Error(`HF returned non-image (${ct || 'no content-type'}): ${errText.slice(0, 240)}`);
      }

      const imageBlob = await response.arrayBuffer();
      const sharp = await loadSharp();
      const raw = Buffer.from(imageBlob);

      if (!sharp) {
        console.warn('[MEDIA] abstract cover: no sharp — using HF image as PNG (no resize/WebP)');
        return { buffer: raw, contentType: 'image/png', extension: 'png' };
      }

      // HF often emits a square; crop to landscape hero / OG shape.
      const coverBuffer = await sharp(raw)
        .resize(COVER_WIDTH, COVER_HEIGHT, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer();

      return { buffer: coverBuffer, contentType: 'image/webp', extension: 'webp' };
    } catch (err) {
      if (err.hfHttpStatus != null) {
        throw err;
      }
      console.error(`[MEDIA] Attempt ${attempts + 1} failed:`, err.message);
      attempts++;
      if (attempts >= maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  throw new Error('HF model failed to load after cold-start retries');
}

/**
 * Generates an abstract featured image using FLUX.1-schnell via HF API.
 * Retries 503 on the same key; on quota-style HTTP errors tries HF_API_KEY2 if set.
 */
async function generateAbstractCover(keyword) {
  const keys = hfBearerKeys();
  if (keys.length === 0) {
    throw new Error('HF_API_KEY is not configured');
  }

  const hfModel = 'black-forest-labs/FLUX.1-schnell';
  const inferenceUrl =
    config.ai.hfInferenceUrl ||
    `https://router.huggingface.co/hf-inference/models/${hfModel}`;

  let lastErr;
  for (let i = 0; i < keys.length; i++) {
    try {
      return await generateAbstractCoverWithKey(keyword, keys[i], inferenceUrl);
    } catch (err) {
      lastErr = err;
      const st = err.hfHttpStatus;
      const preview = (err.hfBodyPreview || '') + err.message;
      const tryNext =
        i < keys.length - 1 && shouldTryAlternateHfKey(typeof st === 'number' ? st : -1, preview);

      if (tryNext) {
        console.warn(
          `[MEDIA] HF key ${i + 1} rejected (${st ?? err.message.slice(0, 80)}) — trying HF_API_KEY2.`
        );
        continue;
      }
      throw err;
    }
  }

  throw lastErr || new Error('HF abstract cover: all keys exhausted');
}

/**
 * @returns {Promise<{ buffer: Buffer, contentType: string, extension: string }>}
 */
export async function generateCover(type, keyword) {
  if (type === 'company') {
    return await generateCompanyCover(keyword);
  }
  return await generateAbstractCover(keyword);
}

export const FALLBACK_ABSTRACT_COVER_KEYWORD =
  'journalist desk with laptop and coffee mug in bright office window light, calm professional mood';

/**
 * Company/logo covers often fail (401, missing domain). Fall back to abstract FLUX like the dev pipeline.
 * @returns {Promise<{ buffer: Buffer, contentType: string, extension: string, cover_fallback?: boolean }>}
 */
export async function generateCoverWithFallback(coverType, coverKeyword) {
  try {
    return await generateCover(coverType, coverKeyword);
  } catch (err) {
    if (coverType === 'company') {
      console.warn(
        '[MEDIA] company cover failed → FLUX abstract fallback (fix Logo.dev key/domain or check logs above):',
        err.message
      );
      const out = await generateCover('abstract', FALLBACK_ABSTRACT_COVER_KEYWORD);
      return { ...out, cover_fallback: true };
    }
    throw err;
  }
}
