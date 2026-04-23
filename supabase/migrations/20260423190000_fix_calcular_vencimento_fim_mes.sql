-- ════════════════════════════════════════════════════════════════════════════
-- FIX: calcular_vencimento com dia 29/30/31 vazava pro mês seguinte
-- ────────────────────────────────────────────────────────────────────────────
-- Bug: se cliente tem dia_vencimento_mensal=31 e o mês corrente é fevereiro,
-- a função retornava 03/03 em vez de 28/02 (último dia de fevereiro).
--
-- Exemplo reproduzido:
--   v_dia = 31
--   mês corrente = fev/2026 (28 dias)
--   DATE_TRUNC('month', '2026-02-15')          → 2026-02-01
--   + (31-1) * INTERVAL '1 day'                → 2026-03-03 ❌
--
-- Fix: clampar v_dia ao último dia do mês target com LEAST().
--
-- Descoberto via auditoria 23/04/2026 (item B do roadmap de dívida técnica).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.calcular_vencimento(p_cliente_id UUID)
RETURNS DATE
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_cliente         RECORD;
  v_dia             INTEGER;
  v_inicio_mes      DATE;
  v_inicio_prox_mes DATE;
  v_ultimo_dia_mes  INTEGER;
  v_ultimo_dia_prox INTEGER;
  v_dia_efetivo     INTEGER;
BEGIN
  SELECT * INTO v_cliente FROM public.clientes WHERE id = p_cliente_id;
  IF NOT FOUND THEN
    RETURN CURRENT_DATE + 4;
  END IF;

  IF v_cliente.tipo = 'MENSALISTA' THEN
    v_dia := COALESCE(v_cliente.vencimento, v_cliente.dia_vencimento_mensal, 10);

    -- Clampa ao intervalo válido antes de qualquer cálculo
    IF v_dia < 1 THEN v_dia := 1; END IF;
    IF v_dia > 31 THEN v_dia := 31; END IF;

    v_inicio_mes      := DATE_TRUNC('month', CURRENT_DATE)::DATE;
    v_inicio_prox_mes := (v_inicio_mes + INTERVAL '1 month')::DATE;

    -- Último dia do mês corrente e do próximo
    v_ultimo_dia_mes  := EXTRACT(DAY FROM (v_inicio_prox_mes - INTERVAL '1 day'))::INTEGER;
    v_ultimo_dia_prox := EXTRACT(DAY FROM (v_inicio_prox_mes + INTERVAL '1 month' - INTERVAL '1 day'))::INTEGER;

    IF EXTRACT(DAY FROM CURRENT_DATE) < v_dia THEN
      -- Mês corrente: clampa dia ao último do mês (ex.: dia 31 em fev → dia 28/29)
      v_dia_efetivo := LEAST(v_dia, v_ultimo_dia_mes);
      RETURN (v_inicio_mes + (v_dia_efetivo - 1) * INTERVAL '1 day')::DATE;
    ELSE
      -- Próximo mês: mesma lógica
      v_dia_efetivo := LEAST(v_dia, v_ultimo_dia_prox);
      RETURN (v_inicio_prox_mes + (v_dia_efetivo - 1) * INTERVAL '1 day')::DATE;
    END IF;
  END IF;

  RETURN CURRENT_DATE + COALESCE(v_cliente.dia_cobranca, 3);
END;
$$;

COMMENT ON FUNCTION public.calcular_vencimento IS
  'Calcula vencimento mensal do cliente. FIX 23/04/2026: dia 29/30/31 em fev/etc. clampa ao último dia do mês em vez de vazar pro mês seguinte.';
