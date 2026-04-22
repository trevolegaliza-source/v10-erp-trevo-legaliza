-- Migration 15: empresas_config multi-tenant

CREATE TABLE IF NOT EXISTS public.empresas_config (
  empresa_id     UUID PRIMARY KEY,
  razao_social   TEXT,
  cnpj           TEXT,
  pix_chave      TEXT,
  pix_banco      TEXT,
  whatsapp       TEXT,
  site           TEXT,
  nome_fantasia  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.empresas_config IS
  'Configuração por empresa: dados usados em cobranças (PIX, banco, contatos). 1 linha por empresa_id.';

CREATE OR REPLACE FUNCTION public._empresas_config_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_empresas_config_updated_at ON public.empresas_config;
CREATE TRIGGER trg_empresas_config_updated_at
  BEFORE UPDATE ON public.empresas_config
  FOR EACH ROW EXECUTE FUNCTION public._empresas_config_touch_updated_at();

ALTER TABLE public.empresas_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empresas_config_select" ON public.empresas_config;
CREATE POLICY "empresas_config_select" ON public.empresas_config
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());

DROP POLICY IF EXISTS "empresas_config_master_write" ON public.empresas_config;
CREATE POLICY "empresas_config_master_write" ON public.empresas_config
  FOR ALL TO authenticated
  USING (empresa_id = public.get_empresa_id() AND public.get_user_role() = 'master')
  WITH CHECK (empresa_id = public.get_empresa_id() AND public.get_user_role() = 'master');

INSERT INTO public.empresas_config (
  empresa_id, razao_social, cnpj, pix_chave, pix_banco, whatsapp, site, nome_fantasia
)
SELECT DISTINCT
  p.empresa_id,
  'TREVO LEGALIZA LTDA',
  '39.969.412/0001-70',
  '39.969.412/0001-70',
  'C6 Bank',
  '5511934927001',
  'trevolegaliza.com.br',
  'Trevo Legaliza'
FROM public.profiles p
WHERE p.empresa_id IS NOT NULL
ON CONFLICT (empresa_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.resolve_empresa_config(p_empresa_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.empresas_config%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.empresas_config WHERE empresa_id = p_empresa_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'nome', 'TREVO LEGALIZA LTDA',
      'cnpj', '39.969.412/0001-70',
      'pix_chave', '39.969.412/0001-70',
      'pix_banco', 'C6 Bank',
      'whatsapp', '5511934927001',
      'site', 'trevolegaliza.com.br'
    );
  END IF;

  RETURN jsonb_build_object(
    'nome', COALESCE(v_row.razao_social, ''),
    'cnpj', COALESCE(v_row.cnpj, ''),
    'pix_chave', COALESCE(v_row.pix_chave, ''),
    'pix_banco', COALESCE(v_row.pix_banco, ''),
    'whatsapp', COALESCE(v_row.whatsapp, ''),
    'site', COALESCE(v_row.site, '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_empresa_config(UUID) TO anon, authenticated;

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
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cb.id, cl.nome, cl.apelido, cl.cnpj, cl.nome_contador,
    cb.total_honorarios, cb.total_taxas, cb.total_geral,
    cb.data_vencimento, cb.status, cb.created_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id,
        'descricao', l.descricao,
        'valor', l.valor,
        'razao_social', p.razao_social,
        'tipo_processo', p.tipo,
        'taxas', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('descricao', va.descricao, 'valor', va.valor))
          FROM public.valores_adicionais va WHERE va.processo_id = p.id
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