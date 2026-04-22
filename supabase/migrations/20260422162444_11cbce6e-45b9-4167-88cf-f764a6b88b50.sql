-- Migration 14: Constraints de integridade no Financeiro

-- 1) valor > 0 em lancamentos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lancamentos_valor_positivo_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.lancamentos ADD CONSTRAINT lancamentos_valor_positivo_check CHECK (valor > 0) NOT VALID';
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.lancamentos VALIDATE CONSTRAINT lancamentos_valor_positivo_check;
EXCEPTION
  WHEN check_violation THEN
    RAISE WARNING 'Existem lançamentos com valor <= 0. Constraint criada como NOT VALID; corrigir linhas e rodar: ALTER TABLE public.lancamentos VALIDATE CONSTRAINT lancamentos_valor_positivo_check;';
END $$;

-- 2) data_pagamento coerente com status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lancamentos_data_pagamento_coerente_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.lancamentos ADD CONSTRAINT lancamentos_data_pagamento_coerente_check CHECK (data_pagamento IS NULL OR status::text IN (''pago'', ''cancelado'')) NOT VALID';
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.lancamentos VALIDATE CONSTRAINT lancamentos_data_pagamento_coerente_check;
EXCEPTION
  WHEN check_violation THEN
    RAISE WARNING 'Existem lançamentos com data_pagamento preenchida e status != pago/cancelado. Constraint criada como NOT VALID; corrigir e rodar VALIDATE CONSTRAINT manualmente.';
END $$;

-- 3) extratos.created_by TEXT → UUID FK(profiles) com default auth.uid()
DO $$
DECLARE
  v_coltype TEXT;
BEGIN
  SELECT data_type INTO v_coltype
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'extratos' AND column_name = 'created_by';

  IF v_coltype = 'text' THEN
    ALTER TABLE public.extratos DROP COLUMN created_by;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'extratos' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.extratos
      ADD COLUMN created_by UUID
        REFERENCES public.profiles(id) ON DELETE SET NULL
        DEFAULT auth.uid();
  END IF;
END $$;

COMMENT ON COLUMN public.extratos.created_by IS
  'Usuário que gerou o extrato. FK pra profiles. Default = auth.uid() pra preencher automático em INSERTs.';

CREATE INDEX IF NOT EXISTS idx_extratos_created_by
  ON public.extratos(created_by) WHERE created_by IS NOT NULL;