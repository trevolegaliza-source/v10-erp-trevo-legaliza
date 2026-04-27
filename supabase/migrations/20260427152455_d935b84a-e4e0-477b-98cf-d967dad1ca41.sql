-- =============================================
-- Onda 4 — Auditoria crítica (continuação)
-- =============================================

-- 1) get_cobranca_por_token com _log_acesso_publico
DROP FUNCTION IF EXISTS public.get_cobranca_por_token(TEXT);

CREATE FUNCTION public.get_cobranca_por_token(p_token TEXT)
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public._log_acesso_publico('cobranca', p_token);

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
        'comprovante_url', l.comprovante_url,
        'observacoes_processo', p.notas,
        'observacoes_financeiro', l.observacoes_financeiro,
        'taxas', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'descricao', va.descricao,
            'valor', va.valor,
            'categoria', va.categoria,
            'comprovante_url', va.comprovante_url
          )) FROM public.valores_adicionais va WHERE va.processo_id = p.id
        ), '[]'::jsonb)
      ) ORDER BY p.razao_social)
      FROM public.lancamentos l
      LEFT JOIN public.processos p ON p.id = l.processo_id
      WHERE l.id = ANY(cb.lancamento_ids)
    ), '[]'::jsonb) as lancamentos,
    public.resolve_empresa_config(cb.empresa_id) as empresa_config,
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

-- 2) Rate limit por IP em master_password_attempts
ALTER TABLE IF EXISTS public.master_password_attempts
  ADD COLUMN IF NOT EXISTS ip TEXT;

ALTER TABLE IF EXISTS public.master_password_attempts
  ADD COLUMN IF NOT EXISTS success BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_master_pwd_attempts_ip_time
  ON public.master_password_attempts (ip, attempted_at DESC)
  WHERE ip IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_master_pwd_attempts_user_fail_time
  ON public.master_password_attempts (user_id, attempted_at DESC)
  WHERE success = FALSE;

CREATE OR REPLACE FUNCTION public.register_master_password_attempt(
  p_user_id UUID,
  p_ip TEXT,
  p_success BOOLEAN
)
RETURNS TABLE (
  allowed BOOLEAN,
  recent_failures INTEGER,
  retry_after_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count_user_1h INTEGER;
  v_count_ip_1h INTEGER;
  v_oldest_ts TIMESTAMPTZ;
  v_allowed BOOLEAN;
  v_retry INTEGER;
BEGIN
  INSERT INTO public.master_password_attempts (user_id, ip, success)
  VALUES (p_user_id, p_ip, p_success);

  SELECT COUNT(*) INTO v_count_user_1h
    FROM public.master_password_attempts
   WHERE user_id = p_user_id
     AND success = FALSE
     AND attempted_at > NOW() - INTERVAL '60 minutes';

  SELECT COUNT(*) INTO v_count_ip_1h
    FROM public.master_password_attempts
   WHERE ip IS NOT NULL
     AND ip = p_ip
     AND success = FALSE
     AND attempted_at > NOW() - INTERVAL '60 minutes';

  v_allowed := v_count_user_1h < 5 AND v_count_ip_1h < 10;

  IF NOT v_allowed THEN
    SELECT MIN(attempted_at) INTO v_oldest_ts
      FROM public.master_password_attempts
     WHERE (user_id = p_user_id OR ip = p_ip)
       AND success = FALSE
       AND attempted_at > NOW() - INTERVAL '60 minutes';
    v_retry := GREATEST(
      0,
      EXTRACT(EPOCH FROM (v_oldest_ts + INTERVAL '60 minutes' - NOW()))::INTEGER
    );
  ELSE
    v_retry := 0;
  END IF;

  RETURN QUERY SELECT
    v_allowed,
    GREATEST(v_count_user_1h, v_count_ip_1h),
    v_retry;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_master_password_attempt(UUID, TEXT, BOOLEAN)
  TO authenticated;

-- 3) CHECK constraints (NOT VALID) em valores monetários
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orcamentos_valor_base_nonneg') THEN
    ALTER TABLE public.orcamentos
      ADD CONSTRAINT orcamentos_valor_base_nonneg
      CHECK (valor_base IS NULL OR valor_base >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orcamentos_valor_final_nonneg') THEN
    ALTER TABLE public.orcamentos
      ADD CONSTRAINT orcamentos_valor_final_nonneg
      CHECK (valor_final IS NULL OR valor_final >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cobrancas_total_nonneg') THEN
    ALTER TABLE public.cobrancas
      ADD CONSTRAINT cobrancas_total_nonneg
      CHECK (total_geral IS NULL OR total_geral >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lancamentos_valor_sane') THEN
    ALTER TABLE public.lancamentos
      ADD CONSTRAINT lancamentos_valor_sane
      CHECK (valor IS NULL OR ABS(valor) <= 1000000000) NOT VALID;
  END IF;
END $$;

-- 4) alterar_valor_lancamento atômico via RPC
CREATE OR REPLACE FUNCTION public.alterar_valor_lancamento(
  p_lancamento_id UUID,
  p_novo_valor NUMERIC,
  p_valor_atual NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processo_id UUID;
  v_valor_original NUMERIC;
  v_user UUID;
  v_role TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  v_user := auth.uid();
  v_role := public.get_user_role();

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'usuário não autenticado' USING ERRCODE = '42501';
  END IF;

  IF v_role NOT IN ('master', 'gerente', 'financeiro') THEN
    RAISE EXCEPTION 'sem permissão para alterar valor' USING ERRCODE = '42501';
  END IF;

  IF p_novo_valor IS NULL OR p_novo_valor < 0 THEN
    RAISE EXCEPTION 'valor inválido' USING ERRCODE = '22023';
  END IF;

  SELECT processo_id, valor_original
    INTO v_processo_id, v_valor_original
    FROM public.lancamentos
   WHERE id = p_lancamento_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lançamento não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_processo_id IS NOT NULL THEN
    UPDATE public.processos
       SET valor = p_novo_valor,
           updated_at = v_now
     WHERE id = v_processo_id;
  END IF;

  UPDATE public.lancamentos
     SET valor = p_novo_valor,
         valor_original = COALESCE(v_valor_original, p_valor_atual),
         valor_alterado_por = v_user,
         valor_alterado_em = v_now,
         updated_at = v_now
   WHERE id = p_lancamento_id;

  RETURN jsonb_build_object(
    'ok', true,
    'lancamento_id', p_lancamento_id,
    'processo_id', v_processo_id,
    'valor_anterior', p_valor_atual,
    'valor_novo', p_novo_valor
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.alterar_valor_lancamento(UUID, NUMERIC, NUMERIC)
  TO authenticated;