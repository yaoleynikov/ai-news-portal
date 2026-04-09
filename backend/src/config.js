import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Setup environment variables
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
    hfInferenceUrl: process.env.HF_INFERENCE_URL,
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
