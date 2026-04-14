-- Raise worker throughput: 3 publishes/hour (per_day unchanged).
UPDATE public.worker_publish_limits
SET
  per_hour = 3,
  updated_at = timezone('utc'::text, now())
WHERE id = 1;
