-- =============================================
-- Boas-vindas atômica (evita dupla aplicação de desconto)
-- =============================================
-- Problema: hoje o fluxo de criar processo faz:
--   1. SELECT cliente (lê desconto_boas_vindas_aplicado=false)
--   2. Cria processo com desconto
--   3. UPDATE cliente SET desconto_boas_vindas_aplicado=true
--
-- Se 2 abas abertas / 2 usuários criarem processo simultâneo do
-- MESMO cliente, ambos veem flag=false no passo 1, ambos aplicam
-- desconto, ambos gravam flag=true no passo 3. Resultado: desconto
-- em dobro.
--
-- Solução: RPC que faz SELECT ... FOR UPDATE + UPDATE na mesma
-- transação, retornando se "ganhou" o direito de aplicar boas-vindas.
-- O primeiro chamador recebe aplicado=true; os concorrentes recebem
-- aplicado=false (porque quando conseguirem o lock, a flag já tá
-- gravada como true).
-- =============================================

CREATE OR REPLACE FUNCTION public.tentar_aplicar_boas_vindas(
  p_cliente_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ja_aplicado BOOLEAN;
  v_empresa_cliente UUID;
  v_empresa_caller  UUID;
BEGIN
  -- Isolamento por empresa (SECURITY DEFINER bypass RLS, então revalidamos)
  v_empresa_caller := public.get_empresa_id();

  -- SELECT FOR UPDATE trava a linha até fim da transação.
  -- Outros SELECTs simultâneos ficam esperando.
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
    -- Outro worker já aplicou (ou foi aplicado em sessão anterior)
    RETURN jsonb_build_object(
      'aplicado', false,
      'motivo', 'ja_aplicado'
    );
  END IF;

  -- Ganhamos o direito. Marca como aplicado ainda dentro da transação.
  UPDATE public.clientes
     SET desconto_boas_vindas_aplicado = true,
         updated_at = NOW()
   WHERE id = p_cliente_id;

  RETURN jsonb_build_object('aplicado', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.tentar_aplicar_boas_vindas(UUID) TO authenticated;

-- Helper pra REVERTER (caso createProcesso falhe depois de ganhar o lock)
-- Útil pra frontend fazer rollback se a criação do processo der erro
-- depois que já marcou a flag.
CREATE OR REPLACE FUNCTION public.reverter_boas_vindas(
  p_cliente_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só reverte se empresa bate
  UPDATE public.clientes
     SET desconto_boas_vindas_aplicado = false,
         updated_at = NOW()
   WHERE id = p_cliente_id
     AND empresa_id = public.get_empresa_id();
END;
$$;

GRANT EXECUTE ON FUNCTION public.reverter_boas_vindas(UUID) TO authenticated;
