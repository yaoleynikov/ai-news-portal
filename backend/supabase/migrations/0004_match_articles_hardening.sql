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
