-- Add Proprietary SEO Data to the Articles Table
ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS faq jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS entities jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS sentiment integer DEFAULT 5;
