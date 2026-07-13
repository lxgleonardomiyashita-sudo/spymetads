-- Numero de repeticoes (variacoes/copias) de cada anuncio na Ad Library.
-- Quanto maior, mais "escalado" esta o criativo.
ALTER TABLE public.ad_details
  ADD COLUMN IF NOT EXISTS collation_count INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_ad_details_collation_count
  ON public.ad_details(collation_count DESC);
