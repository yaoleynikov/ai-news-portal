import fetch from 'node-fetch';
import { config } from '../config.js';

/** Native fetch (Node 18+) handles multipart FormData reliably; node-fetch can mis-bind boundaries on some Linux setups. */
const httpFetch = typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : fetch;
import { generateImageAiHorde } from './aihorde-generate.js';
import { loadSharp } from './sharp-loader.js';

/** Final cover dimensions (OG / cards). */
const COVER_WIDTH = 1200;
const COVER_HEIGHT = 630;

const CF_FLUX2_KLEIN_MODEL = '@cf/black-forest-labs/flux-2-klein-4b';

/** Max prompt length for Workers AI image models (safe vs API limits). */
const CF_IMAGE_PROMPT_MAX_CHARS = 2000;

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


/**
 * Company cover: сырой ответ img.logo.dev без композита на воркере.
 * Подложка/тинт — фронт: cover-edge-frame.ts, cover-edge-color.server.ts.
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
      const buffer = Buffer.from(buf);
      const ct = (response.headers.get('content-type') || '').toLowerCase();
      let contentType = 'image/webp';
      let extension = 'webp';
      if (ct.includes('png')) {
        contentType = 'image/png';
        extension = 'png';
      } else if (ct.includes('jpeg') || ct.includes('jpg')) {
        contentType = 'image/jpeg';
        extension = 'jpg';
      }
      console.log(`[MEDIA] company cover: Logo.dev passthrough for ${domain} (${contentType})`);
      return { buffer, contentType, extension };
    } catch (e) {
      lastErr = e;
      console.warn(`[MEDIA] company cover: img.logo.dev/${domain} failed — ${e.message}`);
    }
  }

  throw new Error(
    `Logo.dev failed for [${candidates.join(', ')}] — last: ${lastErr?.message ?? 'unknown'} (use a publishable pk_ token; sk_ often returns 401 on img CDN)`
  );
}

/**
 * Plain-text slice from article for abstract image when there is no good cover_keyword
 * (e.g. company/logo path failed and we must still generate a hero).
 * @param {string} [title]
 * @param {string} [content_md]
 * @returns {string | null} null if too thin to prompt safely
 */
