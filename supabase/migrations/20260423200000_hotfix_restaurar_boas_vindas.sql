-- ════════════════════════════════════════════════════════════════════════════
-- 🔴 HOTFIX 23/04/2026 — Função tentar_aplicar_boas_vindas sumiu do schema
-- ────────────────────────────────────────────────────────────────────────────
-- Erro reportado em produção:
--   "Could not find the function public.tentar_aplicar_boas_vindas(p_cliente_id)
--    in the schema cache"
--
-- Causa possível: migration 20260422190000 não foi aplicada na conta Lovable,
-- OU a função foi removida em algum reset/rollback, OU o PostgREST está com
-- cache stale.
--
-- Fix: recria a função (idempotente — CREATE OR REPLACE), mesma assinatura e
-- comportamento do arquivo original. Ao final, NOTIFY pgrst pra forçar reload
-- do schema cache do PostgREST.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.tentar_aplicar_boas_vindas(
  p_cliente_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ja_aplicado     BOOLEAN;
  v_empresa_cliente UUID;
  v_empresa_caller  UUID;
BEGIN
  v_empresa_caller := public.get_empresa_id();

  -- SELECT FOR UPDATE pra garantir atomicidade entre workers concorrentes
  SELECT empresa_id, COALESCE(desconto_boas_vindas_aplicado, false)
    INTO v_empresa_cliente, v_ja_aplicado
    FROM public.clientes
   WHERE id = p_cliente_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;

  IF v_empresa_cliente IS DISTINCT FROM v_empresa_caller THEN
    RAISE EXCEPTION 'Cliente não pertence à sua empresa';
  END IF;

  IF v_ja_aplicado THEN
    RETURN jsonb_build_object('aplicado', false, 'motivo', 'ja_aplicado');
  END IF;

  UPDATE public.clientes
     SET desconto_boas_vindas_aplicado = true,
         updated_at = NOW()
   WHERE id = p_cliente_id;

  RETURN jsonb_build_object('aplicado', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.tentar_aplicar_boas_vindas(UUID) TO authenticated;

-- Helper de rollback (usado quando createProcesso falha depois de ganhar o lock)
CREATE OR REPLACE FUNCTION public.reverter_boas_vindas(
  p_cliente_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.clientes
     SET desconto_boas_vindas_aplicado = false,
         updated_at = NOW()
   WHERE id = p_cliente_id
     AND empresa_id = public.get_empresa_id();
END;
$$;

GRANT EXECUTE ON FUNCTION public.reverter_boas_vindas(UUID) TO authenticated;

-- 🔥 Força reload do schema cache do PostgREST (resolve "Could not find function")
NOTIFY pgrst, 'reload schema';

COMMENT ON FUNCTION public.tentar_aplicar_boas_vindas IS
  'Aplica desconto de boas-vindas atomicamente via SELECT FOR UPDATE. Hotfix 23/04 — garante presença no schema cache.';
