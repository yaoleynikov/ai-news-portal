-- Чтение опубликованных статей с фронта (anon key в Astro / Vercel).
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read published articles" ON public.articles;

CREATE POLICY "Allow public read published articles"
  ON public.articles
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- service_role (воркер) обходит RLS и по-прежнему может INSERT/UPDATE всё.
