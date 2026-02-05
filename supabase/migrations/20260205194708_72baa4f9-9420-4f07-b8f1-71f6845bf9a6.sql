-- Add color column to tags table for custom tag colors
ALTER TABLE public.tags ADD COLUMN color text DEFAULT NULL;

-- Add default colors for existing tags based on their type
UPDATE public.tags SET color = '#a855f7' WHERE type = 'nicho' AND color IS NULL;
UPDATE public.tags SET color = '#3b82f6' WHERE type = 'idioma' AND color IS NULL;
UPDATE public.tags SET color = '#22c55e' WHERE type = 'pais' AND color IS NULL;
UPDATE public.tags SET color = '#f97316' WHERE type = 'custom' AND color IS NULL;