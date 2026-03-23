
CREATE OR REPLACE FUNCTION public.calcular_preco_processo(p_cliente_id uuid, p_tipo tipo_processo)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente RECORD;
  v_count INTEGER;
  v_base NUMERIC;
  v_desconto NUMERIC;
  v_preco NUMERIC;
  v_i INTEGER;
BEGIN
  SELECT * INTO v_cliente FROM public.clientes WHERE id = p_cliente_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF v_cliente.tipo = 'MENSALISTA' AND v_cliente.mensalidade IS NOT NULL THEN
    RETURN 0;
  END IF;
  IF v_cliente.valor_base IS NOT NULL THEN
    v_base := v_cliente.valor_base;
  ELSE
    SELECT valor INTO v_base FROM public.precos_tiers
    WHERE tipo_processo = p_tipo AND tier = 1;
    v_base := COALESCE(v_base, 0);
  END IF;
  -- Count same-month processes for this client
  SELECT COUNT(*) INTO v_count
  FROM public.processos
  WHERE cliente_id = p_cliente_id
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW());
  v_desconto := COALESCE(v_cliente.desconto_progressivo, 0);
  -- Compounding discount: each subsequent process applies discount to previous value
  IF v_count > 0 AND v_desconto > 0 THEN
    v_preco := v_base;
    FOR v_i IN 1..v_count LOOP
      v_preco := v_preco * (1 - v_desconto / 100.0);
    END LOOP;
    -- Apply floor limit
    IF v_cliente.valor_limite_desconto IS NOT NULL AND v_preco < v_cliente.valor_limite_desconto THEN
      v_preco := v_cliente.valor_limite_desconto;
    END IF;
  ELSE
    v_preco := v_base;
  END IF;
  RETURN GREATEST(v_preco, 0);
END;
$function$;
