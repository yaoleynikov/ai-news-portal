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
 * Company cover: centered logo with edge padding; logo max extent ≤ 80% of the shorter cover side.
 */
async function generateCompanyCover(domain) {
  if (!config.media.logoDevKey) {
    throw new Error(
      'Logo.dev publishable key missing: set LOGODEV_API_KEY, LOGO_DEV_PUBLISHABLE_KEY, or LOGO_DEV_TOKEN (pk_... for img CDN)'
    );
  }

  const logoUrl = `https://img.logo.dev/${encodeURIComponent(domain)}?token=${config.media.logoDevKey}&size=${LOGODEV_FETCH_SIZE}&format=webp`;
  const response = await fetch(logoUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch logo for domain ${domain}: ${response.status}`);
  }

  const logoBuffer = await response.arrayBuffer();
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

  const processedLogo = await sharp(Buffer.from(logoBuffer))
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
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite([{ input: processedLogo, gravity: 'center' }])
    .webp({ quality: 85 })
    .toBuffer();

  return { buffer: coverBuffer, contentType: 'image/webp', extension: 'webp' };
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
      console.warn('[MEDIA] company cover failed, fallback to abstract:', err.message);
      const out = await generateCover('abstract', FALLBACK_ABSTRACT_COVER_KEYWORD);
      return { ...out, cover_fallback: true };
    }
    throw err;
  }
}
