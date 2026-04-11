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

/**
 * RGBA из `.raw()` — явно не premultiplied (иначе sharp может исказить при кодировании).
 * @param {number} W
 * @param {number} H
 */
function sharpRawRgbaInput(W, H) {
  return {
    raw: {
      width: W,
      height: H,
      channels: 4,
      premultiplied: false
    }
  };
}

/** Промежуточный лого после правок пикселей: lossy WebP даёт сдвиг YUV на тёмно-серых → шов к заливке холста. */
const COMPANY_LOGO_PIPELINE_WEBP = { lossless: true };
/** Один проход сжатия на финале; без агрессивного chroma subsample для ровных кромок. */
const COMPANY_COVER_OUTPUT_WEBP = { quality: 94, smartSubsample: false, effort: 4 };

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
/** Четыре квадрата до 32×32 в углах opaque bbox — общая мода RGB (квант) по непрозрачным пикселям. */
const LOGO_EDGE_PATCH_SIDE = 32;
const LOGO_EDGE_PATCH_QUANT = 8;
const LOGO_EDGE_PATCH_MIN_SAMPLES = 20;
/** Два ряда от bbox — запасной цвет кромки, если патчи пустые. */
const LOGO_SOLID_RING_DEPTH = 2;
const LOGO_RING_MIN_SAMPLES = 8;
/** Внутрь от края bbox: запасная зона для цвета «внутри» (на широких баннерах часто всё ещё рамка). */
const LOGO_PLATE_INSET_FRAC = 0.065;
const LOGO_PLATE_MIN_SAMPLES = 48;
/** Центр bbox: квадрат со стороной frac×min(bw,bh) — цвет плашки под маркой без полей рамки. */
const LOGO_CORE_FRAC_OF_MIN = 0.34;
const LOGO_CORE_MIN_SAMPLES = 18;
/** Пиксели темнее этого (L) считаем «фоном плашки», не светлым полем/ореолом вокруг текста. */
const LOGO_INNER_BG_LUM_MAX = 108;
const LOGO_INNER_DARK_MIN_SAMPLES = 6;
/** Кромка vs плашка: после mean по кольцу легко слиться с разбавленным core; порог ниже. */
const LOGO_TWO_TONE_MIN_RGB_DIST = 8;
/** Полоса у края bbox для подмены светлой рамки на цвет плашки (широкие тизеры). */
const LOGO_FLATTEN_BAND_FRAC = 0.2;
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
 * Самый частый цвет по четырём квадратам side×side (side ≤ 32) в углах opaque bbox.
 * Совпадает со схемой «патчи в четырёх углах»; для целого тизера bbox = весь непрозрачный прямоугольник.
 * @returns {{ r: number; g: number; b: number; n: number } | null}
 */
