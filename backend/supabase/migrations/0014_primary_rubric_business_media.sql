-- Expanded primary_rubric vocabulary for nav + SEO (/rubric/business, /rubric/media).
COMMENT ON COLUMN public.articles.primary_rubric IS
  'One of: ai | hardware | open-source | security | energy | business | media | other — matches site nav /rubric/* sections.';
