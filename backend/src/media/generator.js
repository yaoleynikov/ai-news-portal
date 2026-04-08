import fetch from 'node-fetch';
import { config } from '../config.js';
import { loadSharp } from './sharp-loader.js';

/** Final cover dimensions (OG / cards). */
const COVER_WIDTH = 1200;
const COVER_HEIGHT = 630;

/**
 * Logo.dev raster logos are capped around ~800px; request WebP at that size so Sharp rarely upscales.
 * @see https://docs.logo.dev/logo-images/get
 */
const LOGODEV_FETCH_SIZE = 800;

/**
 * Logo box on the cover: match the fetched raster width so a 800px asset is not blown up to 960px (old 0.8×1200).
 * Logo is fit with `contain` inside this rectangle (margins are in the image, not CSS).
 */
const COMPANY_LOGO_BOX_FRAC = LOGODEV_FETCH_SIZE / COVER_WIDTH;

/**
 * Creates a premium glassmorphic background using a raw domain logo
 * via Logo.dev, overlaid perfectly in the center.
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

  const maxLogoW = Math.round(COVER_WIDTH * COMPANY_LOGO_BOX_FRAC);
  const maxLogoH = Math.round(COVER_HEIGHT * COMPANY_LOGO_BOX_FRAC);

  const processedLogo = await sharp(Buffer.from(logoBuffer))
    .resize(maxLogoW, maxLogoH, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
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

/**
 * Generates an abstract featured image using FLUX.1-schnell natively via HF API.
 * Handles 503 retry gracefully due to model cold starts.
 */
async function generateAbstractCover(keyword) {
  if (!config.ai.hfKey) {
    throw new Error('HF_API_KEY is not configured');
  }

  // Strictly enforce photorealistic people/objects, ban text/graphics
  const prompt = `cinematic photorealistic photograph, highly detailed, real physical objects or people, metaphor for: ${keyword}. NO text, NO typography, NO words, NO letters, NO graphic illustrations, NO ui elements. 8k, realistic lighting.`;

  let attempts = 0;
  const maxAttempts = 3;

  const hfModel = "black-forest-labs/FLUX.1-schnell";
  // Legacy https://api-inference.huggingface.co returns 410; router is current.
  const inferenceUrl =
    config.ai.hfInferenceUrl ||
    `https://router.huggingface.co/hf-inference/models/${hfModel}`;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(
        inferenceUrl,
        {
          headers: {
            Authorization: `Bearer ${config.ai.hfKey}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          body: JSON.stringify({ inputs: prompt }),
        }
      );

      // Model is loading (Cold start)
      if (response.status === 503) {
        const result = await response.json();
        const waitTime = result.estimated_time || 20;
        console.log(`[MEDIA] HF Model loading, waiting ${waitTime} seconds... (Attempt ${attempts + 1}/${maxAttempts})`);
        await new Promise(r => setTimeout(r, waitTime * 1000));
        attempts++;
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HF API error: ${response.status} ${errText.slice(0, 240)}`);
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
      console.error(`[MEDIA] Attempt ${attempts + 1} failed:`, err.message);
      attempts++;
      if (attempts >= maxAttempts) throw err;
      await new Promise(r => setTimeout(r, 5000)); // general backoff
    }
  }
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
  'abstract technology innovation neural network light particles cinematic';

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
