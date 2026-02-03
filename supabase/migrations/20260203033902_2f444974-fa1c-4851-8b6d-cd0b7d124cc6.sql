-- Add website_url and test_status columns to monitors table
ALTER TABLE public.monitors 
ADD COLUMN IF NOT EXISTS website_url TEXT,
ADD COLUMN IF NOT EXISTS test_status TEXT DEFAULT NULL;

-- Add check constraint for valid test_status values
ALTER TABLE public.monitors 
ADD CONSTRAINT monitors_test_status_check 
CHECK (test_status IS NULL OR test_status IN ('backup_para_teste', 'fazendo_ads', 'configuracao', 'pronto', 'em_teste', 'validado', 'nova_leva', 'descartado'));