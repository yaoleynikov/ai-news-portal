-- Column default for new rows (IF NOT EXISTS 0008 left old default 30 on some DBs).
ALTER TABLE public.worker_publish_limits
  ALTER COLUMN per_day SET DEFAULT 0;
