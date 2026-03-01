
-- Super Groups: group multiple monitors of similar offers for testing workflow
CREATE TABLE public.super_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#8b5cf6',
  test_status TEXT, -- links to kanban_columns.id when in testing
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Junction table: monitors in a super group
CREATE TABLE public.super_group_monitors (
  super_group_id UUID NOT NULL REFERENCES public.super_groups(id) ON DELETE CASCADE,
  monitor_id UUID NOT NULL REFERENCES public.monitors(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (super_group_id, monitor_id)
);

-- Enable RLS
ALTER TABLE public.super_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_group_monitors ENABLE ROW LEVEL SECURITY;

-- RLS policies for super_groups
CREATE POLICY "Users can view their own super groups" ON public.super_groups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own super groups" ON public.super_groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own super groups" ON public.super_groups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own super groups" ON public.super_groups FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for super_group_monitors
CREATE POLICY "Users can view their super group monitors" ON public.super_group_monitors FOR SELECT
  USING (EXISTS (SELECT 1 FROM super_groups WHERE super_groups.id = super_group_monitors.super_group_id AND super_groups.user_id = auth.uid()));
CREATE POLICY "Users can add monitors to their super groups" ON public.super_group_monitors FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM super_groups WHERE super_groups.id = super_group_monitors.super_group_id AND super_groups.user_id = auth.uid()));
CREATE POLICY "Users can remove monitors from their super groups" ON public.super_group_monitors FOR DELETE
  USING (EXISTS (SELECT 1 FROM super_groups WHERE super_groups.id = super_group_monitors.super_group_id AND super_groups.user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_super_groups_updated_at
  BEFORE UPDATE ON public.super_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
