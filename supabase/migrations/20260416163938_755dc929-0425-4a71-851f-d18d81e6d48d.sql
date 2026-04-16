
CREATE OR REPLACE FUNCTION public.criar_processo_com_lancamento(
  p_cliente_id UUID,
  p_razao_social TEXT,
  p_tipo TEXT,
  p_prioridade TEXT DEFAULT 'normal',
  p_responsavel TEXT DEFAULT NULL,
  p_valor NUMERIC DEFAULT 0,
  p_notas TEXT DEFAULT NULL,
  p_created_at TIMESTAMPTZ DEFAULT now(),
  p_dentro_do_plano BOOLEAN DEFAULT NULL,
  p_valor_avulso NUMERIC DEFAULT 0,
  p_justificativa_avulso TEXT DEFAULT NULL,
  p_etiquetas TEXT[] DEFAULT '{}',
  -- lancamento fields
  p_criar_lancamento BOOLEAN DEFAULT true,
  p_descricao_lancamento TEXT DEFAULT '',
  p_ja_pago BOOLEAN DEFAULT false,
  p_data_vencimento DATE DEFAULT NULL,
  p_data_lancamento DATE DEFAULT NULL,
  -- avulso fora do plano
  p_criar_avulso_extra BOOLEAN DEFAULT false,
  p_valor_avulso_extra NUMERIC DEFAULT 0,
  p_descricao_avulso_extra TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_processo_id UUID;
  v_empresa_id UUID;
  v_cliente_empresa UUID;
  v_vencimento DATE;
  v_lanc_date DATE;
BEGIN
  -- Step 1: Get caller's empresa_id
  v_empresa_id := public.get_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui empresa associada';
  END IF;

  -- Step 2: Validate client belongs to same empresa
  SELECT empresa_id INTO v_cliente_empresa
  FROM public.clientes WHERE id = p_cliente_id;
  
  IF v_cliente_empresa IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;
  
  IF v_cliente_empresa != v_empresa_id THEN
    RAISE EXCEPTION 'Cliente não pertence à sua empresa';
  END IF;

  -- Step 3: Insert processo
  INSERT INTO public.processos (
    cliente_id, razao_social, tipo, prioridade, responsavel, valor, notas,
    created_at, dentro_do_plano, valor_avulso, justificativa_avulso, etiquetas,
    empresa_id, etapa
  )
  VALUES (
    p_cliente_id, p_razao_social, p_tipo::public.tipo_processo, p_prioridade, 
    p_responsavel, p_valor, p_notas, p_created_at, p_dentro_do_plano, 
    p_valor_avulso, p_justificativa_avulso, p_etiquetas, v_empresa_id,
    CASE WHEN p_ja_pago THEN 'finalizados' ELSE 'recebidos' END
  )
  RETURNING id INTO v_processo_id;

  -- Step 4: Create main lancamento if needed
  IF p_criar_lancamento THEN
    v_lanc_date := COALESCE(p_data_lancamento, CURRENT_DATE);
    v_vencimento := COALESCE(p_data_vencimento, public.calcular_vencimento(p_cliente_id));

    INSERT INTO public.lancamentos (
      tipo, cliente_id, processo_id, descricao, valor, status,
      data_vencimento, data_pagamento, created_at, etapa_financeiro, empresa_id
    )
    VALUES (
      'receber'::public.tipo_lancamento, p_cliente_id, v_processo_id, 
      p_descricao_lancamento, p_valor,
      CASE WHEN p_ja_pago THEN 'pago'::public.status_financeiro ELSE 'pendente'::public.status_financeiro END,
      CASE WHEN p_ja_pago THEN v_lanc_date ELSE v_vencimento END,
      CASE WHEN p_ja_pago THEN v_lanc_date ELSE NULL END,
      p_created_at,
      CASE WHEN p_ja_pago THEN 'honorario_pago' ELSE 'solicitacao_criada' END,
      v_empresa_id
    );
  END IF;

  -- Step 5: Create avulso extra lancamento (fora do plano)
  IF p_criar_avulso_extra AND p_valor_avulso_extra > 0 THEN
    v_vencimento := COALESCE(p_data_vencimento, public.calcular_vencimento(p_cliente_id));

    INSERT INTO public.lancamentos (
      tipo, cliente_id, processo_id, descricao, valor, status,
      data_vencimento, created_at, etapa_financeiro, empresa_id
    )
    VALUES (
      'receber'::public.tipo_lancamento, p_cliente_id, v_processo_id,
      p_descricao_avulso_extra, p_valor_avulso_extra,
      'pendente'::public.status_financeiro,
      v_vencimento, p_created_at, 'solicitacao_criada', v_empresa_id
    );
  END IF;

  RETURN v_processo_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.criar_processo_com_lancamento(
  UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TIMESTAMPTZ, BOOLEAN, 
  NUMERIC, TEXT, TEXT[], BOOLEAN, TEXT, BOOLEAN, DATE, DATE, 
  BOOLEAN, NUMERIC, TEXT
) TO authenticated;
