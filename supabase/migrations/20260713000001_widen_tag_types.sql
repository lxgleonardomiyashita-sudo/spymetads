-- O frontend ja usa as categorias modelo_funil e faixa_preco,
-- mas o CHECK original da tabela tags nao as permitia.
ALTER TABLE public.tags DROP CONSTRAINT IF EXISTS tags_type_check;
ALTER TABLE public.tags ADD CONSTRAINT tags_type_check
  CHECK (type IN ('nicho', 'idioma', 'pais', 'modelo_funil', 'faixa_preco', 'custom'));
