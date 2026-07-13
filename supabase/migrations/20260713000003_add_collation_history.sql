-- Historico da contagem de repeticoes de cada anuncio ao longo do tempo,
-- para analisar a evolucao ("funil") dos criativos mais escalados.
-- Formato: [{"t": "2026-07-13T00:00:00Z", "c": 42}, ...]
ALTER TABLE public.ad_details
  ADD COLUMN IF NOT EXISTS collation_history JSONB NOT NULL DEFAULT '[]'::jsonb;
