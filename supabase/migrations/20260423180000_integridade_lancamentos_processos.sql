-- ════════════════════════════════════════════════════════════════════════════
-- INTEGRIDADE A9 + A19 — Lançamentos órfãos bloqueados + alerta de duplicata
-- ────────────────────────────────────────────────────────────────────────────
-- 23/04/2026 — Dívida técnica do roadmap original.
--
-- A7 (desconto boas-vindas ≤ 99):
--   PULADO — já existe `lancamentos_valor_positivo_check` (valor > 0) desde
--   commit 15f18e6 (22/04) que bloqueia indiretamente: desconto de 100%+
--   produziria valor ≤ 0 e seria rejeitado.
--
-- A9 (lançamento órfão):
--   Hoje lancamentos.cliente_id e processo_id são ambos nullable. Pode
--   existir linha com ambos NULL → dado perdido, difícil auditar depois.
--   CHECK: pelo menos um dos dois deve estar preenchido.
--
-- A9.b (sanity de valor):
--   Adicional: bloqueio de valor absurdamente alto (> R$ 10 milhões) pra
--   evitar erro de digitação catastrófico (ex.: operador digita valor em
--   centavos por engano e vira R$ 150.000.000,00 sem perceber).
--
-- A19 (anti-duplicata de processo) — MODO SOFT:
--   Em vez de UNIQUE (que bloquearia casos legítimos — ex.: abertura e
--   alteração no mesmo mês pra mesma razão), criar função helper
--   `possivel_duplicata_processo` que retorna TRUE se existe processo
--   do mesmo cliente + mesmo tipo + mesma razão social + mesmo mês.
--   O frontend pode chamar pra avisar o usuário ANTES de salvar
--   ("Já existe processo similar este mês, deseja continuar?").
-- ════════════════════════════════════════════════════════════════════════════

-- ── A9: lançamento órfão bloqueado ─────────────────────────────────────────
-- Limpar órfãos antigos primeiro (log pra auditoria depois)
DO $$
DECLARE
  v_orfaos INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_orfaos
  FROM public.lancamentos
  WHERE cliente_id IS NULL AND processo_id IS NULL;

  IF v_orfaos > 0 THEN
    RAISE NOTICE '⚠️  Encontrados % lançamentos órfãos (cliente_id e processo_id ambos NULL). Marcados como cancelados.', v_orfaos;
    UPDATE public.lancamentos
    SET status = 'cancelado',
        observacoes_financeiro = COALESCE(observacoes_financeiro || E'\n', '') ||
          '[AUTO] Cancelado em ' || NOW()::TEXT || ' — lançamento órfão (sem cliente nem processo associado)'
    WHERE cliente_id IS NULL AND processo_id IS NULL;
  END IF;
END $$;

-- Adicionar CHECK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lancamentos_nao_orfao_check'
  ) THEN
    ALTER TABLE public.lancamentos
      ADD CONSTRAINT lancamentos_nao_orfao_check
      CHECK (cliente_id IS NOT NULL OR processo_id IS NOT NULL)
      NOT VALID;
  END IF;
END $$;

-- Validar (agora que órfãos foram cancelados e não podem ser inseridos novos)
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.lancamentos VALIDATE CONSTRAINT lancamentos_nao_orfao_check;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Validação de lancamentos_nao_orfao_check falhou: % — NOT VALID mantido.', SQLERRM;
  END;
END $$;

COMMENT ON CONSTRAINT lancamentos_nao_orfao_check ON public.lancamentos IS
  'A9: lançamento precisa ter cliente_id OU processo_id (não pode ser órfão).';

-- ── A9.b: teto de valor ────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lancamentos_valor_teto_check'
  ) THEN
    ALTER TABLE public.lancamentos
      ADD CONSTRAINT lancamentos_valor_teto_check
      CHECK (valor <= 10000000)
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.lancamentos VALIDATE CONSTRAINT lancamentos_valor_teto_check;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Validação de lancamentos_valor_teto_check falhou: %', SQLERRM;
  END;
END $$;

COMMENT ON CONSTRAINT lancamentos_valor_teto_check ON public.lancamentos IS
  'A9.b: sanity check — valor ≤ R$ 10.000.000 (evita erro de digitação catastrófico).';

-- ── A19: helper soft pra detectar possível duplicata ──────────────────────
CREATE OR REPLACE FUNCTION public.possivel_duplicata_processo(
  p_cliente_id UUID,
  p_razao_social TEXT,
  p_tipo TEXT,
  p_data_ref DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  existe BOOLEAN,
  qtd INTEGER,
  ultimo_id UUID,
  ultima_data TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH mes_ref AS (
    SELECT DATE_TRUNC('month', p_data_ref) AS inicio,
           DATE_TRUNC('month', p_data_ref) + INTERVAL '1 month' AS fim
  ),
  matches AS (
    SELECT p.id, p.created_at
    FROM public.processos p, mes_ref
    WHERE p.cliente_id = p_cliente_id
      AND LOWER(TRIM(p.razao_social)) = LOWER(TRIM(p_razao_social))
      AND p.tipo::TEXT = p_tipo
      AND p.created_at >= mes_ref.inicio
      AND p.created_at <  mes_ref.fim
      AND p.empresa_id = public.get_empresa_id()
  )
  SELECT
    (COUNT(*) > 0)::BOOLEAN                                AS existe,
    COUNT(*)::INTEGER                                       AS qtd,
    (SELECT id          FROM matches ORDER BY created_at DESC LIMIT 1) AS ultimo_id,
    (SELECT created_at  FROM matches ORDER BY created_at DESC LIMIT 1) AS ultima_data
  FROM matches;
$$;

GRANT EXECUTE ON FUNCTION public.possivel_duplicata_processo(UUID, TEXT, TEXT, DATE) TO authenticated;

COMMENT ON FUNCTION public.possivel_duplicata_processo IS
  'A19: detecta possível duplicata de processo (mesmo cliente + razão + tipo + mês). Retorna existe/qtd/último. Frontend usa pra avisar antes de salvar.';
