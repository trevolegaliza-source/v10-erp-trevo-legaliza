ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS auditado_financeiro boolean DEFAULT false;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS auditado_em timestamptz;