export function buildAbstractFallbackKeywordFromArticle(title, content_md) {
  const plain = String(content_md || '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
  const t = String(title || '').trim();
  const s = `${t}. ${plain}`.trim();
  if (s.length < 55) return null;
  return s.slice(0, 480);
}

/**
 * Shared text-to-image brief: HF uses a single string; AI Horde uses positive###negative.
 * @param {string} keyword
 */
export function buildAbstractImagePrompt(keyword) {
  const positive = [
    'Editorial news photography, photorealistic, natural daylight or soft indoor light,',
    'contemporary real world 2020s setting.',
    'Depict the concrete subject in the brief — do not replace it with an unrelated generic stock scene',
    '(laptop on desk, coffee mug, hands typing, bland open-plan office) unless the brief explicitly describes that.',
    `Brief — no brand logos or readable text: ${keyword}.`,
    'Do not add unrelated sci-fi or fantasy elements unless the brief explicitly requires them.'
  ].join(' ');
  const negative = [
    'science fiction, futuristic armor, cyborgs, robots, holograms, neon cyberpunk,',
    'space stations, glowing wireframe heads, fantasy weapons, abstract particles,',
    'text, typography, words, letters, UI screenshots, app mockups, watermarks, blurry, low quality, deformed hands,',
    'generic unrelated laptop close-up, random coffee cup stock photo, meaningless coworking blur'
  ].join(' ');
  return { positive, negative, hfInputs: `${positive} ${negative}` };
}

/**
 * Crop/resize raw raster to site cover aspect (1200×630 WebP).
 * @param {Buffer} raw
 */
async function finalizeAbstractCoverRasterBuffer(raw) {
  const sharp = await loadSharp();
  if (!sharp) {
    console.warn('[MEDIA] abstract cover: no sharp — using raw image as PNG (no resize/WebP)');
    return { buffer: raw, contentType: 'image/png', extension: 'png' };
  }
  const coverBuffer = await sharp(raw)
    .resize(COVER_WIDTH, COVER_HEIGHT, { fit: 'cover' })
    .webp({ quality: 85 })
    .toBuffer();
  return { buffer: coverBuffer, contentType: 'image/webp', extension: 'webp' };
}

/**
 * Abstract cover via Cloudflare Workers AI — FLUX.2 Klein 4b (multipart REST).
 * @see https://developers.cloudflare.com/workers-ai/models/flux-2-klein-4b/
 */
async function generateAbstractCoverCloudflareKlein(keyword) {
  const accountId = config.ai.cloudflareAccountId;
  const token = config.ai.cloudflareApiToken;
  if (!accountId || !token) {
    throw new Error('Cloudflare Workers AI: set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN');
  }

  const promptFull = buildAbstractImagePrompt(keyword).hfInputs;
  const prompt =
    promptFull.length > CF_IMAGE_PROMPT_MAX_CHARS
      ? `${promptFull.slice(0, CF_IMAGE_PROMPT_MAX_CHARS - 1)}…`
      : promptFull;

  const w = config.ai.flux2KleinWidth;
  const h = config.ai.flux2KleinHeight;
  const steps = config.ai.flux2KleinSteps;

  const form = new FormData();
  form.append('prompt', prompt);
  form.append('width', String(w));
  form.append('height', String(h));
  form.append('steps', String(steps));

  // Model name must stay literal in the path (encoding breaks routing: "No route for that URI").
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CF_FLUX2_KLEIN_MODEL}`;

  console.log(
    `[MEDIA] Cloudflare Workers AI abstract cover (${CF_FLUX2_KLEIN_MODEL} ${w}×${h}, steps=${steps})…`
  );

  const response = await httpFetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: form
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Cloudflare AI: non-JSON response HTTP ${response.status}: ${text.slice(0, 280)}`);
  }

  if (!json.success) {
    const msg =
      (Array.isArray(json.errors) && json.errors.map((e) => e?.message || e).join('; ')) ||
      json.messages?.join?.('; ') ||
      text.slice(0, 400);
    throw new Error(`Cloudflare AI error HTTP ${response.status}: ${msg}`);
  }

  let imageB64 = '';
  if (json.result && typeof json.result === 'object' && typeof json.result.image === 'string') {
    imageB64 = json.result.image.trim();
  } else if (typeof json.result === 'string') {
    imageB64 = json.result.trim();
  }
  if (!imageB64) {
    const hint =
      json.result && typeof json.result === 'object'
        ? Object.keys(json.result).join(',')
        : typeof json.result;
    throw new Error(`Cloudflare AI: missing image in result (${hint})`);
  }

  let raw;
  try {
    raw = Buffer.from(imageB64, 'base64');
  } catch (e) {
    throw new Error(`Cloudflare AI: invalid base64 image (${e?.message || e})`);
  }
  if (!raw.length) {
    throw new Error('Cloudflare AI: empty image buffer');
  }

  console.log(`[MEDIA] Cloudflare FLUX.2 Klein: received ${raw.length} bytes → cover resize`);
  return finalizeAbstractCoverRasterBuffer(raw);
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
  const prompt = buildAbstractImagePrompt(keyword).hfInputs;

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
      const raw = Buffer.from(imageBlob);
      return finalizeAbstractCoverRasterBuffer(raw);
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
 * Abstract cover via AI Horde (free GPU pool), then optional HF FLUX fallback.
 */
async function generateAbstractCoverAiHorde(keyword) {
  const apiKey = config.ai.aihordeKey?.trim();
  if (!apiKey) {
    throw new Error('AIHORDE_API_KEY is not configured');
  }
  const { positive, negative } = buildAbstractImagePrompt(keyword);
  const promptFull = `${positive}###${negative}`;

  console.log(
    `[MEDIA] AI Horde abstract cover (models: ${config.ai.aihordeModels.join(' → ')})…`
  );

  const raw = await generateImageAiHorde(promptFull, {
    baseUrl: config.ai.aihordeBaseUrl,
    apiKey,
    clientAgent: config.ai.aihordeClientAgent,
    pollMs: config.ai.aihordePollMs,
    perAttemptMs: config.ai.aihordePerModelMs,
    models: config.ai.aihordeModels
  });

  return finalizeAbstractCoverRasterBuffer(raw);
}

