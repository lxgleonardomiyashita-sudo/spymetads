
-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Tags table
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('nicho', 'idioma', 'pais', 'custom')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tags"
  ON public.tags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tags"
  ON public.tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags"
  ON public.tags FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags"
  ON public.tags FOR DELETE
  USING (auth.uid() = user_id);

-- Monitors table
CREATE TABLE public.monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ad_library_url TEXT NOT NULL,
  schedule_config JSONB NOT NULL DEFAULT '{"interval": 60, "days": ["mon","tue","wed","thu","fri","sat","sun"], "windows": ["morning","afternoon","evening"]}'::jsonb,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.monitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own monitors"
  ON public.monitors FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own monitors"
  ON public.monitors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own monitors"
  ON public.monitors FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own monitors"
  ON public.monitors FOR DELETE
  USING (auth.uid() = user_id);

-- Monitor Tags junction table
CREATE TABLE public.monitor_tags (
  monitor_id UUID NOT NULL REFERENCES public.monitors(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (monitor_id, tag_id)
);

ALTER TABLE public.monitor_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their monitor tags"
  ON public.monitor_tags FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.monitors WHERE id = monitor_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can create their monitor tags"
  ON public.monitor_tags FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.monitors WHERE id = monitor_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete their monitor tags"
  ON public.monitor_tags FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.monitors WHERE id = monitor_id AND user_id = auth.uid())
  );

-- Readings table (time series data)
CREATE TABLE public.readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id UUID NOT NULL REFERENCES public.monitors(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ads_active_count INTEGER NOT NULL,
  source_method TEXT NOT NULL CHECK (source_method IN ('api', 'public_parse')),
  status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view readings of their monitors"
  ON public.readings FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.monitors WHERE id = monitor_id AND user_id = auth.uid())
  );

CREATE POLICY "System can insert readings"
  ON public.readings FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.monitors WHERE id = monitor_id AND user_id = auth.uid())
  );

-- Create indexes for better query performance
CREATE INDEX idx_monitors_user_id ON public.monitors(user_id);
CREATE INDEX idx_tags_user_id ON public.tags(user_id);
CREATE INDEX idx_readings_monitor_id ON public.readings(monitor_id);
CREATE INDEX idx_readings_timestamp ON public.readings(timestamp DESC);
CREATE INDEX idx_readings_monitor_timestamp ON public.readings(monitor_id, timestamp DESC);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monitors_updated_at
  BEFORE UPDATE ON public.monitors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
