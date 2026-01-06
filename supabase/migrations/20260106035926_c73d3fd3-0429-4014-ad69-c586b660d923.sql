-- Create table for individual ad details
CREATE TABLE public.ad_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id UUID NOT NULL REFERENCES public.monitors(id) ON DELETE CASCADE,
  
  -- Ad identification
  ad_archive_id TEXT NOT NULL,
  
  -- Ad dates
  ad_start_date TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Content
  ad_body TEXT,
  ad_title TEXT,
  preview_url TEXT,
  link_url TEXT,
  
  -- Platforms
  platforms TEXT[],
  
  -- Calculated metrics
  days_active INTEGER DEFAULT 0,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  times_seen INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraint to avoid duplicates
  UNIQUE(monitor_id, ad_archive_id)
);

-- Indexes for fast queries
CREATE INDEX idx_ad_details_monitor_id ON public.ad_details(monitor_id);
CREATE INDEX idx_ad_details_ad_archive_id ON public.ad_details(ad_archive_id);
CREATE INDEX idx_ad_details_days_active ON public.ad_details(days_active DESC);
CREATE INDEX idx_ad_details_is_active ON public.ad_details(is_active);

-- Enable RLS
ALTER TABLE public.ad_details ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view ad_details of their monitors"
  ON public.ad_details FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.monitors
    WHERE monitors.id = ad_details.monitor_id
    AND monitors.user_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_ad_details_updated_at
  BEFORE UPDATE ON public.ad_details
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();