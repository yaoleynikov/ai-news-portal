-- Public URL slug for /news/[slug] (frontend); Telegram / indexing should use this, not /article/[uuid].
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS articles_slug_unique
  ON public.articles (lower(btrim(slug)))
  WHERE slug IS NOT NULL AND btrim(slug) <> '';
