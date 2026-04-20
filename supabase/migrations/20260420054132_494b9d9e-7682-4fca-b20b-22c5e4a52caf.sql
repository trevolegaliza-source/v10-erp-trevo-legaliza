CREATE TABLE public.trello_guard_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  action_type TEXT NOT NULL,
  board_id TEXT,
  board_name TEXT,
  card_id TEXT,
  card_name TEXT,
  member_username TEXT,
  was_reverted BOOLEAN DEFAULT false,
  revert_detail TEXT,
  raw_action JSONB
);

ALTER TABLE public.trello_guard_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trello_logs_master_read"
  ON public.trello_guard_logs
  FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'master');

CREATE INDEX idx_trello_guard_logs_created_at ON public.trello_guard_logs (created_at DESC);