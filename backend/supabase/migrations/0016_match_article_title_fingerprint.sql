-- Near-duplicate guard: same normalized headline as a recent published story (different source URL).
CREATE OR REPLACE FUNCTION public.match_article_title_fingerprint (
  p_title text,
  p_since_hours int DEFAULT 168
)
RETURNS TABLE (
  id uuid,
  title text
)
LANGUAGE sql
STABLE
AS $$
  WITH k AS (
    SELECT
      lower(
        regexp_replace(trim(coalesce(p_title, '')), '[^a-zA-Z0-9]+', '', 'g')
      ) AS key
  )
  SELECT a.id, a.title
  FROM public.articles a
  CROSS JOIN k
  WHERE a.status = 'published'
    AND k.key IS NOT NULL
    AND length(k.key) >= 28
    AND a.created_at > timezone('utc', now()) - make_interval(hours => greatest(1, coalesce(p_since_hours, 168)))
    AND lower(regexp_replace(trim(a.title), '[^a-zA-Z0-9]+', '', 'g')) = k.key
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.match_article_title_fingerprint(text, int) IS
  'Returns a row if a published article in the lookback window has the same alnum-only title fingerprint (length >= 28).';

GRANT EXECUTE ON FUNCTION public.match_article_title_fingerprint(text, integer) TO service_role;
