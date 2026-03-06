
ALTER TABLE public.monitors
ADD COLUMN extra_ad_library_urls text[] DEFAULT '{}',
ADD COLUMN extra_website_urls text[] DEFAULT '{}';
