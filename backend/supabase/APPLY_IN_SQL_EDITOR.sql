-- =============================================================================
-- SiliconFeed: полная схема для Supabase SQL Editor
-- =============================================================================
-- Вставьте ВЕСЬ этот файл в Dashboard → SQL → New query → Run.
-- НЕ вставляйте сюда команды вроде "npm run ..." — это не SQL.
-- =============================================================================

-- --- 0001_initial_schema.sql ---
-- Enable pgvector extension for similarity search
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Articles table to store all aggregated news
CREATE TABLE IF NOT EXISTS public.articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    source_url TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content_md TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}'::TEXT[],
    cover_url TEXT,
    cover_type TEXT, -- 'company' or 'abstract'
    embedding vector(384), -- Dimension for all-MiniLM-L6-v2
    status TEXT DEFAULT 'published'::TEXT NOT NULL
);

-- Index for scalable cosine similarity search using pgvector
CREATE INDEX IF NOT EXISTS articles_embedding_idx ON public.articles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Queue table for the sequential worker
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    url TEXT UNIQUE NOT NULL,
    source_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending'::TEXT NOT NULL, -- pending, processing, completed, failed
    error_log TEXT,
    attempts INTEGER DEFAULT 0 NOT NULL,
    locked_until TIMESTAMP WITH TIME ZONE
);

-- Index to quickly find pending jobs
CREATE INDEX IF NOT EXISTS jobs_status_idx ON public.jobs (status) WHERE status = 'pending';

-- RPC Function for Cosine Similarity search (Internal Linking / Semantic Search)
CREATE OR REPLACE FUNCTION match_articles (
  query_embedding vector(384),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  title text,
  cover_url text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    articles.id,
    articles.title,
    articles.cover_url,
    1 - (articles.embedding <=> query_embedding) AS similarity
  FROM articles
  WHERE 1 - (articles.embedding <=> query_embedding) > match_threshold
    AND articles.status = 'published'
  ORDER BY articles.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- --- 0002_seo_prop_data.sql ---
-- Add Proprietary SEO Data to the Articles Table
ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS faq jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS entities jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS sentiment integer DEFAULT 5;

-- --- 0003_jobs_updated_at.sql ---
-- Last mutation time for jobs (stuck recovery uses this, not created_at).
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

UPDATE public.jobs
SET updated_at = created_at;

CREATE OR REPLACE FUNCTION public.jobs_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_set_updated_at ON public.jobs;
CREATE TRIGGER jobs_set_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE PROCEDURE public.jobs_set_updated_at();

-- --- 0004_match_articles_hardening.sql ---
-- Dedup RPC: ignore articles without embedding; explicit execute for API roles.
CREATE OR REPLACE FUNCTION public.match_articles (
  query_embedding vector(384),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  title text,
  cover_url text,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    a.id,
    a.title,
    a.cover_url,
    (1 - (a.embedding <=> query_embedding))::float AS similarity
  FROM public.articles a
  WHERE a.embedding IS NOT NULL
    AND a.status = 'published'
    AND (1 - (a.embedding <=> query_embedding)) > match_threshold
  ORDER BY a.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_articles(vector(384), double precision, integer) TO service_role;

-- --- 0005_dequeue_next_job.sql ---
-- Single-row atomic job claim (FOR UPDATE SKIP LOCKED). Use from worker via supabase.rpc('dequeue_next_job').
CREATE OR REPLACE FUNCTION public.dequeue_next_job()
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.jobs;
BEGIN
  UPDATE public.jobs j
  SET
    status = 'processing',
    attempts = j.attempts + 1,
    updated_at = timezone('utc'::text, now())
  WHERE j.id = (
    SELECT j2.id
    FROM public.jobs j2
    WHERE j2.status = 'pending'
    ORDER BY j2.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO result;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dequeue_next_job() TO service_role;

-- --- 0006_articles_slug.sql ---
-- Public URL slug for /news/[slug] (frontend); Telegram / indexing should use this, not /article/[uuid].
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS articles_slug_unique
  ON public.articles (lower(btrim(slug)))
  WHERE slug IS NOT NULL AND btrim(slug) <> '';

-- --- 0007_articles_public_read_rls.sql ---
-- Чтение опубликованных статей с фронта (anon key в Astro / Vercel).
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read published articles" ON public.articles;

CREATE POLICY "Allow public read published articles"
  ON public.articles
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- --- 0008_worker_publish_limits.sql ---
-- Runtime caps for the worker (Telegram bot can update). Defaults ~30/day, 2/hour.
CREATE TABLE IF NOT EXISTS public.worker_publish_limits (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  per_hour integer NOT NULL DEFAULT 2,
  per_day integer NOT NULL DEFAULT 30,
  cap_sleep_ms integer NOT NULL DEFAULT 600000,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.worker_publish_limits (id, per_hour, per_day, cap_sleep_ms)
VALUES (1, 2, 30, 600000)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.worker_publish_limits ENABLE ROW LEVEL SECURITY;
