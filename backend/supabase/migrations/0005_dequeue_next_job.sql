-- Single-row atomic job claim (FOR UPDATE SKIP LOCKED). Use from worker via supabase.rpc('dequeue_next_job').
CREATE OR REPLACE FUNCTION public.dequeue_next_job()
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.jobs;
BEGIN
  UPDATE public.jobs j
  SET
    status = 'processing',
    attempts = j.attempts + 1,
    updated_at = timezone('utc'::text, now())
  WHERE j.id = (
    SELECT j2.id
    FROM public.jobs j2
    WHERE j2.status = 'pending'
    ORDER BY j2.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO result;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dequeue_next_job() TO service_role;
