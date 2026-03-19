
-- Drop all permissive public policies and replace with authenticated-only policies

-- CLIENTES
DROP POLICY IF EXISTS "clientes_all" ON public.clientes;
CREATE POLICY "clientes_authenticated_all" ON public.clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- PROCESSOS  
DROP POLICY IF EXISTS "processos_all" ON public.processos;
CREATE POLICY "processos_authenticated_all" ON public.processos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- LANCAMENTOS
DROP POLICY IF EXISTS "lancamentos_all" ON public.lancamentos;
CREATE POLICY "lancamentos_authenticated_all" ON public.lancamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- DOCUMENTOS
DROP POLICY IF EXISTS "documentos_all" ON public.documentos;
CREATE POLICY "documentos_authenticated_all" ON public.documentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- VALORES_ADICIONAIS
DROP POLICY IF EXISTS "valores_adicionais_all" ON public.valores_adicionais;
CREATE POLICY "valores_adicionais_authenticated_all" ON public.valores_adicionais FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- PRECOS_TIERS
DROP POLICY IF EXISTS "precos_tiers_all" ON public.precos_tiers;
CREATE POLICY "precos_tiers_select_public" ON public.precos_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "precos_tiers_write_authenticated" ON public.precos_tiers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix function search paths
CREATE OR REPLACE FUNCTION public.calcular_preco_processo(p_cliente_id uuid, p_tipo tipo_processo)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path = public
AS $function$
DECLARE
  v_cliente RECORD;
  v_count INTEGER;
  v_base NUMERIC;
  v_desconto NUMERIC;
  v_preco NUMERIC;
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
  SELECT COUNT(*) INTO v_count
  FROM public.processos
  WHERE cliente_id = p_cliente_id
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW());
  v_desconto := COALESCE(v_cliente.desconto_progressivo, 0);
  IF v_count > 0 AND v_desconto > 0 THEN
    v_preco := v_base * (1 - (v_desconto / 100.0) * v_count);
    IF v_cliente.valor_limite_desconto IS NOT NULL AND v_preco < v_cliente.valor_limite_desconto THEN
      v_preco := v_cliente.valor_limite_desconto;
    END IF;
  ELSE
    v_preco := v_base;
  END IF;
  RETURN GREATEST(v_preco, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.calcular_vencimento(p_cliente_id uuid)
 RETURNS date
 LANGUAGE plpgsql
 STABLE
 SET search_path = public
AS $function$
DECLARE
  v_cliente RECORD;
BEGIN
  SELECT * INTO v_cliente FROM public.clientes WHERE id = p_cliente_id;
  IF NOT FOUND THEN RETURN CURRENT_DATE + 4; END IF;
  IF v_cliente.tipo = 'MENSALISTA' THEN
    DECLARE v_dia INTEGER := COALESCE(v_cliente.vencimento, v_cliente.dia_vencimento_mensal, 10);
    BEGIN
      IF EXTRACT(DAY FROM CURRENT_DATE) < v_dia THEN
        RETURN (DATE_TRUNC('month', CURRENT_DATE) + (v_dia - 1) * INTERVAL '1 day')::DATE;
      ELSE
        RETURN (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' + (v_dia - 1) * INTERVAL '1 day')::DATE;
      END IF;
    END;
  END IF;
  RETURN CURRENT_DATE + COALESCE(v_cliente.dia_cobranca, 3);
END;
$function$;

-- Create webhook_configs table for n8n webhook storage
CREATE TABLE IF NOT EXISTS public.webhook_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_configs_authenticated" ON public.webhook_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);
