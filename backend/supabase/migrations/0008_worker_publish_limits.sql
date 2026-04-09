-- Runtime publish caps (overrides .env when row exists). Worker reads via service role; Telegram bot updates.
CREATE TABLE IF NOT EXISTS public.worker_publish_limits (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  per_hour integer NOT NULL DEFAULT 2,
  per_day integer NOT NULL DEFAULT 30,
  cap_sleep_ms integer NOT NULL DEFAULT 600000,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.worker_publish_limits (id, per_hour, per_day, cap_sleep_ms)
VALUES (1, 2, 30, 600000)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.worker_publish_limits ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.worker_publish_limits IS 'SiliconFeed worker: hourly/daily publish caps; service_role bypasses RLS.';
