
-- Step 1: Drop the restrictive status check and add 'suspect' 
ALTER TABLE public.readings DROP CONSTRAINT readings_status_check;
ALTER TABLE public.readings ADD CONSTRAINT readings_status_check 
  CHECK (status = ANY (ARRAY['ok'::text, 'error'::text, 'suspect'::text]));

-- Step 2: Create RPC function for accurate monitor stats (bypasses row limit)
CREATE OR REPLACE FUNCTION public.get_monitor_stats(p_monitor_ids uuid[])
RETURNS TABLE (
  monitor_id uuid,
  max_ads integer,
  total_readings bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    r.monitor_id,
    COALESCE(MAX(r.ads_active_count), 0)::integer as max_ads,
    COUNT(*)::bigint as total_readings
  FROM readings r
  WHERE r.monitor_id = ANY(p_monitor_ids)
    AND r.status = 'ok'
  GROUP BY r.monitor_id;
$$;