function dominantRgbFromFourCornerPatches32Bbox(rawBuf, W, minX, maxX, minY, maxY) {
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const side = Math.min(LOGO_EDGE_PATCH_SIDE, bw, bh);
  if (side < 2) return null;

  const q = LOGO_EDGE_PATCH_QUANT;
  const keyOf = (r, g, b) => {
    const rq = Math.round(Math.min(255, Math.max(0, r)) / q) * q;
    const gq = Math.round(Math.min(255, Math.max(0, g)) / q) * q;
    const bq = Math.round(Math.min(255, Math.max(0, b)) / q) * q;
    return ((rq & 255) << 16) | ((gq & 255) << 8) | (bq & 255);
  };

  const counts = new Map();
  const addRect = (x0, y0) => {
    let xa = x0;
    let ya = y0;
    if (xa < minX) xa = minX;
    if (ya < minY) ya = minY;
    if (xa > maxX - side + 1) xa = maxX - side + 1;
    if (ya > maxY - side + 1) ya = maxY - side + 1;
    const x1 = xa + side;
    const y1 = ya + side;
    for (let y = ya; y < y1; y++) {
      for (let x = xa; x < x1; x++) {
        const i = (y * W + x) * 4;
        if (rawBuf[i + 3] < LOGO_EDGE_ALPHA_MIN) continue;
        const k = keyOf(rawBuf[i], rawBuf[i + 1], rawBuf[i + 2]);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
  };

  addRect(minX, minY);
  addRect(maxX - side + 1, minY);
  addRect(minX, maxY - side + 1);
  addRect(maxX - side + 1, maxY - side + 1);

  let total = 0;
  for (const n of counts.values()) total += n;
  if (total < LOGO_EDGE_PATCH_MIN_SAMPLES) return null;

  let bestK = 0;
  let bestN = -1;
  for (const [k, n] of counts) {
    if (n > bestN) {
      bestN = n;
      bestK = k;
    }
  }
  return {
    r: (bestK >> 16) & 255,
    g: (bestK >> 8) & 255,
    b: bestK & 255,
    n: total
  };
}

/** @returns {{ sr: number; sg: number; sb: number; n: number }} */
function emptyMeanAcc() {
  return { sr: 0, sg: 0, sb: 0, n: 0 };
}

function meanAccToRgb(acc, minN) {
  if (acc.n < minN) return null;
  return {
    r: Math.max(0, Math.min(255, Math.round(acc.sr / acc.n))),
    g: Math.max(0, Math.min(255, Math.round(acc.sg / acc.n))),
    b: Math.max(0, Math.min(255, Math.round(acc.sb / acc.n)))
  };
}

function addPixelToMean(acc, rawBuf, i, skipWhiteInk) {
  if (rawBuf[i + 3] < LOGO_EDGE_ALPHA_MIN) return;
  const r = rawBuf[i];
  const gch = rawBuf[i + 1];
  const b = rawBuf[i + 2];
  if (skipWhiteInk && logoLuminance(r, gch, b) >= LOGO_LUM_WHITE_INK) return;
  acc.sr += r;
  acc.sg += gch;
  acc.sb += b;
  acc.n++;
}

/** Только тёмный фон плашки (отсекаем белый текст и светлые серые поля в core/plate). */
function addPixelToMeanInnerBg(acc, rawBuf, i) {
  if (rawBuf[i + 3] < LOGO_EDGE_ALPHA_MIN) return;
  const r = rawBuf[i];
  const gch = rawBuf[i + 1];
  const b = rawBuf[i + 2];
  const L = logoLuminance(r, gch, b);
  if (L >= LOGO_LUM_WHITE_INK) return;
  if (L > LOGO_INNER_BG_LUM_MAX) return;
  acc.sr += r;
  acc.sg += gch;
  acc.sb += b;
  acc.n++;
}

/**
 * Анализ **только** растра с Logo.dev (как пришёл с CDN), до сборки 1200×630.
 * Opaque bbox, угловые 32×32, two-tone и т.д. — всё в координатах этого файла, не готового баннера.
 * @param {import('sharp')} sharp
 * @param {ArrayBuffer | Buffer} logoBuffer — байты ответа img.logo.dev (webp/png)
 * @returns {Promise<{ canvasBg: { r: number; g: number; b: number }; source: string; processedBuffer: Buffer } | null>}
 */
async function prepareCompanyLogoCanvasAndRaster(sharp, logoBuffer) {
  const buf = Buffer.from(logoBuffer);
  let W;
  let H;
  let raw;
  try {
    let out;
    try {
      out = await sharp(buf).ensureAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
    } catch {
      out = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    }
    W = out.info.width;
    H = out.info.height;
    if (!W || !H || out.data.length !== W * H * 4) {
      console.warn('[MEDIA] company cover: logo raw/buffer dimension mismatch');
      return null;
    }
    raw = Buffer.from(out.data);
  } catch (e) {
    console.warn('[MEDIA] company cover: logo raster decode failed:', e?.message || e);
    return null;
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
  const ringAcc = emptyMeanAcc();
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = Math.min(x - minX, maxX - x, y - minY, maxY - y);
      if (d < LOGO_SOLID_RING_DEPTH) addPixelToMean(ringAcc, raw, (y * W + x) * 4, false);
    }
  }

  const inset = Math.max(3, Math.floor(Math.min(bw, bh) * LOGO_PLATE_INSET_FRAC));
  const plateAcc = emptyMeanAcc();
  const plateInnerDarkAcc = emptyMeanAcc();
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = Math.min(x - minX, maxX - x, y - minY, maxY - y);
      if (d >= inset) {
        const idx = (y * W + x) * 4;
        addPixelToMean(plateAcc, raw, idx, true);
        addPixelToMeanInnerBg(plateInnerDarkAcc, raw, idx);
      }
    }
  }

  const coreSide = Math.max(8, Math.floor(Math.min(bw, bh) * LOGO_CORE_FRAC_OF_MIN));
  const halfCore = Math.floor(coreSide / 2);
  const cx = Math.floor((minX + maxX) / 2);
  const cy = Math.floor((minY + maxY) / 2);
  const coreAcc = emptyMeanAcc();
  const coreInnerDarkAcc = emptyMeanAcc();
  for (let y = cy - halfCore; y <= cy + halfCore; y++) {
    if (y < minY || y > maxY) continue;
    for (let x = cx - halfCore; x <= cx + halfCore; x++) {
      if (x < minX || x > maxX) continue;
      const idx = (y * W + x) * 4;
      addPixelToMean(coreAcc, raw, idx, true);
      addPixelToMeanInnerBg(coreInnerDarkAcc, raw, idx);
    }
  }

  const ringN = ringAcc.n;
  const ringOuterRgb = meanAccToRgb(ringAcc, LOGO_RING_MIN_SAMPLES);
  const edgeDom = dominantRgbFromFourCornerPatches32Bbox(raw, W, minX, maxX, minY, maxY);
  const outerRgb = edgeDom
    ? { r: edgeDom.r, g: edgeDom.g, b: edgeDom.b }
    : ringOuterRgb;
  const outerSampleN = edgeDom ? edgeDom.n : ringN;

  const plateRgb = meanAccToRgb(plateAcc, LOGO_PLATE_MIN_SAMPLES);
  const coreRgb = meanAccToRgb(coreAcc, LOGO_CORE_MIN_SAMPLES);
  const coreInnerDarkRgb = meanAccToRgb(coreInnerDarkAcc, LOGO_INNER_DARK_MIN_SAMPLES);
  const plateInnerDarkRgb = meanAccToRgb(plateInnerDarkAcc, LOGO_INNER_DARK_MIN_SAMPLES);

  if (!outerRgb) {
    const anyAcc = emptyMeanAcc();
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        addPixelToMean(anyAcc, raw, (y * W + x) * 4, false);
      }
    }
    const rgb = meanAccToRgb(anyAcc, 1);
    if (!rgb) return null;
    const processedBuffer = await sharp(raw, sharpRawRgbaInput(W, H))
      .webp(COMPANY_LOGO_PIPELINE_WEBP)
      .toBuffer();
    return { canvasBg: rgb, source: 'solid-bbox-fallback-mode', processedBuffer };
  }

  let innerRgb = null;
  if (coreInnerDarkRgb) {
    innerRgb = coreInnerDarkRgb;
  } else if (coreRgb) {
    innerRgb = coreRgb;
  } else if (plateInnerDarkRgb) {
    innerRgb = plateInnerDarkRgb;
  } else if (plateRgb) {
    innerRgb = plateRgb;
  }

  const twoTone =
    innerRgb &&
    outerRgb &&
    (outerSampleN >= LOGO_RING_MIN_SAMPLES || ringN >= LOGO_RING_MIN_SAMPLES) &&
    Math.sqrt(
      rgbDistSq(outerRgb.r, outerRgb.g, outerRgb.b, innerRgb.r, innerRgb.g, innerRgb.b)
    ) >= LOGO_TWO_TONE_MIN_RGB_DIST;

  if (twoTone && innerRgb) {
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
        const dIn = rgbDistSq(r, gch, b, innerRgb.r, innerRgb.g, innerRgb.b);
        if (dOut <= dIn + 200) {
          raw[i] = innerRgb.r;
          raw[i + 1] = innerRgb.g;
          raw[i + 2] = innerRgb.b;
        }
      }
    }
    const processedBuffer = await sharp(raw, sharpRawRgbaInput(W, H))
      .webp(COMPANY_LOGO_PIPELINE_WEBP)
      .toBuffer();
    return {
      canvasBg: { r: innerRgb.r, g: innerRgb.g, b: innerRgb.b },
      source: 'solid-two-tone-flatten-plate',
      processedBuffer
    };
  }

  if (outerRgb) {
    const processedBuffer = await sharp(raw, sharpRawRgbaInput(W, H))
      .webp(COMPANY_LOGO_PIPELINE_WEBP)
      .toBuffer();
    return {
      canvasBg: { r: outerRgb.r, g: outerRgb.g, b: outerRgb.b },
      source: edgeDom ? 'solid-corners32-dominant' : 'solid-ring-mean-srgb',
      processedBuffer
    };
  }

  const anyAcc = emptyMeanAcc();
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      addPixelToMean(anyAcc, raw, (y * W + x) * 4, false);
    }
  }
  const rgb = meanAccToRgb(anyAcc, 1);
  if (!rgb) return null;
  const processedBuffer = await sharp(raw, sharpRawRgbaInput(W, H))
    .webp(COMPANY_LOGO_PIPELINE_WEBP)
    .toBuffer();
  return { canvasBg: rgb, source: 'solid-bbox-fallback-mode', processedBuffer };
}

/**
 * Собрать OG-баннер: сначала `prepareCompanyLogoCanvasAndRaster(logoBuffer)` по **исходному** лого с Logo.dev,
 * затем resize + заливка холста. Готовый webp нигде не читается для выбора фона.
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
    .webp(COMPANY_LOGO_PIPELINE_WEBP)
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
    .webp(COMPANY_COVER_OUTPUT_WEBP)
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
