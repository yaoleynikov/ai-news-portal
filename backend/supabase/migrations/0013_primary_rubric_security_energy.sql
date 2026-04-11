-- Document expanded primary_rubric values (no constraint change; column remains TEXT).
COMMENT ON COLUMN public.articles.primary_rubric IS
  'One of: ai | hardware | open-source | security | energy | other — matches site nav /rubric/* sections.';