/**
 * Generates an abstract featured image using FLUX.1-schnell via HF API.
 * Retries 503 on the same key; on quota-style HTTP errors tries HF_API_KEY2 if set.
 */
async function generateAbstractCoverHf(keyword) {
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

let warnedCloudflareAbstractMissing = false;

async function generateAbstractCover(keyword) {
  const kw = String(keyword ?? '').replace(/\s+/g, ' ').trim();
  const brief = buildAbstractImagePrompt(keyword).hfInputs;
  const kwMax = 500;
  const briefMax = 1400;
  console.log(
    `[MEDIA] abstract cover — image prompt (cover_keyword ${kw.length} chars, full brief ${brief.length} chars):\n` +
      `  cover_keyword: ${kw.slice(0, kwMax)}${kw.length > kwMax ? '…' : ''}\n` +
      `  model_brief: ${brief.slice(0, briefMax)}${brief.length > briefMax ? '…' : ''}`
  );

  const cfOk = Boolean(config.ai.cloudflareAccountId?.trim() && config.ai.cloudflareApiToken?.trim());
  if (!cfOk && !warnedCloudflareAbstractMissing) {
    warnedCloudflareAbstractMissing = true;
    console.warn(
      '[MEDIA] Cloudflare Workers AI не настроен (CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN в backend/.env) — abstract-обложки идут через AI Horde / HF'
    );
  }
  if (cfOk) {
    try {
      return await generateAbstractCoverCloudflareKlein(keyword);
    } catch (err) {
      console.warn('[MEDIA] Cloudflare FLUX.2 Klein failed:', err.message || err);
    }
  }

  const hordeKey = config.ai.aihordeKey?.trim();
  if (hordeKey) {
    try {
      return await generateAbstractCoverAiHorde(keyword);
    } catch (err) {
      console.warn('[MEDIA] AI Horde failed:', err.message || err);
      const keys = hfBearerKeys();
      if (keys.length > 0) {
        console.warn('[MEDIA] Falling back to Hugging Face FLUX…');
        return await generateAbstractCoverHf(keyword);
      }
      throw err;
    }
  }

  return await generateAbstractCoverHf(keyword);
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

/** Last-resort brief when article text is too short to derive a scene (no hard tie to any one story). */
export const FALLBACK_ABSTRACT_COVER_KEYWORD =
  'documentary-style technology news photograph, real industrial or engineering setting with visible equipment or infrastructure, natural light, editorial mood, no logos or readable text';

/**
 * Company/logo covers often fail (401, missing domain). Fall back to abstract image like the dev pipeline.
 * @param {{ title?: string, content_md?: string }} [articleContext] If company cover fails, used to build the abstract brief from the story instead of the generic last resort.
 * @returns {Promise<{ buffer: Buffer, contentType: string, extension: string, cover_fallback?: boolean, abstract_keyword_used?: string }>}
 */
export async function generateCoverWithFallback(coverType, coverKeyword, articleContext) {
  try {
    return await generateCover(coverType, coverKeyword);
  } catch (err) {
    if (coverType === 'company') {
      console.warn(
        '[MEDIA] company cover failed → abstract image fallback (Cloudflare Klein / AI Horde / HF; fix Logo.dev if company logos matter):',
        err.message
      );
      const fromArticle = buildAbstractFallbackKeywordFromArticle(
        articleContext?.title,
        articleContext?.content_md
      );
      const abstractKw = fromArticle ?? FALLBACK_ABSTRACT_COVER_KEYWORD;
      if (fromArticle) {
        console.log('[MEDIA] abstract fallback prompt derived from article title/body (chars=%s)', fromArticle.length);
      }
      const out = await generateCover('abstract', abstractKw);
      return { ...out, cover_fallback: true, abstract_keyword_used: abstractKw };
    }
    throw err;
  }
}

