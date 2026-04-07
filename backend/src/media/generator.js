import fetch from 'node-fetch';
import sharp from 'sharp';
import { config } from '../config.js';

// Extremely important for Intel N100 (4-core): 
// We limit libvips to 1 thread so generating WebP doesn't lag the entire OS.
sharp.concurrency(1);

/**
 * Creates a premium glassmorphic background using a raw domain logo
 * via Logo.dev, overlaid perfectly in the center.
 */
async function generateCompanyCover(domain) {
  if (!config.media.logoDevKey) {
    throw new Error('LOGODEV_API_KEY is not configured');
  }

  // 1. Fetch the logo
  // Logo.dev returns 404 if not found, we should handle it.
  const logoUrl = `https://img.logo.dev/${domain}?token=${config.media.logoDevKey}&size=500&format=png`;
  const response = await fetch(logoUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch logo for domain ${domain}: ${response.status}`);
  }

  const logoBuffer = await response.arrayBuffer();

  // 2. We use sharp to create a sleek dark tech background
  // For an aesthetic glassmorphism effect without a GPU:
  // We'll create a dark gradient-like canvas (we use a solid color base and add noise if possible)
  const width = 1200;
  const height = 630;

  // Enhance the logo size and center it
  const processedLogo = await sharp(Buffer.from(logoBuffer))
    .resize(400, 400, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // Create a base WebP cover
  const coverBuffer = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 } // Tailwind slate-900 like dark tone
    }
  })
    .composite([
      { input: processedLogo, gravity: 'center' } // Place logo strictly in the center
    ])
    .webp({ quality: 85 })
    .toBuffer();

  return coverBuffer;
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

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(
        "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
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
        throw new Error(`HF API error: ${response.status} ${response.statusText}`);
      }

      const imageBlob = await response.arrayBuffer();

      // Convert downloaded image to WebP strictly
      const coverBuffer = await sharp(Buffer.from(imageBlob))
        .resize(1200, 630, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer();

      return coverBuffer;

    } catch (err) {
      console.error(`[MEDIA] Attempt ${attempts + 1} failed:`, err.message);
      attempts++;
      if (attempts >= maxAttempts) throw err;
      await new Promise(r => setTimeout(r, 5000)); // general backoff
    }
  }
}

export async function generateCover(type, keyword) {
  if (type === 'company') {
    return await generateCompanyCover(keyword);
  } else {
    return await generateAbstractCover(keyword);
  }
}
