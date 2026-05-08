-- Server-side listing filters for /rubric/* and /tag/* to avoid fetching TOPIC_LISTING_FETCH_CAP
-- rows over the wire (Supabase egress). Logic mirrors frontend lib/tags.ts + primary_rubric normalization.

CREATE OR REPLACE FUNCTION public.slugify_tag(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT trim(both FROM lower(regexp_replace(coalesce(raw, ''), '\s+', '-', 'g')));
$$;

-- Matches NAV_TOPICS / STORED_RUBRIC_SLUGS; unknown values treated like empty (same as row normalization).
CREATE OR REPLACE FUNCTION public.normalize_primary_rubric_sql(pr text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE lower(trim(coalesce(pr, '')))
    WHEN 'ai' THEN 'ai'
    WHEN 'hardware' THEN 'hardware'
    WHEN 'open-source' THEN 'open-source'
    WHEN 'security' THEN 'security'
    WHEN 'energy' THEN 'energy'
    WHEN 'business' THEN 'business'
    WHEN 'media' THEN 'media'
    WHEN 'other' THEN 'other'
    ELSE ''
  END;
$$;

-- Mirrors articleInRubric() for published rows.
CREATE OR REPLACE FUNCTION public.article_in_rubric_sql(pr text, p_tags text[], topic_slug text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  pr_eff text := public.normalize_primary_rubric_sql(pr);
  ts text := lower(trim(coalesce(topic_slug, '')));
BEGIN
  IF pr_eff <> '' THEN
    RETURN pr_eff = ts;
  END IF;
  IF ts = 'other' THEN
    RETURN NOT EXISTS (
      SELECT 1
      FROM unnest(coalesce(p_tags, '{}'::text[])) AS t
      WHERE public.slugify_tag(t::text) IN (
        'ai', 'hardware', 'security', 'business', 'open-source', 'energy', 'media'
      )
    );
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM unnest(coalesce(p_tags, '{}'::text[])) AS t
    WHERE public.slugify_tag(t::text) = ts
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.article_matches_tag_slug_sql(p_tags text[], topic_slug text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM unnest(coalesce(p_tags, '{}'::text[])) AS t
    WHERE public.slugify_tag(t::text) = lower(trim(coalesce(topic_slug, '')))
  );
$$;

CREATE OR REPLACE FUNCTION public.rubric_page_payload(p_topic_slug text, p_page_num int, p_page_size int)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  ts text := lower(trim(coalesce(p_topic_slug, '')));
  page_n int := greatest(1, coalesce(p_page_num, 1));
  lim int := greatest(1, least(coalesce(p_page_size, 15), 100));
  off int := (page_n - 1) * lim;
  total bigint;
  rows jsonb;
  years jsonb;
  related jsonb;
BEGIN
  IF ts = '' THEN
    RETURN jsonb_build_object(
      'total', 0,
      'rows', '[]'::jsonb,
      'years', '[]'::jsonb,
      'related_sources', '[]'::jsonb
    );
  END IF;

  SELECT COUNT(*) INTO STRICT total
  FROM public.articles a
  WHERE a.status = 'published'
    AND public.article_in_rubric_sql(a.primary_rubric, a.tags, ts);

  SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  INTO rows
  FROM (
    SELECT
      a.id,
      a.slug,
      a.title,
      a.tags,
      a.cover_url,
      a.cover_type,
      a.created_at,
      a.source_url,
      a.sentiment,
      a.status,
      a.primary_rubric,
      a.dek,
      a.updated_at
    FROM public.articles a
    WHERE a.status = 'published'
      AND public.article_in_rubric_sql(a.primary_rubric, a.tags, ts)
    ORDER BY a.created_at DESC
    LIMIT lim OFFSET off
  ) x;

  SELECT coalesce(jsonb_agg(y ORDER BY y DESC), '[]'::jsonb)
  INTO years
  FROM (
    SELECT DISTINCT EXTRACT(YEAR FROM a.created_at)::int AS y
    FROM public.articles a
    WHERE a.status = 'published'
      AND public.article_in_rubric_sql(a.primary_rubric, a.tags, ts)
  ) d(y);

  SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
  INTO related
  FROM (
    SELECT a.tags, a.primary_rubric
    FROM public.articles a
    WHERE a.status = 'published'
      AND public.article_in_rubric_sql(a.primary_rubric, a.tags, ts)
    ORDER BY a.created_at DESC
    LIMIT 400
  ) r;

  RETURN jsonb_build_object(
    'total', total,
    'rows', rows,
    'years', years,
    'related_sources', related
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tag_page_payload(p_tag_slug text, p_page_num int, p_page_size int)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  ts text := lower(trim(coalesce(p_tag_slug, '')));
  page_n int := greatest(1, coalesce(p_page_num, 1));
  lim int := greatest(1, least(coalesce(p_page_size, 15), 100));
  off int := (page_n - 1) * lim;
  total bigint;
  rows jsonb;
  years jsonb;
  related jsonb;
BEGIN
  IF ts = '' THEN
    RETURN jsonb_build_object(
      'total', 0,
      'rows', '[]'::jsonb,
      'years', '[]'::jsonb,
      'related_sources', '[]'::jsonb
    );
  END IF;

  SELECT COUNT(*) INTO STRICT total
  FROM public.articles a
  WHERE a.status = 'published'
    AND public.article_matches_tag_slug_sql(a.tags, ts);

  SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  INTO rows
  FROM (
    SELECT
      a.id,
      a.slug,
      a.title,
      a.tags,
      a.cover_url,
      a.cover_type,
      a.created_at,
      a.source_url,
      a.sentiment,
      a.status,
      a.primary_rubric,
      a.dek,
      a.updated_at
    FROM public.articles a
    WHERE a.status = 'published'
      AND public.article_matches_tag_slug_sql(a.tags, ts)
    ORDER BY a.created_at DESC
    LIMIT lim OFFSET off
  ) x;

  SELECT coalesce(jsonb_agg(y ORDER BY y DESC), '[]'::jsonb)
  INTO years
  FROM (
    SELECT DISTINCT EXTRACT(YEAR FROM a.created_at)::int AS y
    FROM public.articles a
    WHERE a.status = 'published'
      AND public.article_matches_tag_slug_sql(a.tags, ts)
  ) d(y);

  SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
  INTO related
  FROM (
    SELECT a.tags, a.primary_rubric
    FROM public.articles a
    WHERE a.status = 'published'
      AND public.article_matches_tag_slug_sql(a.tags, ts)
    ORDER BY a.created_at DESC
    LIMIT 400
  ) r;

  RETURN jsonb_build_object(
    'total', total,
    'rows', rows,
    'years', years,
    'related_sources', related
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.slugify_tag(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_primary_rubric_sql(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.article_in_rubric_sql(text, text[], text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.article_matches_tag_slug_sql(text[], text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rubric_page_payload(text, int, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tag_page_payload(text, int, int) TO anon, authenticated, service_role;
