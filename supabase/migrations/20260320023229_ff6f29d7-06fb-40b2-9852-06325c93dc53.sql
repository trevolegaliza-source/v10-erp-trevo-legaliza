
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS adiantamento_tipo text NOT NULL DEFAULT 'percentual',
  ADD COLUMN IF NOT EXISTS adiantamento_valor numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pix_tipo text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pix_chave text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS valor_das numeric NOT NULL DEFAULT 0;
