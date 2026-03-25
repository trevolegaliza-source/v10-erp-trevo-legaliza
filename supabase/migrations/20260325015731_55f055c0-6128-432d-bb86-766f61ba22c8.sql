ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS dia_adiantamento INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS dia_salario INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS dia_vt_vr INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dia_das INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS fgts_percentual NUMERIC DEFAULT 8,
  ADD COLUMN IF NOT EXISTS inss_patronal_percentual NUMERIC DEFAULT 20,
  ADD COLUMN IF NOT EXISTS provisionar_13 BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS provisionar_ferias BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS observacoes_pagamento TEXT;

UPDATE public.colaboradores
SET dia_salario = COALESCE(dia_pagamento_integral, 5);