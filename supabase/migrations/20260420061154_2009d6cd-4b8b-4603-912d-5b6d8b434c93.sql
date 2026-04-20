CREATE TABLE public.trello_provisioner_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  board_id TEXT,
  board_name TEXT,
  trigger_type TEXT,
  actions_applied JSONB,
  errors JSONB,
  success BOOLEAN DEFAULT false
);

ALTER TABLE public.trello_provisioner_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trello_prov_logs_master_read" ON public.trello_provisioner_logs
  FOR SELECT TO authenticated USING (public.get_user_role() = 'master');