-- =============================================
-- Constraints de integridade no Financeiro
-- =============================================
-- Três mudanças conservadoras que protegem contra dados ruins:
--
-- 1. lancamentos.valor > 0
--    Impede lançamento com valor 0 ou negativo entrando no sistema.
--    Usa NOT VALID + VALIDATE separado pra não travar migration se
--    houver linha antiga anômala (nesse caso o DBA corrige e re-valida).
--
-- 2. lancamentos.data_pagamento — coerência com status
--    Se data_pagamento está preenchida, status precisa ser 'pago'
--    (ou sentinelas aceitos: 'cancelado'). Evita o estado "pendente
--    com data de pagamento" que apareceu no bug do desfazer pagamento.
--
-- 3. extratos.created_by — TEXT órfão → UUID FK(profiles) com default auth.uid()
--    A coluna nunca foi preenchida em nenhum insert do app. Hoje é
--    campo morto. Transformar em UUID+FK+default transforma em audit
--    trail útil sem precisar mudar código de escrita (default cuida).
-- =============================================

-- ---------------------------------------------
-- 1) valor > 0 em lancamentos
-- ---------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lancamentos_valor_positivo_check'
  ) THEN
    EXECUTE '
      ALTER TABLE public.lancamentos
        ADD CONSTRAINT lancamentos_valor_positivo_check
        CHECK (valor > 0)
        NOT VALID
    ';
  END IF;
END $$;

-- Tenta validar. Se falhar, reporta no log mas não trava a migration —
-- Thales consulta quais linhas violam e corrige manualmente.
DO $$
BEGIN
  ALTER TABLE public.lancamentos
    VALIDATE CONSTRAINT lancamentos_valor_positivo_check;
EXCEPTION
  WHEN check_violation THEN
    RAISE WARNING
      'Existem lançamentos com valor <= 0. Constraint criada como NOT VALID; corrigir linhas e rodar: ALTER TABLE public.lancamentos VALIDATE CONSTRAINT lancamentos_valor_positivo_check;';
END $$;

-- ---------------------------------------------
-- 2) data_pagamento coerente com status
-- ---------------------------------------------
-- Regra: data_pagamento só pode estar preenchida quando status == 'pago'
-- OU 'cancelado' (cancelado com baixa parcial ocasional). Se estiver
-- 'pendente' ou 'atrasado', data_pagamento TEM que ser NULL.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lancamentos_data_pagamento_coerente_check'
  ) THEN
    EXECUTE '
      ALTER TABLE public.lancamentos
        ADD CONSTRAINT lancamentos_data_pagamento_coerente_check
        CHECK (
          data_pagamento IS NULL
          OR status::text IN (''pago'', ''cancelado'')
        )
        NOT VALID
    ';
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.lancamentos
    VALIDATE CONSTRAINT lancamentos_data_pagamento_coerente_check;
EXCEPTION
  WHEN check_violation THEN
    RAISE WARNING
      'Existem lançamentos com data_pagamento preenchida e status != pago/cancelado. Constraint criada como NOT VALID; corrigir (zerar data_pagamento ou ajustar status) e rodar VALIDATE CONSTRAINT manualmente.';
END $$;

-- ---------------------------------------------
-- 3) extratos.created_by TEXT → UUID FK(profiles) com default auth.uid()
-- ---------------------------------------------
-- A coluna atual é TEXT e nunca recebe valor (confirmado via grep).
-- Seguro dropar e recriar: backfill fica como NULL (não havia dado útil).
DO $$
DECLARE
  v_coltype TEXT;
BEGIN
  SELECT data_type INTO v_coltype
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'extratos'
     AND column_name  = 'created_by';

  IF v_coltype = 'text' THEN
    -- Drop da coluna TEXT não usada
    ALTER TABLE public.extratos DROP COLUMN created_by;
  END IF;

  -- (Re)cria como UUID com FK e default pro user autenticado
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'extratos'
       AND column_name  = 'created_by'
  ) THEN
    ALTER TABLE public.extratos
      ADD COLUMN created_by UUID
        REFERENCES public.profiles(id) ON DELETE SET NULL
        DEFAULT auth.uid();
  END IF;
END $$;

COMMENT ON COLUMN public.extratos.created_by IS
  'Usuário que gerou o extrato. FK pra profiles. Default = auth.uid() pra preencher automático em INSERTs feitos via Supabase client autenticado.';

CREATE INDEX IF NOT EXISTS idx_extratos_created_by
  ON public.extratos(created_by)
  WHERE created_by IS NOT NULL;
