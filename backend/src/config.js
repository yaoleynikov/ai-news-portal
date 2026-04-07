import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Setup environment variables
dotenv.config();

// Export loaded variables securely with defaults
export const config = {
  supabase: {
    url: process.env.SUPABASE_URL || 'https://mock.supabase.co',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key',
  },
  ai: {
    openRouterKey: process.env.OPENROUTER_API_KEY,
    openRouterModel: process.env.OPENROUTER_MODEL || 'openrouter/free',
    hfKey: process.env.HF_API_KEY,
  },
  media: {
    logoDevKey: process.env.LOGODEV_API_KEY,
    r2: {
      endpoint: process.env.R2_ENDPOINT,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      bucket: process.env.R2_BUCKET_NAME || 'siliconfeed-media',
    }
  },
  limits: {
    minChars: 500,
    maxChars: 10000,
    similarityThreshold: 0.85,
  }
};

// Initialize centralized Supabase Client with service role to bypass RLS for background jobs
export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceKey
);
