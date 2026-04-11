import fetch from 'node-fetch';

const DEFAULT_BASE = 'https://aihorde.net/api/v2';

/**
 * Horde: low-kudos accounts cannot run jobs above 762×762 (longest side > 762) or heavy step counts.
 * SDXL / many checkpoints require width & height divisible by 64 — Horde returns "Input payload validation failed" otherwise.
 * We use 704 (11×64) as max long side; final cover is still 1200×630 via Sharp.
 */
const HORDE_MAX_SIDE_LOW_KUDOS = 704;

/** @typedef {{ width: number, height: number, steps: number, cfg_scale: number, sampler_name: string, clip_skip?: number }} HordeParamPreset */

function roundDimension64(n) {
  const x = Math.floor(Number(n) / 64) * 64;
  return Math.max(64, x);
}

/** @param {HordeParamPreset} preset */
function clampPresetDimensions(preset) {
  let w0 = preset.width;
  let h0 = preset.height;
  let m = Math.max(w0, h0);
  if (m > HORDE_MAX_SIDE_LOW_KUDOS) {
    const scale = HORDE_MAX_SIDE_LOW_KUDOS / m;
    w0 *= scale;
    h0 *= scale;
  }
  let width = roundDimension64(w0);
  let height = roundDimension64(h0);
  m = Math.max(width, height);
  if (m > HORDE_MAX_SIDE_LOW_KUDOS) {
    const scale = HORDE_MAX_SIDE_LOW_KUDOS / m;
    width = roundDimension64(width * scale);
    height = roundDimension64(height * scale);
  }
  return { width, height };
}

/** Model-specific params. Sizes are multiples of 64; long side ≤ 704. */
const MODEL_PRESETS = {
  'Juggernaut XL': {
    width: 704,
    height: 448,
    steps: 28,
    cfg_scale: 7,
    sampler_name: 'k_dpmpp_2m',
    clip_skip: 1
  },
  'Deliberate 3.0': {
    width: 640,
    height: 448,
    steps: 28,
    cfg_scale: 7,
    sampler_name: 'k_dpmpp_2m',
    clip_skip: 1
  },
  'Realistic Vision': {
    width: 640,
    height: 448,
    steps: 28,
    cfg_scale: 7,
    sampler_name: 'k_dpmpp_2m',
    clip_skip: 1
  },
  'AlbedoBase XL (SDXL)': {
    width: 704,
    height: 448,
    steps: 28,
    cfg_scale: 7,
    sampler_name: 'k_dpmpp_2m',
    clip_skip: 1
  },
  'Flux.1-Schnell fp8 (Compact)': {
    width: 704,
    height: 448,
    steps: 4,
    cfg_scale: 2,
    sampler_name: 'k_euler',
    clip_skip: 1
  }
};

function presetForModel(modelName) {
  const exact = MODEL_PRESETS[modelName];
  if (exact) return exact;
  const lower = modelName.toLowerCase();
  if (lower.includes('flux')) return MODEL_PRESETS['Flux.1-Schnell fp8 (Compact)'];
  if (lower.includes('xl') || lower.includes('sdxl')) {
    return MODEL_PRESETS['Juggernaut XL'];
  }
  return MODEL_PRESETS['Deliberate 3.0'];
}

function hordeHeaders(apiKey, clientAgent) {
  return {
    'Content-Type': 'application/json',
    apikey: apiKey,
    'Client-Agent': clientAgent
  };
}

async function hordeJson(url, options, apiKey, clientAgent) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...hordeHeaders(apiKey, clientAgent),
      ...options.headers
    }
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = j.message || j.rc || res.statusText || `HTTP ${res.status}`;
    const err = new Error(`AI Horde ${url}: ${msg}`);
    err.hordeStatus = res.status;
    err.hordeBody = j;
    throw err;
  }
  return j;
}

/**
 * @param {string} imgField
 * @returns {Promise<Buffer>}
 */
