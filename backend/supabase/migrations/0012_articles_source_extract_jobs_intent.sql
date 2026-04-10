-- Raw text sent to the rewriter (clipped like rewriter input), for length QA vs content_md.
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS source_extract TEXT;

COMMENT ON COLUMN public.articles.source_extract IS 'Scrape body clipped to rewriter maxChars; used to detect short rewrites and re-queue refresh jobs.';

-- ingest = new URL pipeline; refresh = re-rewrite existing published article (skip semantic dedup, UPDATE row).
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS intent TEXT NOT NULL DEFAULT 'ingest';

COMMENT ON COLUMN public.jobs.intent IS 'ingest: new story; refresh: update existing article by source_url (short-rewrite audit).';
