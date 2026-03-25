ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS data_ultimo_contato DATE,
  ADD COLUMN IF NOT EXISTS tentativas_cobranca INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notas_cobranca TEXT;