-- Card summary + stable editorial section for SEO (/rubric/*) and JSON-LD.
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS dek TEXT,
  ADD COLUMN IF NOT EXISTS primary_rubric TEXT;

COMMENT ON COLUMN public.articles.dek IS 'Plain-text deck for listings, meta description, RSS; 1–2 sentences, no Markdown.';
COMMENT ON COLUMN public.articles.primary_rubric IS 'One of: ai | hardware | open-source | other — matches site nav sections.';

CREATE INDEX IF NOT EXISTS articles_primary_rubric_idx ON public.articles (primary_rubric)
  WHERE primary_rubric IS NOT NULL AND status = 'published';
