ALTER TABLE public.lancamentos ADD COLUMN IF NOT EXISTS contestacao_motivo TEXT;
ALTER TABLE public.lancamentos ADD COLUMN IF NOT EXISTS contestacao_anexo_url TEXT;
ALTER TABLE public.lancamentos ADD COLUMN IF NOT EXISTS contestacao_data TIMESTAMPTZ;