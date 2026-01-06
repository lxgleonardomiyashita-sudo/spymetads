-- Create table for saved/favorite monitors (Spy Especial)
CREATE TABLE public.saved_monitors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    monitor_id uuid NOT NULL REFERENCES public.monitors(id) ON DELETE CASCADE,
    notes text,
    priority text DEFAULT 'medium',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, monitor_id)
);

-- Enable RLS
ALTER TABLE public.saved_monitors ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their saved monitors"
ON public.saved_monitors
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can save monitors"
ON public.saved_monitors
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their saved monitors"
ON public.saved_monitors
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their saved monitors"
ON public.saved_monitors
FOR DELETE
USING (auth.uid() = user_id);