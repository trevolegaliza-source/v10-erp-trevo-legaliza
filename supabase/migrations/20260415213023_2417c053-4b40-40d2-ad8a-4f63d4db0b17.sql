
CREATE TABLE IF NOT EXISTS public.master_password_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.master_password_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_pw_attempts_insert" ON public.master_password_attempts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "master_pw_attempts_select" ON public.master_password_attempts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
