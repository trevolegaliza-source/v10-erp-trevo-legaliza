ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS auditado_financeiro boolean DEFAULT false;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS auditado_em timestamptz;