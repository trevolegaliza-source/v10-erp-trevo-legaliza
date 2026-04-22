-- Recria criar_processo_com_lancamento adicionando suporte a "aguardando_deferimento"
DROP FUNCTION IF EXISTS public.criar_processo_com_lancamento(
  UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TIMESTAMPTZ, BOOLEAN,
  NUMERIC, TEXT, TEXT[], BOOLEAN, TEXT, BOOLEAN, DATE, DATE,
  BOOLEAN, NUMERIC, TEXT, TEXT
);
DROP FUNCTION IF EXISTS public.criar_processo_com_lancamento(
  UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TIMESTAMPTZ, BOOLEAN,
  NUMERIC, TEXT, TEXT[], BOOLEAN, TEXT, BOOLEAN, DATE, DATE,
  BOOLEAN, NUMERIC, TEXT
);

CREATE FUNCTION public.criar_processo_com_lancamento(
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
  p_criar_lancamento BOOLEAN DEFAULT true,
  p_descricao_lancamento TEXT DEFAULT '',
  p_ja_pago BOOLEAN DEFAULT false,
  p_data_vencimento DATE DEFAULT NULL,
  p_data_lancamento DATE DEFAULT NULL,
  p_criar_avulso_extra BOOLEAN DEFAULT false,
  p_valor_avulso_extra NUMERIC DEFAULT 0,
  p_descricao_avulso_extra TEXT DEFAULT '',
  p_via_analise TEXT DEFAULT NULL
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
  v_lanc_date DATE;
  v_momento_faturamento TEXT;
  v_etapa_lanc TEXT;
  v_venc_lanc DATE;
BEGIN
  v_empresa_id := public.get_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui empresa associada';
  END IF;

  SELECT empresa_id, COALESCE(momento_faturamento, 'na_solicitacao')
    INTO v_cliente_empresa, v_momento_faturamento
    FROM public.clientes
   WHERE id = p_cliente_id;

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

  -- Grava via_analise se a coluna existir
  IF p_via_analise IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'processos' AND column_name = 'via_analise'
  ) THEN
    EXECUTE format('UPDATE public.processos SET via_analise = %L WHERE id = %L', p_via_analise, v_processo_id);
  END IF;

  IF p_criar_lancamento THEN
    v_lanc_date := COALESCE(p_data_lancamento, CURRENT_DATE);
    IF p_ja_pago THEN
      v_etapa_lanc := 'honorario_pago';
      v_venc_lanc := v_lanc_date;
    ELSIF v_momento_faturamento = 'no_deferimento' THEN
      v_etapa_lanc := 'aguardando_deferimento';
      v_venc_lanc := NULL;
    ELSE
      v_etapa_lanc := 'solicitacao_criada';
      v_venc_lanc := COALESCE(p_data_vencimento, public.calcular_vencimento(p_cliente_id));
    END IF;

    INSERT INTO public.lancamentos (
      tipo, cliente_id, processo_id, descricao, valor, status,
      data_vencimento, data_pagamento, created_at, etapa_financeiro, empresa_id
    )
    VALUES (
      'receber'::public.tipo_lancamento, p_cliente_id, v_processo_id,
      p_descricao_lancamento, p_valor,
      CASE WHEN p_ja_pago THEN 'pago'::public.status_financeiro ELSE 'pendente'::public.status_financeiro END,
      v_venc_lanc,
      CASE WHEN p_ja_pago THEN v_lanc_date ELSE NULL END,
      p_created_at,
      v_etapa_lanc,
      v_empresa_id
    );
  END IF;

  IF p_criar_avulso_extra AND p_valor_avulso_extra > 0 THEN
    IF v_momento_faturamento = 'no_deferimento' THEN
      v_etapa_lanc := 'aguardando_deferimento';
      v_venc_lanc := NULL;
    ELSE
      v_etapa_lanc := 'solicitacao_criada';
      v_venc_lanc := COALESCE(p_data_vencimento, public.calcular_vencimento(p_cliente_id));
    END IF;

    INSERT INTO public.lancamentos (
      tipo, cliente_id, processo_id, descricao, valor, status,
      data_vencimento, created_at, etapa_financeiro, empresa_id
    )
    VALUES (
      'receber'::public.tipo_lancamento, p_cliente_id, v_processo_id,
      p_descricao_avulso_extra, p_valor_avulso_extra,
      'pendente'::public.status_financeiro,
      v_venc_lanc, p_created_at, v_etapa_lanc, v_empresa_id
    );
  END IF;

  RETURN v_processo_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_processo_com_lancamento(
  UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TIMESTAMPTZ, BOOLEAN,
  NUMERIC, TEXT, TEXT[], BOOLEAN, TEXT, BOOLEAN, DATE, DATE,
  BOOLEAN, NUMERIC, TEXT, TEXT
) TO authenticated;

