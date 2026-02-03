-- Create kanban_columns table for custom column configuration
CREATE TABLE public.kanban_columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own columns"
ON public.kanban_columns
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own columns"
ON public.kanban_columns
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own columns"
ON public.kanban_columns
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own columns"
ON public.kanban_columns
FOR DELETE
USING (auth.uid() = user_id);

-- Remove the check constraint on monitors.test_status since we'll use dynamic column IDs
ALTER TABLE public.monitors DROP CONSTRAINT IF EXISTS monitors_test_status_check;