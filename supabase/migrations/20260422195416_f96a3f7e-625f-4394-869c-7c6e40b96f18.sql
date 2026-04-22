DROP FUNCTION IF EXISTS public.criar_processo_com_lancamento(
  uuid, text, text, text, text, numeric, text, timestamptz, boolean, numeric, text, text[],
  boolean, text, boolean, date, date, boolean, numeric, text
);

CREATE OR REPLACE FUNCTION public.criar_processo_com_lancamento(
  p_cliente_id uuid,
  p_razao_social text,
  p_tipo text,
  p_prioridade text DEFAULT 'normal'::text,
  p_responsavel text DEFAULT NULL::text,
  p_valor numeric DEFAULT 0,
  p_notas text DEFAULT NULL::text,
  p_created_at timestamp with time zone DEFAULT now(),
  p_dentro_do_plano boolean DEFAULT NULL::boolean,
  p_valor_avulso numeric DEFAULT 0,
  p_justificativa_avulso text DEFAULT NULL::text,
  p_etiquetas text[] DEFAULT '{}'::text[],
  p_criar_lancamento boolean DEFAULT true,
  p_descricao_lancamento text DEFAULT ''::text,
  p_ja_pago boolean DEFAULT false,
  p_data_vencimento date DEFAULT NULL::date,
  p_data_lancamento date DEFAULT NULL::date,
  p_criar_avulso_extra boolean DEFAULT false,
  p_valor_avulso_extra numeric DEFAULT 0,
  p_descricao_avulso_extra text DEFAULT ''::text,
  p_via_analise text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_processo_id UUID;
  v_empresa_id UUID;
  v_cliente_empresa UUID;
  v_vencimento DATE;
  v_lanc_date DATE;
BEGIN
  v_empresa_id := public.get_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui empresa associada';
  END IF;

  SELECT empresa_id INTO v_cliente_empresa
  FROM public.clientes WHERE id = p_cliente_id;

  IF v_cliente_empresa IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;

  IF v_cliente_empresa != v_empresa_id THEN
    RAISE EXCEPTION 'Cliente não pertence à sua empresa';
  END IF;

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

  -- Grava via_analise se a coluna existir e o parâmetro foi passado
  IF p_via_analise IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'processos' AND column_name = 'via_analise'
  ) THEN
    EXECUTE format('UPDATE public.processos SET via_analise = %L WHERE id = %L', p_via_analise, v_processo_id);
  END IF;

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
$function$;