async function imageFieldToBuffer(imgField) {
  const s = String(imgField || '');
  if (!s) throw new Error('empty image field');
  if (/^https?:\/\//i.test(s)) {
    const r = await fetch(s);
    if (!r.ok) throw new Error(`download image HTTP ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
  return Buffer.from(s, 'base64');
}

/**
 * @param {{ baseUrl: string, apiKey: string, clientAgent: string, pollMs: number, perAttemptMs: number, models: string[] }} cfg
 * @param {string} promptFull positive###negative
 */
/** Horde rate-limits async submits (~2/s); space model fallbacks + retry 429. */
const MS_BETWEEN_MODEL_ATTEMPTS = 1200;
const MS_AFTER_RATE_LIMIT = 1600;

export async function generateImageAiHorde(promptFull, cfg) {
  const { baseUrl, apiKey, clientAgent, pollMs, perAttemptMs, models } = cfg;
  let lastErr;
  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi];
    if (mi > 0) {
      await new Promise((r) => setTimeout(r, MS_BETWEEN_MODEL_ATTEMPTS));
    }

    const preset = presetForModel(model);
    const { width, height } = clampPresetDimensions(preset);
    const params = {
      cfg_scale: preset.cfg_scale,
      sampler_name: preset.sampler_name,
      height,
      width,
      steps: preset.steps,
      tiling: false,
      karras: true,
      clip_skip: preset.clip_skip ?? 1,
      n: 1
    };

    const asyncBody = JSON.stringify({
      prompt: promptFull,
      params,
      nsfw: false,
      censor_nsfw: true,
      trusted_workers: true,
      models: [model],
      r2: true,
      replacement_filter: true,
      shared: false,
      slow_workers: false,
      dry_run: false
    });

    try {
      /** @type {Record<string, unknown>} */
      let asyncRes;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          asyncRes = await hordeJson(
            `${baseUrl}/generate/async`,
            { method: 'POST', body: asyncBody },
            apiKey,
            clientAgent
          );
          break;
        } catch (e) {
          if (e.hordeStatus === 429 && attempt === 0) {
            await new Promise((r) => setTimeout(r, MS_AFTER_RATE_LIMIT));
            continue;
          }
          throw e;
        }
      }

      const id = asyncRes.id;
      if (!id) {
        throw new Error(asyncRes.message || 'no job id from AI Horde');
      }

      const deadline = Date.now() + perAttemptMs;
      /** @type {Record<string, unknown>} */
      let check = { finished: 0, done: false, faulted: false };
      while (Date.now() < deadline) {
        check = await hordeJson(
          `${baseUrl}/generate/check/${id}`,
          { method: 'GET' },
          apiKey,
          clientAgent
        ).catch((e) => {
          if (e.hordeStatus === 404) return { finished: 0, faulted: true, _lost: true };
          throw e;
        });

        if (check._lost) {
          throw new Error('job check 404');
        }
        if (check.faulted) {
          throw new Error('generation faulted');
        }
        if (check.is_possible === false) {
          throw new Error(check.message || 'generation impossible for this model');
        }
        if (check.done === true || (typeof check.finished === 'number' && check.finished >= 1)) {
          break;
        }
        await new Promise((r) => setTimeout(r, pollMs));
      }

      if (!(check.done === true || (typeof check.finished === 'number' && check.finished >= 1))) {
        throw new Error(`timeout after ${Math.round(perAttemptMs / 1000)}s (model ${model})`);
      }

      const status = await hordeJson(
        `${baseUrl}/generate/status/${id}`,
        { method: 'GET' },
        apiKey,
        clientAgent
      );
      const gen = status.generations && status.generations[0];
      if (!gen?.img) {
        throw new Error('no generations in status response');
      }
      return await imageFieldToBuffer(gen.img);
    } catch (e) {
      lastErr = e;
      console.warn(`[MEDIA] AI Horde model "${model}" failed:`, e.message || e);
    }
  }
  throw lastErr || new Error('AI Horde: no models tried');
}

export { MODEL_PRESETS, presetForModel };
