import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __configDir = path.dirname(fileURLToPath(import.meta.url));
/** backend/.env — грузим явно, чтобы воркер/Telegram видели ключи при любом process.cwd() (Docker, systemd, запуск из корня репо). */
const backendEnvPath = path.join(__configDir, '..', '.env');
dotenv.config({ path: backendEnvPath });
dotenv.config();

/** Service role JWT only (not the anon key). Alias: SUPABASE_KEY matches common .env layouts. */
function supabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
}

/** Full S3 endpoint URL, or built from R2_ACCOUNT_ID when R2_ENDPOINT is omitted. */
function r2Endpoint() {
  const explicit = process.env.R2_ENDPOINT?.trim();
  if (explicit) return explicit;
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  if (accountId) return `https://${accountId}.r2.cloudflarestorage.com`;
  return undefined;
}

// Export loaded variables securely with defaults
export const config = {
  supabase: {
    url: process.env.SUPABASE_URL || 'https://mock.supabase.co',
    serviceKey: supabaseServiceRoleKey() || 'mock-key',
  },
  ai: {
    openRouterKey: process.env.OPENROUTER_API_KEY,
    openRouterModel: process.env.OPENROUTER_MODEL || 'openrouter/free',
    openRouterHttpReferer: process.env.OPENROUTER_HTTP_REFERER,
    openRouterAppTitle: process.env.OPENROUTER_APP_TITLE,
    hfKey: process.env.HF_API_KEY,
    hfKey2: process.env.HF_API_KEY2,
    hfInferenceUrl: process.env.HF_INFERENCE_URL,
    /** AI Horde (free crowd GPU); abstract covers when set. */
    aihordeKey: process.env.AIHORDE_API_KEY,
    aihordeBaseUrl: (process.env.AIHORDE_API_URL || 'https://aihorde.net/api/v2').replace(/\/$/, ''),
    aihordeClientAgent:
      process.env.AIHORDE_CLIENT_AGENT || 'SiliconFeed:1.0:https://siliconfeed.online',
    aihordeModels: (process.env.AIHORDE_MODELS ||
      'Deliberate 3.0,Flux.1-Schnell fp8 (Compact),Realistic Vision,Juggernaut XL')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    aihordePollMs: Math.min(10000, Math.max(1000, Number(process.env.AIHORDE_POLL_MS) || 2000)),
    aihordePerModelMs: Math.min(
      3600000,
      Math.max(60000, Number(process.env.AIHORDE_PER_MODEL_TIMEOUT_MS) || 900000)
    ),
    /** Cloudflare Workers AI (REST) — FLUX.2 Klein 4b for abstract covers */
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID?.trim(),
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN?.trim(),
    flux2KleinWidth: Math.min(
      2048,
      Math.max(512, Number(process.env.CF_FLUX2_KLEIN_WIDTH) || 1024)
    ),
    flux2KleinHeight: Math.min(
      2048,
      Math.max(512, Number(process.env.CF_FLUX2_KLEIN_HEIGHT) || 1024)
    ),
    flux2KleinSteps: Math.min(50, Math.max(1, Number(process.env.CF_FLUX2_KLEIN_STEPS) || 25)),
  },
  media: {
    // img.logo.dev expects the publishable key (pk_...). Secret keys (sk_...) often return 401 on image CDN.
    logoDevKey:
      process.env.LOGODEV_API_KEY ||
      process.env.LOGO_DEV_PUBLISHABLE_KEY ||
      process.env.LOGO_DEV_TOKEN,
    r2: {
      endpoint: r2Endpoint(),
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      bucket: process.env.R2_BUCKET_NAME || 'siliconfeed-media',
    }
  },
  limits: {
    minChars: 500,
    /** Max raw text length after scrape; higher = more context for the rewriter. */
    maxChars: 14000,
    /** Stricter = fewer near-duplicate stories (embedding match in match_articles). */
    similarityThreshold: 0.88,
  },
  /** Canonical site origin for Telegram / Google links (no trailing slash). */
  publicSiteUrl: (process.env.PUBLIC_SITE_URL || 'https://siliconfeed.online').replace(/\/$/, ''),
};

// Initialize centralized Supabase Client with service role to bypass RLS for background jobs
export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceKey
);
