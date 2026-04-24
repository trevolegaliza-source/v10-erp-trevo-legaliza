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

NOTIFY pgrst, 'reload schema';

COMMENT ON FUNCTION public.tentar_aplicar_boas_vindas IS
  'Aplica desconto de boas-vindas atomicamente via SELECT FOR UPDATE. Hotfix 23/04 — garante presença no schema cache.';