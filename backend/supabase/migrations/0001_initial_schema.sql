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
