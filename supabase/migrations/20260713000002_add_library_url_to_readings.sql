-- Identifica de qual URL da Ad Library veio cada leitura, permitindo
-- analise separada por biblioteca em monitores com varias URLs.
-- NULL = leituras antigas (biblioteca principal).
ALTER TABLE public.readings
  ADD COLUMN IF NOT EXISTS library_url TEXT;

CREATE INDEX IF NOT EXISTS idx_readings_monitor_library
  ON public.readings(monitor_id, library_url);
