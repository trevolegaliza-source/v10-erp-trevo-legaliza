-- ============================================================
-- Migration 1: Lock anti-race-condition na geração de cobrança
-- ============================================================

ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS asaas_gerando_lock_ate TIMESTAMPTZ;

COMMENT ON COLUMN public.cobrancas.asaas_gerando_lock_ate IS
  'Timestamp até quando a cobrança está "bloqueada" por uma edge function gerando Asaas. Se NULL ou no passado, o lock está livre.';

CREATE OR REPLACE FUNCTION public.asaas_tentar_lock_cobranca(
  p_cobranca_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row            RECORD;
  v_now            TIMESTAMPTZ := NOW();
  v_lock_duration  INTERVAL    := '60 seconds';
  v_updated_count  INTEGER;
BEGIN
  UPDATE public.cobrancas
     SET asaas_gerando_lock_ate = v_now + v_lock_duration
   WHERE id = p_cobranca_id
     AND asaas_payment_id IS NULL
     AND status NOT IN ('paga', 'cancelada')
     AND (asaas_gerando_lock_ate IS NULL OR asaas_gerando_lock_ate < v_now);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 1 THEN
    RETURN jsonb_build_object('acquired', true);
  END IF;

  SELECT asaas_payment_id, asaas_gerando_lock_ate, status
    INTO v_row
    FROM public.cobrancas
   WHERE id = p_cobranca_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'not_found');
  END IF;

  IF v_row.status IN ('paga', 'cancelada') THEN
    RETURN jsonb_build_object(
      'acquired', false,
      'reason', 'wrong_status',
      'status', v_row.status
    );
  END IF;

  IF v_row.asaas_payment_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'acquired', false,
      'reason', 'already_generated',
      'asaas_payment_id', v_row.asaas_payment_id
    );
  END IF;

  RETURN jsonb_build_object(
    'acquired', false,
    'reason', 'in_progress',
    'locked_until', v_row.asaas_gerando_lock_ate
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.asaas_tentar_lock_cobranca(UUID) TO authenticated, service_role;

-- ============================================================
-- Migration 2: Expiração de link público de cobrança
-- ============================================================

ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS data_expiracao TIMESTAMPTZ;

COMMENT ON COLUMN public.cobrancas.data_expiracao IS
  'Prazo de validade do link público de cobrança. Após esta data, a RPC get_cobranca_por_token recusa o token. Default: data_vencimento + 60 dias, ou created_at + 90 dias.';

CREATE OR REPLACE FUNCTION public._cobranca_preenche_expiracao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.data_expiracao IS NULL THEN
    IF NEW.data_vencimento IS NOT NULL THEN
      NEW.data_expiracao := (NEW.data_vencimento + INTERVAL '60 days')::TIMESTAMPTZ;
    ELSE
      NEW.data_expiracao := COALESCE(NEW.created_at, NOW()) + INTERVAL '90 days';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cobranca_expiracao_default ON public.cobrancas;
CREATE TRIGGER trg_cobranca_expiracao_default
  BEFORE INSERT OR UPDATE ON public.cobrancas
  FOR EACH ROW
  EXECUTE FUNCTION public._cobranca_preenche_expiracao();

UPDATE public.cobrancas
   SET data_expiracao = COALESCE(
         (data_vencimento + INTERVAL '60 days')::TIMESTAMPTZ,
         created_at + INTERVAL '90 days'
       )
 WHERE data_expiracao IS NULL;

-- DROP necessário porque a assinatura existente inclui cliente_nome_contador,
-- e Postgres não permite alterar OUT params via CREATE OR REPLACE.
-- Mantemos cliente_nome_contador na nova versão para preservar a UI pública.
DROP FUNCTION IF EXISTS public.get_cobranca_por_token(TEXT);

CREATE OR REPLACE FUNCTION public.get_cobranca_por_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  cliente_nome TEXT,
  cliente_apelido TEXT,
  cliente_cnpj TEXT,
  cliente_nome_contador TEXT,
  total_honorarios NUMERIC,
  total_taxas NUMERIC,
  total_geral NUMERIC,
  data_vencimento DATE,
  status TEXT,
  created_at TIMESTAMPTZ,
  lancamentos JSONB,
  empresa_config JSONB,
  asaas JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cb.id,
    cl.nome,
    cl.apelido,
    cl.cnpj,
    cl.nome_contador,
    cb.total_honorarios,
    cb.total_taxas,
    cb.total_geral,
    cb.data_vencimento,
    cb.status,
    cb.created_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id,
        'descricao', l.descricao,
        'valor', l.valor,
        'razao_social', p.razao_social,
        'tipo_processo', p.tipo,
        'taxas', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'descricao', va.descricao,
            'valor', va.valor
          )) FROM public.valores_adicionais va WHERE va.processo_id = p.id
        ), '[]'::jsonb)
      ) ORDER BY p.razao_social)
      FROM public.lancamentos l
      LEFT JOIN public.processos p ON p.id = l.processo_id
      WHERE l.id = ANY(cb.lancamento_ids)
    ), '[]'::jsonb) as lancamentos,
    jsonb_build_object(
      'nome', 'TREVO LEGALIZA LTDA',
      'cnpj', '39.969.412/0001-70',
      'pix_chave', '39.969.412/0001-70',
      'pix_banco', 'C6 Bank',
      'whatsapp', '5511934927001',
      'site', 'trevolegaliza.com.br'
    ) as empresa_config,
    CASE
      WHEN cb.asaas_payment_id IS NOT NULL THEN
        jsonb_build_object(
          'payment_id', cb.asaas_payment_id,
          'status', cb.asaas_status,
          'invoice_url', cb.asaas_invoice_url,
          'boleto_url', cb.asaas_boleto_url,
          'boleto_barcode', cb.asaas_boleto_barcode,
          'pix_qrcode', cb.asaas_pix_qrcode,
          'pix_payload', cb.asaas_pix_payload,
          'gerado_em', cb.asaas_gerado_em,
          'pago_em', cb.asaas_pago_em
        )
      ELSE NULL
    END as asaas
  FROM public.cobrancas cb
  JOIN public.clientes cl ON cl.id = cb.cliente_id
  WHERE cb.share_token = p_token
    AND cb.status IN ('ativa', 'vencida', 'paga')
    AND (cb.data_expiracao IS NULL OR cb.data_expiracao > NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cobranca_por_token(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.rotacionar_cobranca_token(
  p_cobranca_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_novo_token TEXT;
  v_empresa_user UUID;
  v_empresa_cobr UUID;
  v_role TEXT;
BEGIN
  v_empresa_user := public.get_empresa_id();
  v_role := public.get_user_role();

  IF v_empresa_user IS NULL THEN
    RAISE EXCEPTION 'usuário sem empresa_id';
  END IF;

  IF v_role NOT IN ('master', 'gerente', 'financeiro') THEN
    RAISE EXCEPTION 'sem permissão para rotacionar token';
  END IF;

  SELECT empresa_id INTO v_empresa_cobr
    FROM public.cobrancas
   WHERE id = p_cobranca_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cobrança não encontrada';
  END IF;

  IF v_empresa_cobr <> v_empresa_user THEN
    RAISE EXCEPTION 'cobrança não pertence à sua empresa';
  END IF;

  v_novo_token := encode(extensions.gen_random_bytes(24), 'hex');

  UPDATE public.cobrancas
     SET share_token     = v_novo_token,
         data_expiracao  = NULL
   WHERE id = p_cobranca_id;

  RETURN v_novo_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rotacionar_cobranca_token(UUID) TO authenticated;