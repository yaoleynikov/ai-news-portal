-- Align caps: 2/hour, no daily limit (per_day=0).
UPDATE public.worker_publish_limits
SET
  per_hour = 2,
  per_day = 0,
  updated_at = timezone('utc'::text, now())
WHERE id = 1;
