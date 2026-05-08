-- Fix: public.articles may not have updated_at (listing RPCs must not select it).
-- Run this if migration 0017 failed partway or succeeded against an older schema without updated_at.
-- Replaces rubric_page_payload and tag_page_payload only.

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
      a.dek
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
      a.dek
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