-- Função: promover lançamento ao deferir
CREATE OR REPLACE FUNCTION public.promover_lancamento_ao_deferir(
  p_processo_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lanc_id UUID;
  v_processo RECORD;
  v_vencimento DATE;
  v_empresa_caller UUID;
BEGIN
  v_empresa_caller := public.get_empresa_id();

  SELECT p.id, p.cliente_id, p.razao_social, p.tipo, p.valor, p.empresa_id
    INTO v_processo
    FROM public.processos p
   WHERE p.id = p_processo_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'processo_nao_encontrado');
  END IF;
  IF v_processo.empresa_id <> v_empresa_caller THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'processo_outra_empresa');
  END IF;

  SELECT id INTO v_lanc_id
    FROM public.lancamentos
   WHERE processo_id = p_processo_id
     AND tipo = 'receber'
     AND etapa_financeiro = 'aguardando_deferimento'
   ORDER BY created_at
   LIMIT 1
   FOR UPDATE;

  v_vencimento := public.calcular_vencimento(v_processo.cliente_id);

  IF v_lanc_id IS NOT NULL THEN
    UPDATE public.lancamentos
       SET etapa_financeiro = 'solicitacao_criada',
           data_vencimento = v_vencimento,
           updated_at = NOW()
     WHERE id = v_lanc_id;
    RETURN jsonb_build_object('ok', true, 'acao', 'promovido', 'lancamento_id', v_lanc_id);
  END IF;

  INSERT INTO public.lancamentos (
    tipo, cliente_id, processo_id, descricao, valor, status,
    data_vencimento, created_at, etapa_financeiro, empresa_id
  )
  VALUES (
    'receber'::public.tipo_lancamento,
    v_processo.cliente_id,
    p_processo_id,
    INITCAP(v_processo.tipo::text) || ' - ' || v_processo.razao_social || ' (Deferido)',
    COALESCE(v_processo.valor, 0),
    'pendente'::public.status_financeiro,
    v_vencimento,
    NOW(),
    'solicitacao_criada',
    v_processo.empresa_id
  )
  RETURNING id INTO v_lanc_id;

  RETURN jsonb_build_object('ok', true, 'acao', 'criado', 'lancamento_id', v_lanc_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.promover_lancamento_ao_deferir(UUID) TO authenticated;

-- Trigger: bloqueia avanço de aguardando_deferimento para etapas de cobrança
CREATE OR REPLACE FUNCTION public._bloqueia_avanco_aguardando_deferimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etapas_cobranca TEXT[] := ARRAY['cobranca_gerada', 'cobranca_enviada', 'aguardando_pagamento'];
BEGIN
  IF NEW.etapa_financeiro = OLD.etapa_financeiro THEN
    RETURN NEW;
  END IF;
  IF OLD.etapa_financeiro = 'aguardando_deferimento'
     AND NEW.etapa_financeiro = ANY(v_etapas_cobranca) THEN
    RAISE EXCEPTION 'Marque o processo como deferido antes de avançar pra cobrança.'
      USING ERRCODE = 'check_violation',
            HINT = 'Use a ação "Marcar como deferido" no processo. Isso promove o lançamento automaticamente.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloqueia_avanco_aguardando_deferimento ON public.lancamentos;
CREATE TRIGGER trg_bloqueia_avanco_aguardando_deferimento
  BEFORE UPDATE ON public.lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION public._bloqueia_avanco_aguardando_deferimento();