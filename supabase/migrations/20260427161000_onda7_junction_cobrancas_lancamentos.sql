-- =============================================
-- ONDA 7 #10 — Junction cobrancas_lancamentos com FK
-- =============================================
-- Problema: cobrancas.lancamento_ids UUID[] sem FK referential integrity.
-- Risco: usuário autenticado da empresa A insere cobrança da própria
--   empresa, mas com lancamento_ids apontando pra lançamentos da
--   empresa B. asaas-webhook (service role) marca esses lançamentos
--   como pagos cross-empresa.
--
-- Solução conservadora (este patch):
--   - Cria junction cobrancas_lancamentos com FKs reais
--   - Backfill dos arrays existentes pra junction
--   - Trigger de validação: bloqueia INSERT/UPDATE em cobrancas se
--     lancamento_ids contiver UUID de outra empresa
--   - Trigger de sync: mantém junction sincronizada com array
--   - Mantém coluna lancamento_ids (frontend e asaas-webhook seguem
--     usando ela). Refactor pra remover a coluna fica como Phase 2.

-- 1. Tabela junction
CREATE TABLE IF NOT EXISTS public.cobrancas_lancamentos (
  cobranca_id UUID NOT NULL REFERENCES public.cobrancas(id) ON DELETE CASCADE,
  lancamento_id UUID NOT NULL REFERENCES public.lancamentos(id) ON DELETE RESTRICT,
  empresa_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cobranca_id, lancamento_id)
);

ALTER TABLE public.cobrancas_lancamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cobrancas_lancamentos_select" ON public.cobrancas_lancamentos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());

CREATE POLICY "cobrancas_lancamentos_insert" ON public.cobrancas_lancamentos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_empresa_id());

CREATE POLICY "cobrancas_lancamentos_update" ON public.cobrancas_lancamentos
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

CREATE POLICY "cobrancas_lancamentos_delete" ON public.cobrancas_lancamentos
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_empresa_id() AND public.get_user_role() = 'master');

CREATE INDEX IF NOT EXISTS idx_cob_lan_lancamento
  ON public.cobrancas_lancamentos(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_cob_lan_empresa
  ON public.cobrancas_lancamentos(empresa_id);

-- 2. Backfill dos arrays existentes
INSERT INTO public.cobrancas_lancamentos (cobranca_id, lancamento_id, empresa_id, created_at)
SELECT
  c.id,
  unnested.lancamento_id,
  c.empresa_id,
  c.created_at
FROM public.cobrancas c,
LATERAL UNNEST(c.lancamento_ids) AS unnested(lancamento_id)
WHERE EXISTS (
  -- Só backfilla se o lançamento existe E pertence à mesma empresa.
  -- Lançamentos órfãos (apontados em arrays mas deletados) ou cross-
  -- empresa (preexistentes ao bug fix) ficam de fora.
  SELECT 1 FROM public.lancamentos l
  WHERE l.id = unnested.lancamento_id
    AND l.empresa_id = c.empresa_id
)
ON CONFLICT (cobranca_id, lancamento_id) DO NOTHING;

-- 3. Função de validação: lancamento_ids tem que ser tudo da mesma empresa
CREATE OR REPLACE FUNCTION public._validate_cobranca_lancamento_ids()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count_total INTEGER;
  v_count_match INTEGER;
BEGIN
  IF NEW.lancamento_ids IS NULL OR array_length(NEW.lancamento_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  v_count_total := array_length(NEW.lancamento_ids, 1);

  SELECT COUNT(*) INTO v_count_match
  FROM public.lancamentos
  WHERE id = ANY(NEW.lancamento_ids)
    AND empresa_id = NEW.empresa_id;

  IF v_count_match <> v_count_total THEN
    RAISE EXCEPTION 'lancamento_ids contém UUIDs inválidos ou de outra empresa (esperado %, válidos %)',
      v_count_total, v_count_match
      USING ERRCODE = '23514'; -- check_violation
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_cobranca_lancamento_ids ON public.cobrancas;
CREATE TRIGGER trg_validate_cobranca_lancamento_ids
  BEFORE INSERT OR UPDATE OF lancamento_ids ON public.cobrancas
  FOR EACH ROW
  EXECUTE FUNCTION public._validate_cobranca_lancamento_ids();

-- 4. Função de sync: mantém junction alinhada com array
CREATE OR REPLACE FUNCTION public._sync_cobranca_lancamentos_junction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Em UPDATE: limpa registros que saíram do array
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM public.cobrancas_lancamentos
    WHERE cobranca_id = NEW.id
      AND lancamento_id <> ALL(COALESCE(NEW.lancamento_ids, ARRAY[]::UUID[]));
  END IF;

  -- Insere os que estão no array e ainda não estão na junction
  IF NEW.lancamento_ids IS NOT NULL AND array_length(NEW.lancamento_ids, 1) > 0 THEN
    INSERT INTO public.cobrancas_lancamentos (cobranca_id, lancamento_id, empresa_id)
    SELECT NEW.id, lid, NEW.empresa_id
    FROM UNNEST(NEW.lancamento_ids) AS lid
    ON CONFLICT (cobranca_id, lancamento_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cobranca_lancamentos ON public.cobrancas;
CREATE TRIGGER trg_sync_cobranca_lancamentos
  AFTER INSERT OR UPDATE OF lancamento_ids ON public.cobrancas
  FOR EACH ROW
  EXECUTE FUNCTION public._sync_cobranca_lancamentos_junction();

COMMENT ON TABLE public.cobrancas_lancamentos IS
  'Junction table com FK real entre cobrancas e lancamentos. '
  'Sincronizada automaticamente a partir de cobrancas.lancamento_ids '
  'via trigger _sync_cobranca_lancamentos_junction. Onda 7 #10.';
